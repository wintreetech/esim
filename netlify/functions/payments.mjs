import { runScheduled } from "../lib/run-scheduled.mjs";
export default async function payments(_request, context) {
  return runScheduled("/api/cron/payments", context);
}
export const config = { schedule: "* * * * *" };
