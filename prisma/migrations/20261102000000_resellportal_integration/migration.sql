ALTER TABLE "Plan" ALTER COLUMN "network" DROP NOT NULL;
ALTER TABLE "Plan" ALTER COLUMN "supports5G" DROP NOT NULL;
ALTER TABLE "Plan" ALTER COLUMN "supportsHotspot" DROP NOT NULL;
ALTER TABLE "Plan" ADD COLUMN "speed" TEXT;
ALTER TABLE "Plan" ADD COLUMN "coverage" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Esim" ALTER COLUMN "activationCode" DROP NOT NULL;
ALTER TABLE "Esim" ALTER COLUMN "qrCodeData" DROP NOT NULL;
ALTER TABLE "Esim" ADD COLUMN "qrCodeUrl" TEXT;
ALTER TABLE "Esim" ADD COLUMN "activationUrl" TEXT;
ALTER TABLE "Esim" ADD COLUMN "testMode" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "SupplierOrder" ADD COLUMN "clientId" TEXT;
ALTER TABLE "Order" ADD COLUMN "supplierTestMode" BOOLEAN NOT NULL DEFAULT true;
CREATE UNIQUE INDEX "SupplierOrder_provider_externalOrderId_key" ON "SupplierOrder"("provider", "externalOrderId");

-- Retire sample inventory without deleting historical orders, payments or eSIMs.
UPDATE "Plan" SET "active" = false WHERE "provider" IN ('mock', 'supplier');
UPDATE "Esim" SET "testMode" = true, "status" = 'TEST_READY' WHERE "orderItemId" IN (SELECT "id" FROM "OrderItem" WHERE "provider" = 'mock');
