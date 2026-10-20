import { NextRequest, NextResponse } from "next/server";
import { getB2Config, getB2AuthToken } from "@/lib/b2-storage";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fileParam = searchParams.get("file");

    if (!fileParam) {
      return NextResponse.json({
        status: "active",
        service: "Backblaze B2 Cloud Storage Proxy API",
        message: "Pass ?file=path/to/file or request /api/b2/[path] to stream media."
      });
    }

    const config = getB2Config();
    const { token, downloadUrl } = await getB2AuthToken();

    const decodedPath = decodeURIComponent(fileParam);
    const cleanPath = decodedPath.startsWith("/") ? decodedPath : `/${decodedPath}`;
    const targetUrl = `${downloadUrl}/file/${config.bucketName}${cleanPath}`;

    const headers = new Headers();
    const forwardHeaders = ["range", "accept", "accept-encoding", "user-agent"];
    for (const h of forwardHeaders) {
      const val = request.headers.get(h);
      if (val) headers.set(h, val);
    }
    headers.set("Authorization", token);

    const b2Response = await fetch(targetUrl, {
      method: "GET",
      headers,
    });

    const responseHeaders = new Headers();
    b2Response.headers.forEach((val, key) => {
      if ([
        "content-type",
        "content-length",
        "content-range",
        "accept-ranges",
        "cache-control",
        "etag",
        "last-modified"
      ].includes(key.toLowerCase())) {
        responseHeaders.set(key, val);
      }
    });

    return new NextResponse(b2Response.body as ReadableStream | null, {
      status: b2Response.status,
      statusText: b2Response.statusText,
      headers: responseHeaders,
    });
  } catch (err) {
    console.error("[B2 Direct Proxy Error]:", err);
    return new NextResponse("Failed to stream cloud storage request", { status: 500 });
  }
}
