import { NextRequest, NextResponse } from "next/server";
import { getSessionOrRefresh } from "@/lib/auth";
import { verifySignedUrl, getDemoVideoUrl } from "@/lib/signed-url";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const session = await getSessionOrRefresh();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { key } = await params;
    const { searchParams } = new URL(request.url);
    const expires = parseInt(searchParams.get("expires") ?? "0");
    const sig = searchParams.get("sig") ?? "";

    if (!expires || !sig) {
      return NextResponse.json({ error: "Invalid signed URL" }, { status: 400 });
    }

    const decodedKey = decodeURIComponent(key);

    if (!verifySignedUrl(decodedKey, expires, sig)) {
      return NextResponse.json({ error: "Expired or invalid signature" }, { status: 403 });
    }

    // In production, redirect to CloudFront signed URL
    // For demo, return the HLS stream URL
    const videoUrl = getDemoVideoUrl(decodedKey);

    return NextResponse.redirect(videoUrl);
  } catch (err) {
    console.error("Stream error:", err);
    return NextResponse.json({ error: "Stream error" }, { status: 500 });
  }
}
