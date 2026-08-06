import { NextResponse } from "next/server";
import { getVideo, hasApiKey } from "@/lib/youtube-api";
import { findCatalogVideo } from "@/lib/youtube-catalog";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id || !/^[a-zA-Z0-9_-]{6,}$/.test(id)) {
    return NextResponse.json({ error: "Invalid video id" }, { status: 400 });
  }
  const cached = findCatalogVideo(id);
  if (cached) {
    return NextResponse.json({ video: cached, source: "catalog" });
  }
  if (!hasApiKey()) {
    return NextResponse.json({ error: "Not found in catalog and no API key configured" }, { status: 404 });
  }
  const v = await getVideo(id);
  if (!v) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ video: v, source: "api" });
}
