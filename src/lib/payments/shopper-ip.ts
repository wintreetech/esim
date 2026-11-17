import "server-only";
import { isIP } from "node:net";
export function shopperIp(request: Request) {
  // Deployment proxies must replace these headers; Netlify supplies its own.
  const value = (
    request.headers.get("x-nf-client-connection-ip") ||
    request.headers.get("x-vercel-forwarded-for") ||
    request.headers.get("x-forwarded-for") ||
    (process.env.NODE_ENV !== "production" ? "127.0.0.1" : "")
  )
    .split(",")[0]
    .trim()
    .replace(/^::ffff:/, "");
  return isIP(value) ? value : "";
}
