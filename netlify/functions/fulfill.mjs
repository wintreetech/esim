import { runScheduled } from "../lib/run-scheduled.mjs";
export default async function fulfill(_request, context) {
  return runScheduled("/api/cron/fulfill", context);
}
export const config = { schedule: "* * * * *" };
