import { runScheduled } from "../lib/run-scheduled.mjs";
export default async function catalog(_request, context) {
  return runScheduled("/api/cron/catalog", context);
}
export const config = { schedule: "0 */6 * * *" };
