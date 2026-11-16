import "server-only";
import { z } from "zod";
import { ResellPortalClient } from "./resellportal-client";
import { ResellPortalCatalog } from "./resellportal-catalog";
import {
  resellPortalClientsSchema,
  resellPortalClientCreatedSchema,
  resellPortalEsimDetailsSchema,
  resellPortalOrderSchema,
  resellPortalUsageSchema,
} from "./resellportal-schemas";
import { resellPortalTestMode } from "./config";
import {
  ProviderError,
  type EsimProvider,
  type CreateEsimOrderInput,
  type ProviderOrder,
  type TopUpInput,
  type TopUpResult,
} from "./types";

export class ResellPortalProvider implements EsimProvider {
  // The supplied contract does not promise idempotency for POST /orders.
  readonly supportsIdempotentOrders = false;
  private readonly catalog: ResellPortalCatalog;
  constructor(private readonly client = new ResellPortalClient()) {
    this.catalog = new ResellPortalCatalog(client);
  }
  getDestinations() {
    return this.catalog.getDestinations();
  }
  getPlans(code: string) {
    return this.catalog.getPlans(code);
  }

  async prepareOrder(
    input: CreateEsimOrderInput,
  ): Promise<{ clientId: string }> {
    if (input.clientId) return { clientId: input.clientId };
    const result = await this.client.get("/clients", resellPortalClientsSchema);
    const clients = result.clients.filter(
      (c) => c.email.toLowerCase() === input.email.toLowerCase(),
    );
    if (clients.length === 1) return { clientId: clients[0].id };
    if (clients.length > 1)
      throw new ProviderError("RESELLPORTAL_DUPLICATE_CLIENT_EMAIL", false);
    const name =
      [input.firstName, input.lastName].filter(Boolean).join(" ").trim() ||
      input.email.split("@")[0];
    try {
      const created = await this.client.post(
        "/clients",
        resellPortalClientCreatedSchema,
        { name, email: input.email, send_setup_email: false },
      );
      // Ignore portal_credentials entirely; Roamly keeps its own Supabase identity.
      return { clientId: created.client_id };
    } catch (error) {
      // A concurrent order or timed-out client creation can be recovered by email.
      // Only POST /orders charges the wallet; no order has been submitted here.
      const refreshed = await this.client.get(
        "/clients",
        resellPortalClientsSchema,
      );
      const match = refreshed.clients.filter(
        (c) => c.email.toLowerCase() === input.email.toLowerCase(),
      );
      if (match.length === 1) return { clientId: match[0].id };
      if (error instanceof ProviderError && error.outcomeUnknown)
        throw new ProviderError("RESELLPORTAL_CLIENT_LOOKUP_PENDING", true);
      throw error;
    }
  }

  async createOrder(input: CreateEsimOrderInput): Promise<ProviderOrder> {
    const numeric = input.clientId && /^\d+$/.test(input.clientId);
    if (
      !input.clientId ||
      (!numeric &&
        !(resellPortalTestMode() && input.clientId.startsWith("test_cli_")))
    )
      throw new ProviderError("RESELLPORTAL_CLIENT_REQUIRED", false);
    const result = await this.client.post("/orders", resellPortalOrderSchema, {
      client_id: numeric ? Number(input.clientId) : input.clientId,
      product_key: "esim",
      package_code: input.supplierPlanId,
    });
    return this.mapOrder(result, {
      clientId: input.clientId,
      packageCode: input.supplierPlanId,
    });
  }

  async getOrder(serviceId: string): Promise<ProviderOrder> {
    const response = await this.client.get(
      `/services/${encodeURIComponent(serviceId)}`,
      z.unknown(),
    );
    const records: Record<string, unknown>[] = [];
    // GET /services is a read-only endpoint. Locate the documented esim_details
    // object independently of transport wrappers, accepting only one unambiguous
    // record. Do not invent QR payloads or activation credentials from a URL.
    const visit = (value: unknown, depth = 0): void => {
      if (
        depth > 5 ||
        !value ||
        typeof value !== "object" ||
        Array.isArray(value)
      )
        return;
      const record = value as Record<string, unknown>;
      if ("esim_details" in record) records.push(record);
      else Object.values(record).forEach((v) => visit(v, depth + 1));
    };
    visit(response);
    if (records.length !== 1)
      throw new ProviderError(
        "RESELLPORTAL_SERVICE_RESPONSE_UNCONFIRMED",
        false,
      );
    const record = records[0];
    if (
      record.success === false ||
      (record.service_id !== undefined &&
        String(record.service_id) !== serviceId)
    )
      throw new ProviderError("RESELLPORTAL_SERVICE_MISMATCH", false);
    const details = resellPortalEsimDetailsSchema
      .nullish()
      .parse(record.esim_details);
    const context: { clientId?: string; packageCode?: string } = {};
    if (record.client_id !== undefined)
      context.clientId = String(record.client_id);
    if (record.package_code !== undefined)
      context.packageCode = String(record.package_code);
    const parsedPackage = z
      .object({ code: z.string() })
      .safeParse(record.package);
    if (parsedPackage.success) context.packageCode = parsedPackage.data.code;
    return this.mapOrder(
      {
        success: true,
        service_id: serviceId,
        esim_details: details,
        test_mode: record.test_mode === true,
      },
      context,
      false,
    );
  }

  private mapOrder(
    result: z.infer<typeof resellPortalOrderSchema>,
    context: { clientId?: string; packageCode?: string } = {},
    checkMode = true,
  ): ProviderOrder {
    const testMode = Boolean(
      result.test_mode ||
      result.service_id.startsWith("test_svc_") ||
      result.would_charge !== undefined,
    );
    if (checkMode && testMode !== resellPortalTestMode())
      throw new ProviderError("RESELLPORTAL_MODE_MISMATCH", false, true);
    const details = result.esim_details;
    return {
      orderId: result.service_id,
      esimId: result.service_id,
      iccid: details?.iccid || "",
      activationCode: null,
      qrCodeData: null,
      qrCodeUrl: details?.qr_code_url || null,
      activationUrl: details?.activation_url || null,
      smdpAddress: null,
      status: details?.iccid && details.qr_code_url ? "READY" : "PENDING",
      expiresAt: null,
      testMode,
      ...context,
    };
  }

  async getUsage(serviceId: string) {
    const result = await this.client.get(
      `/services/${encodeURIComponent(serviceId)}/usage`,
      resellPortalUsageSchema,
    );
    if (result.service_id !== serviceId)
      throw new ProviderError("RESELLPORTAL_SERVICE_MISMATCH", false);
    return {
      dataTotalMb: result.usage.total_bytes / (1024 * 1024),
      dataUsedMb: result.usage.used_bytes / (1024 * 1024),
      status: result.usage.esim_status,
      expiresAt: result.usage.expires_at
        ? new Date(result.usage.expires_at).toISOString()
        : null,
    };
  }

  async topUp(input: TopUpInput): Promise<TopUpResult> {
    void input;
    throw new ProviderError("RESELLPORTAL_TOPUPS_NOT_SUPPORTED", false);
  }
}
