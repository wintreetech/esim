import type { MetadataRoute } from "next";
import { brand } from "@/lib/brand";
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/admin",
        "/account",
        "/order/",
        "/checkout",
        "/login",
        "/auth/",
      ],
    },
    sitemap: `${brand.url}/sitemap.xml`,
  };
}
