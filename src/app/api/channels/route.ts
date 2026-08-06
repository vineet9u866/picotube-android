import { NextResponse } from "next/server";
import { listSeededChannels } from "@/lib/youtube-rss";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

export async function GET() {
  return NextResponse.json({
    channels: listSeededChannels(),
  });
}
