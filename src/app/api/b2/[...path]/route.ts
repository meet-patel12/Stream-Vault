import { NextRequest, NextResponse } from "next/server";
import { getB2Config, getB2AuthToken } from "@/lib/b2-storage";
import { spawn } from "child_process";
import { PassThrough, Readable } from "stream";
import path from "path";
import fs from "fs";

function getFFmpegPath(): string | null {
  try {
    const ffmpegPath = require("ffmpeg-static");
    if (typeof ffmpegPath === "string" && fs.existsSync(ffmpegPath)) {
      return ffmpegPath;
    }
  } catch {
    // fallback
  }

  const possiblePaths = [
    path.join(process.cwd(), "node_modules", "ffmpeg-static", "ffmpeg.exe"),
    path.join(process.cwd(), "node_modules", "ffmpeg-static", "ffmpeg"),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

async function proxyB2Request(request: NextRequest, relativePath: string) {
  try {
    const decodedPath = decodeURIComponent(relativePath);
    const cleanPath = decodedPath.startsWith("/") ? decodedPath : `/${decodedPath}`;
    const lowerPath = cleanPath.toLowerCase();

    // Optimize HEAD requests (fast metadata probe without spawning FFmpeg)
    if (request.method === "HEAD") {
      return new NextResponse(null, {
        status: 200,
        headers: {
          "Content-Type": "video/mp4",
          "Accept-Ranges": "bytes",
          "Cache-Control": "public, max-age=3600",
        },
      });
    }

    const cdnBase = (process.env.CDN_BASE_URL || "").replace(/\/+$/, "");
    const config = getB2Config();

    let token = "";
    let downloadUrl = "";
    try {
      const auth = await getB2AuthToken();
      token = auth.token;
      downloadUrl = auth.downloadUrl;
    } catch (authErr) {
      console.warn("[B2 Auth Warning]:", authErr);
    }

    const b2NativeTargetUrl = downloadUrl
      ? `${downloadUrl}/file/${config.bucketName}${cleanPath}`
      : "";
    const inputUrl = cdnBase ? `${cdnBase}${cleanPath}` : b2NativeTargetUrl;

    const qualityParam = (request.nextUrl.searchParams.get("quality") || "").toLowerCase();
    let heightScale: number | null = null;
    if (qualityParam.includes("720")) heightScale = 720;
    else if (qualityParam.includes("480")) heightScale = 480;
    else if (qualityParam.includes("360")) heightScale = 360;

    const forceTranscode = request.nextUrl.searchParams.get("transcode") === "true";
    const audioParam = (request.nextUrl.searchParams.get("audio") || "").toLowerCase();

    // Container formats that cannot be played natively in web browsers
    const isNonWebContainer =
      lowerPath.endsWith(".mkv") ||
      lowerPath.endsWith(".avi") ||
      lowerPath.endsWith(".flv");

    const needsTranscode =
      !!heightScale ||
      forceTranscode ||
      isNonWebContainer ||
      (!!audioParam && audioParam !== "0");

    // Live FFmpeg scaling and remuxing
    if (needsTranscode) {
      const ffmpegPath = getFFmpegPath();
      if (ffmpegPath) {
        console.log(
          `[B2 Transcode Proxy] Scaling/remuxing video (${qualityParam || "native"}): ${cleanPath}`
        );

        const startTimeParam =
          request.nextUrl.searchParams.get("start") ||
          request.nextUrl.searchParams.get("ss");
        const ssArgs = startTimeParam ? ["-ss", startTimeParam] : [];

        let audioMap = "0:a:0?";
        if (audioParam) {
          if (/^\d+$/.test(audioParam)) audioMap = `0:a:${audioParam}?`;
          else if (audioParam.includes("hindi") || audioParam.includes("hin")) audioMap = "0:a:1?";
          else if (audioParam.includes("english") || audioParam.includes("eng")) audioMap = "0:a:1?";
          else if (audioParam.includes("spanish") || audioParam.includes("spa")) audioMap = "0:a:2?";
          else if (audioParam.includes("japanese") || audioParam.includes("jpn")) audioMap = "0:a:3?";
        }

        const vfArgs = heightScale ? ["-vf", `scale=-2:${heightScale}`] : [];
        const authHeader = !cdnBase && token ? ["-headers", `Authorization: ${token}\r\n`] : [];

        const ffmpegArgs = [
          ...authHeader,
          "-probesize",
          "10M",
          "-analyzeduration",
          "2M",
          ...ssArgs,
          "-i",
          inputUrl,
          "-map",
          "0:v:0?",
          "-map",
          audioMap,
          "-c:v",
          "libx264",
          "-preset",
          "ultrafast",
          "-crf",
          "23",
          ...vfArgs,
          "-c:a",
          "aac",
          "-b:a",
          "128k",
          "-movflags",
          "frag_keyframe+empty_moov+default_base_moof",
          "-f",
          "mp4",
          "pipe:1",
        ];

        const passThrough = new PassThrough();
        const ffProc = spawn(ffmpegPath, ffmpegArgs, {
          stdio: ["ignore", "pipe", "pipe"],
        });

        ffProc.stdout.pipe(passThrough);

        ffProc.stderr.on("data", () => {
          // Silent progress logging
        });

        ffProc.on("error", (err) => {
          console.error("[B2 FFmpeg Error]:", err);
          passThrough.destroy(err);
        });

        // Kill FFmpeg process if client disconnects or changes stream
        request.signal.addEventListener("abort", () => {
          try {
            ffProc.kill();
          } catch {}
          passThrough.destroy();
        });

        const webStream = Readable.toWeb(passThrough);

        return new Response(webStream as unknown as BodyInit, {
          status: 200,
          headers: {
            "Content-Type": "video/mp4",
            "Accept-Ranges": "bytes",
            "Cache-Control": "no-cache",
          },
        });
      }
    }

    // Direct proxy for standard web-native formats (1080p H.264 MP4, WebM)
    const targetUrlObj = new URL(inputUrl);
    request.nextUrl.searchParams.forEach((value, key) => {
      targetUrlObj.searchParams.set(key, value);
    });

    const headers = new Headers();
    const forwardHeaders = ["range", "accept", "accept-encoding", "user-agent"];
    for (const h of forwardHeaders) {
      const val = request.headers.get(h);
      if (val) headers.set(h, val);
    }
    if (!cdnBase && token) {
      headers.set("Authorization", token);
    }

    console.log(`[B2 Direct Proxy] Fetching: ${targetUrlObj.toString()}`);

    const b2Response = await fetch(targetUrlObj.toString(), {
      method: request.method,
      headers,
    });

    const responseHeaders = new Headers();
    b2Response.headers.forEach((val, key) => {
      if (
        [
          "content-type",
          "content-length",
          "content-range",
          "accept-ranges",
          "cache-control",
          "etag",
          "last-modified",
        ].includes(key.toLowerCase())
      ) {
        responseHeaders.set(key, val);
      }
    });

    return new NextResponse(b2Response.body as ReadableStream | null, {
      status: b2Response.status,
      statusText: b2Response.statusText,
      headers: responseHeaders,
    });
  } catch (err) {
    console.error("[B2 Proxy Error]:", err);
    return new NextResponse("Failed to proxy cloud storage request", { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params;
  const pathParts = resolvedParams.path || [];
  const relativePath = pathParts.join("/");
  return proxyB2Request(request, relativePath);
}

export async function HEAD(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params;
  const pathParts = resolvedParams.path || [];
  const relativePath = pathParts.join("/");
  return proxyB2Request(request, relativePath);
}
