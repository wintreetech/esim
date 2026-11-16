import "server-only";
import QRCode from "qrcode";
import { ProviderError } from "./types";

type QrSource = { qrCodeData: string | null; qrCodeUrl: string | null };

export async function esimQrImage(
  source: QrSource,
): Promise<{ buffer: Buffer; mime: string; dataUrl: string }> {
  if (source.qrCodeData) {
    // An activation image URL is not an eSIM payload. Encoding that URL as a new QR
    // would produce a QR code that opens a website instead of installing an eSIM.
    if (!/^LPA:1\$/i.test(source.qrCodeData))
      throw new ProviderError("ESIM_QR_PAYLOAD_INVALID", false);
    const buffer = await QRCode.toBuffer(source.qrCodeData, {
      width: 400,
      margin: 2,
    });
    return {
      buffer,
      mime: "image/png",
      dataUrl: `data:image/png;base64,${buffer.toString("base64")}`,
    };
  }
  if (!source.qrCodeUrl) throw new ProviderError("ESIM_QR_NOT_READY");
  const url = new URL(source.qrCodeUrl);
  const hosts = new Set(
    (process.env.RESELLPORTAL_QR_ALLOWED_HOSTS || "panel.resellportal.com")
      .split(",")
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean),
  );
  if (
    url.protocol !== "https:" ||
    !hosts.has(url.hostname.toLowerCase()) ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443")
  )
    throw new ProviderError("ESIM_QR_HOST_NOT_ALLOWED", false);
  try {
    const response = await fetch(url, {
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok || !response.body) throw new Error("Image unavailable");
    const max = 4 * 1024 * 1024;
    if (Number(response.headers.get("content-length") || 0) > max)
      throw new Error("Image too large");
    const chunks: Uint8Array[] = [];
    let size = 0;
    const reader = response.body.getReader();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > max) {
        await reader.cancel();
        throw new Error("Image too large");
      }
      chunks.push(value);
    }
    const buffer = Buffer.concat(chunks);
    const mime = buffer
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      ? "image/png"
      : buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255
        ? "image/jpeg"
        : buffer.subarray(0, 4).toString() === "RIFF" &&
            buffer.subarray(8, 12).toString() === "WEBP"
          ? "image/webp"
          : null;
    if (!mime) throw new Error("Invalid image");
    return {
      buffer,
      mime,
      dataUrl: `data:${mime};base64,${buffer.toString("base64")}`,
    };
  } catch {
    throw new ProviderError("ESIM_QR_UNAVAILABLE");
  }
}
