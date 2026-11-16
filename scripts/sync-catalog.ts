import "dotenv/config";
// Run with react-server condition so server-only is allowed in this trusted CLI.
// `node --conditions=react-server --import tsx scripts/sync-catalog.ts`
import { syncCatalog } from "../src/lib/esim/sync";
import { db } from "../src/lib/db";
syncCatalog()
  .then(console.log)
  .finally(() => db().$disconnect());
