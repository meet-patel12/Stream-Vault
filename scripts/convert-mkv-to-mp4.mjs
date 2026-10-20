import ffmpegPath from "ffmpeg-static";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";

const videosDir = path.join(process.cwd(), "public", "videos");

async function convertFile(inputFile, outputFile) {
  return new Promise((resolve, reject) => {
    console.log(`🎬 Fast converting (stream copy) ${path.basename(inputFile)} -> ${path.basename(outputFile)}...`);
    const startTime = Date.now();

    const args = [
      "-y",
      "-i", inputFile,
      "-c:v", "copy",
      "-c:a", "copy",
      "-movflags", "+faststart",
      outputFile
    ];

    const proc = spawn(ffmpegPath, args, { stdio: ["ignore", "inherit", "inherit"] });

    proc.on("close", (code) => {
      if (code === 0) {
        console.log(`✅ Finished ${path.basename(outputFile)} in ${((Date.now() - startTime) / 1000).toFixed(1)}s!`);
        resolve(true);
      } else {
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });
  });
}

async function run() {
  const files = fs.readdirSync(videosDir).filter(f => f.endsWith(".mkv"));
  console.log(`Found ${files.length} MKV files to convert to native MP4 for instant range loading:`);
  for (const file of files) {
    const inputPath = path.join(videosDir, file);
    const outputName = file.replace(/\.mkv$/i, ".mp4");
    const outputPath = path.join(videosDir, outputName);
    if (fs.existsSync(outputPath)) {
      console.log(`⏩ ${outputName} already exists, skipping.`);
      continue;
    }
    await convertFile(inputPath, outputPath);
  }
  console.log("🎉 All MKV files converted to native faststart MP4!");
}

run().catch(console.error);
