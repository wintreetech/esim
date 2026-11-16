import type { MetadataRoute } from "next";
import { brand } from "@/lib/brand";
import { getCatalog } from "@/lib/catalog";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const destinations = await getCatalog();
  return [
    "",
    "/destinations",
    "/compatibility",
    "/how-it-works",
    "/faq",
    "/support",
    ...destinations.map((d) => `/esim/${d.slug}`),
  ].map((path) => ({
    url: `${brand.url}${path}`,
    changeFrequency: "weekly",
    priority: path === "" ? 1 : path.startsWith("/esim") ? 0.8 : 0.6,
  }));
}
