import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { spawn } from "child_process";
import { PassThrough, Readable } from "stream";

// 4MB chunk size per Range request for ultra-fast, smooth streaming
const CHUNK_SIZE = 4 * 1024 * 1024;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const fileParam = searchParams.get("file");

  console.log("=== STREAM MEDIA ROUTE CALLED ===");
  console.log("fileParam:", fileParam);
  console.log("qualityParam:", searchParams.get("quality"));

  if (!fileParam) {
    return new NextResponse("File parameter required", { status: 400 });
  }

  // Clean path to prevent directory traversal
  const cleanPath = fileParam.replace(/^\/+/, "");
  const absolutePath = path.join(process.cwd(), "public", cleanPath);

  console.log("absolutePath:", absolutePath);
  console.log("exists:", fs.existsSync(absolutePath));

  if (!fs.existsSync(absolutePath)) {
    return new NextResponse(`File not found: ${cleanPath}`, { status: 404 });
  }

  const ext = path.extname(absolutePath).toLowerCase();
  const qualityParam = (searchParams.get("quality") || "").toLowerCase();
  const audioParam = (searchParams.get("audio") || searchParams.get("audioTrack") || "").toLowerCase();

  // Parse requested quality resolution (height in pixels)
  let heightScale: number | null = null;
  if (qualityParam.includes("720")) heightScale = 720;
  else if (qualityParam.includes("480")) heightScale = 480;
  else if (qualityParam.includes("360")) heightScale = 360;
  else if (qualityParam.includes("1080")) heightScale = null; // 1080p is native source resolution

  // Direct HTTP range streaming for web video formats (.mp4, .webm, .ogv, .m3u8) when no resolution scaling AND no custom audio selection is requested
  if ([".mp4", ".webm", ".ogv", ".m3u8"].includes(ext) && !heightScale && !audioParam) {
    const stat = fs.statSync(absolutePath);
    const fileSize = stat.size;
    const range = request.headers.get("range");

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const requestedEnd = parts[1] ? parseInt(parts[1], 10) : start + CHUNK_SIZE - 1;
      const end = Math.min(requestedEnd, start + CHUNK_SIZE - 1, fileSize - 1);
      const chunksize = end - start + 1;

      const nodeStream = fs.createReadStream(absolutePath, { start, end });

      const stream = new ReadableStream({
        start(controller) {
          nodeStream.on("data", (chunk) => {
            try {
              controller.enqueue(chunk);
            } catch {
              nodeStream.destroy();
            }
          });
          nodeStream.on("end", () => {
            try {
              controller.close();
            } catch {
              // Ignore if controller already closed
            }
          });
          nodeStream.on("error", (err) => {
            nodeStream.destroy();
            try {
              controller.error(err);
            } catch {
              // Ignore
            }
          });
        },
        cancel() {
          nodeStream.destroy();
        },
      });

      return new NextResponse(stream as unknown as BodyInit, {
        status: 206,
        headers: {
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunksize.toString(),
          "Content-Type": ext === ".webm" ? "video/webm" : "video/mp4",
        },
      });
    } else {
      const end = Math.min(CHUNK_SIZE - 1, fileSize - 1);
      const nodeStream = fs.createReadStream(absolutePath, { start: 0, end });

      const stream = new ReadableStream({
        start(controller) {
          nodeStream.on("data", (chunk) => {
            try {
              controller.enqueue(chunk);
            } catch {
              nodeStream.destroy();
            }
          });
          nodeStream.on("end", () => {
            try {
              controller.close();
            } catch {
              // Ignore
            }
          });
          nodeStream.on("error", (err) => {
            nodeStream.destroy();
            try {
              controller.error(err);
            } catch {
              // Ignore
            }
          });
        },
        cancel() {
          nodeStream.destroy();
        },
      });

      return new NextResponse(stream as unknown as BodyInit, {
        status: 206,
        headers: {
          "Content-Range": `bytes 0-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": (end + 1).toString(),
          "Content-Type": ext === ".webm" ? "video/webm" : "video/mp4",
        },
      });
    }
  }

  // Live on-the-fly remuxing/transcoding/scaling for non-native video formats or custom quality resolutions
  try {
    let ffmpegPath: string | null = null;
    try {
      ffmpegPath = require("ffmpeg-static");
    } catch {
      ffmpegPath = null;
    }

    if (!ffmpegPath || typeof ffmpegPath !== "string" || !fs.existsSync(ffmpegPath)) {
      const possiblePaths = [
        path.join(process.cwd(), "node_modules", "ffmpeg-static", "ffmpeg.exe"),
        path.join(process.cwd(), "node_modules", "ffmpeg-static", "ffmpeg"),
      ];
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          ffmpegPath = p;
          break;
        }
      }
    }

    if (!ffmpegPath || !fs.existsSync(ffmpegPath)) {
      console.error("FFmpeg binary not found at:", ffmpegPath);
      return new NextResponse("FFmpeg not available", { status: 500 });
    }

    // Determine audio stream map index dynamically based on index or language keyword
    let audioMap = "0:a:0";
    if (audioParam) {
      if (/^\d+$/.test(audioParam)) {
        audioMap = `0:a:${audioParam}`;
      } else if (audioParam.includes("hindi") || audioParam.includes("hin")) {
        audioMap = "0:a:1";
      } else if (audioParam.includes("english") || audioParam.includes("eng")) {
        audioMap = "0:a:1";
      } else if (audioParam.includes("spanish") || audioParam.includes("spa")) {
        audioMap = "0:a:2";
      } else if (audioParam.includes("japanese") || audioParam.includes("jpn")) {
        audioMap = "0:a:3";
      } else if (audioParam.includes("korean") || audioParam.includes("kor") || audioParam.includes("original")) {
        audioMap = "0:a:0";
      }
    }

    const startTimeParam = searchParams.get("start") || searchParams.get("ss");
    const ssArgs = startTimeParam ? ["-ss", startTimeParam] : [];

    const ffmpegArgs = [
      "-probesize",
      "32k",
      "-analyzeduration",
      "0",
      ...ssArgs,
      "-i",
      absolutePath,
      "-map",
      "0:v:0?",
      "-map",
      `${audioMap}?`,
      "-c:v",
      heightScale ? "libx264" : "copy",
      ...(heightScale ? ["-vf", `scale=-2:${heightScale}`, "-preset", "ultrafast"] : []),
      "-c:a",
      "copy",
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

    ffProc.stderr.on("data", (data) => {
      console.error("[FFmpeg stderr]:", data.toString());
    });

    ffProc.on("error", (err) => {
      console.error("[FFmpeg process error]:", err);
      passThrough.destroy(err);
    });

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
  } catch (err) {
    console.error("FFmpeg streaming error:", err);
    return new NextResponse("Streaming error", { status: 500 });
  }
}
