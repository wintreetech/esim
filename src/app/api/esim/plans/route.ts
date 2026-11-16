import { NextResponse } from "next/server";
import { z } from "zod";
import { getCatalog } from "@/lib/catalog";
import { apiError } from "@/lib/http";
export async function GET(request: Request) {
  try {
    const slug = z
      .string()
      .max(100)
      .nullable()
      .parse(new URL(request.url).searchParams.get("destination"));
    const catalog = await getCatalog();
    return NextResponse.json({
      destinations: slug ? catalog.filter((d) => d.slug === slug) : catalog,
    });
  } catch (error) {
    return apiError(error);
  }
}
