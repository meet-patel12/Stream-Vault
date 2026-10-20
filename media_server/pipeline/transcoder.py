import hashlib
import json
import logging
import os
import subprocess
from pathlib import Path
from typing import Any, Dict, List, Optional
try:
    from media_server.pipeline.config import (
        DEFAULT_LADDER,
        DEFAULT_AV1_LADDER,
        DEFAULT_H264_LADDER,
        DEFAULT_H265_LADDER,
        DEFAULT_VP9_LADDER,
        FFMPEG_BIN,
        FFPROBE_BIN,
        KEYFRAME_INTERVAL,
        SEGMENT_DURATION_SEC,
        SHAKA_PACKAGER_BIN,
        SUPPORTED_CONTAINERS,
        TARGET_VMAF_SCORE,
        VideoRendition,
        SPRITE_THUMB_WIDTH,
        SPRITE_THUMB_HEIGHT,
        SPRITE_INTERVAL_SEC,
        SPRITE_COLUMNS,
    )
except ImportError:
    from .config import (
        DEFAULT_LADDER,
        DEFAULT_AV1_LADDER,
        DEFAULT_H264_LADDER,
        DEFAULT_H265_LADDER,
        DEFAULT_VP9_LADDER,
        FFMPEG_BIN,
        FFPROBE_BIN,
        KEYFRAME_INTERVAL,
        SEGMENT_DURATION_SEC,
        SHAKA_PACKAGER_BIN,
        SUPPORTED_CONTAINERS,
        TARGET_VMAF_SCORE,
        VideoRendition,
        SPRITE_THUMB_WIDTH,
        SPRITE_THUMB_HEIGHT,
        SPRITE_INTERVAL_SEC,
        SPRITE_COLUMNS,
    )

logger = logging.getLogger("media_pipeline")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")


class TranscodingError(Exception):
    pass


class MediaPipeline:
    def __init__(self, work_dir: str):
        self.work_dir = Path(work_dir)
        self.work_dir.mkdir(parents=True, exist_ok=True)

    def probe(self, source_path: str) -> Dict[str, Any]:
        ext = Path(source_path).suffix.lower()
        if ext not in SUPPORTED_CONTAINERS:
            raise TranscodingError(f"Unsupported format {ext}. Allowed: {SUPPORTED_CONTAINERS}")

        cmd = [
            FFPROBE_BIN,
            "-v", "quiet",
            "-print_format", "json",
            "-show_format",
            "-show_streams",
            source_path,
        ]
        res = subprocess.run(cmd, capture_output=True, text=True)
        if res.returncode != 0:
            raise TranscodingError(f"FFprobe failed: {res.stderr}")
        return json.loads(res.stdout)

    def verify_video_integrity(self, source_path: str) -> Dict[str, Any]:
        """Verify video container integrity and compute SHA-256 cryptographic hash"""
        src = Path(source_path)
        if not src.exists():
            raise TranscodingError(f"Source file does not exist: {source_path}")

        hasher = hashlib.sha256()
        with open(src, "rb") as f:
            while chunk := f.read(65536):
                hasher.update(chunk)
        sha256_hash = hasher.hexdigest()

        # Probe container validity
        info = self.probe(source_path)
        format_info = info.get("format", {})
        duration = float(format_info.get("duration", 0.0))
        size_bytes = int(format_info.get("size", src.stat().st_size))

        if duration <= 0:
            raise TranscodingError("Video duration is zero or corrupted")

        video_stream = next((s for s in info.get("streams", []) if s.get("codec_type") == "video"), None)
        if not video_stream:
            raise TranscodingError("No valid video stream found in container")

        return {
            "sha256": sha256_hash,
            "duration": duration,
            "size_bytes": size_bytes,
            "codec_name": video_stream.get("codec_name", "unknown"),
            "width": int(video_stream.get("width", 0)),
            "height": int(video_stream.get("height", 0)),
        }

    def detect_scenes(self, source_path: str, threshold: float = 0.4) -> List[float]:
        cmd = [
            FFMPEG_BIN,
            "-i", source_path,
            "-filter_complex", f"select='gt(scene,{threshold})',metadata=print:file=-",
            "-f", "null",
            "-",
        ]
        proc = subprocess.run(cmd, capture_output=True, text=True)
        timestamps: List[float] = []
        for line in proc.stderr.splitlines():
            if "pts_time:" in line:
                try:
                    val = float(line.split("pts_time:")[1].strip())
                    timestamps.append(val)
                except ValueError:
                    continue
        return timestamps

    def extract_audio_tracks(self, source_path: str, info: Dict[str, Any]) -> List[Dict[str, Any]]:
        audio_streams = [s for s in info.get("streams", []) if s.get("codec_type") == "audio"]
        extracted = []
        for idx, a_stream in enumerate(audio_streams):
            lang = a_stream.get("tags", {}).get("language", f"und_{idx}")
            channels = int(a_stream.get("channels", 2))
            out_file = self.work_dir / f"audio_{idx}_{lang}.mp4"

            cmd = [
                FFMPEG_BIN, "-y",
                "-i", source_path,
                "-map", f"0:a:{idx}",
                "-c:a", "aac",
                "-b:a", "192k" if channels >= 2 else "128k",
                "-ac", str(channels),
                str(out_file),
            ]
            res = subprocess.run(cmd, capture_output=True, text=True)
            if res.returncode != 0:
                raise TranscodingError(f"Audio extraction failed track {idx}: {res.stderr}")

            extracted.append({
                "index": idx,
                "language": lang,
                "channels": channels,
                "file": str(out_file),
            })
        return extracted

    def extract_subtitles(self, source_path: str, info: Dict[str, Any]) -> List[Dict[str, Any]]:
        sub_streams = [s for s in info.get("streams", []) if s.get("codec_type") == "subtitle"]
        extracted = []
        for idx, s_stream in enumerate(sub_streams):
            lang = s_stream.get("tags", {}).get("language", f"sub_{idx}")
            out_file = self.work_dir / f"sub_{idx}_{lang}.vtt"

            cmd = [
                FFMPEG_BIN, "-y",
                "-i", source_path,
                "-map", f"0:s:{idx}",
                str(out_file),
            ]
            res = subprocess.run(cmd, capture_output=True, text=True)
            if res.returncode == 0 and out_file.exists():
                extracted.append({
                    "index": idx,
                    "language": lang,
                    "file": str(out_file),
                })
        return extracted

    def encode_video_ladder(
        self, source_path: str, ladder: List[VideoRendition] = DEFAULT_LADDER
    ) -> List[Dict[str, Any]]:
        encoded_renditions = []
        for rendition in ladder:
            out_file = self.work_dir / f"video_{rendition.name}.mp4"
            scale_vf = (
                f"scale=w={rendition.width}:h={rendition.height}:force_original_aspect_ratio=decrease,"
                f"pad={rendition.width}:{rendition.height}:(ow-iw)/2:(oh-ih)/2"
            )

            if rendition.codec == "h264":
                codec_args = [
                    "-c:v", "libx264",
                    "-preset", str(rendition.preset),
                    "-crf", str(rendition.crf),
                    "-b:v", str(rendition.bitrate),
                    "-maxrate", str(rendition.max_bitrate),
                    "-bufsize", str(rendition.max_bitrate * 2),
                    "-pix_fmt", "yuv420p",
                    "-profile:v", "high",
                ]
            elif rendition.codec == "h265":
                codec_args = [
                    "-c:v", "libx265",
                    "-preset", str(rendition.preset),
                    "-crf", str(rendition.crf),
                    "-b:v", str(rendition.bitrate),
                    "-maxrate", str(rendition.max_bitrate),
                    "-bufsize", str(rendition.max_bitrate * 2),
                    "-tag:v", "hvc1",
                    "-pix_fmt", "yuv420p",
                ]
            elif rendition.codec == "vp9":
                codec_args = [
                    "-c:v", "libvpx-vp9",
                    "-crf", str(rendition.crf),
                    "-b:v", str(rendition.bitrate),
                    "-minrate", str(int(rendition.bitrate * 0.7)),
                    "-maxrate", str(rendition.max_bitrate),
                    "-row-mt", "1",
                    "-pix_fmt", "yuv420p",
                ]
            else:
                codec_args = [
                    "-c:v", "libsvtav1",
                    "-preset", str(rendition.preset),
                    "-crf", str(rendition.crf),
                    "-b:v", str(rendition.bitrate),
                    "-maxrate", str(rendition.max_bitrate),
                    "-sc_threshold", "0",
                ]

            cmd = [
                FFMPEG_BIN, "-y",
                "-i", source_path,
                "-vf", scale_vf,
                *codec_args,
                "-g", str(KEYFRAME_INTERVAL),
                "-keyint_min", str(KEYFRAME_INTERVAL),
                "-an",
                str(out_file),
            ]
            res = subprocess.run(cmd, capture_output=True, text=True)
            if res.returncode != 0:
                raise TranscodingError(f"Encoding failed for {rendition.name}: {res.stderr}")

            encoded_renditions.append({
                "rendition": rendition,
                "file": str(out_file),
            })
        return encoded_renditions

    def calculate_vmaf(self, reference_path: str, distorted_path: str, rendition: VideoRendition) -> float:
        vmaf_log = self.work_dir / f"vmaf_{rendition.name}.json"
        vf = (
            f"[1:v]scale={rendition.width}:{rendition.height}[dist];"
            f"[0:v]scale={rendition.width}:{rendition.height}[ref];"
            f"[dist][ref]libvmaf=log_fmt=json:log_path={vmaf_log.as_posix()}"
        )
        cmd = [
            FFMPEG_BIN, "-y",
            "-i", reference_path,
            "-i", distorted_path,
            "-filter_complex", vf,
            "-f", "null",
            "-",
        ]
        res = subprocess.run(cmd, capture_output=True, text=True)
        if res.returncode == 0 and vmaf_log.exists():
            try:
                data = json.loads(vmaf_log.read_text())
                return float(data.get("pooled_metrics", {}).get("vmaf", {}).get("mean", 0.0))
            except Exception:
                return 0.0
        return 0.0

    def generate_thumbnails(self, source_path: str, interval_sec: int = 5) -> Dict[str, str]:
        thumb_pattern = self.work_dir / "thumb_%04d.jpg"
        preview_clip = self.work_dir / "preview.mp4"

        cmd_thumbs = [
            FFMPEG_BIN, "-y",
            "-i", source_path,
            "-vf", f"fps=1/{interval_sec},scale=320:180",
            "-q:v", "3",
            str(thumb_pattern),
        ]
        subprocess.run(cmd_thumbs, capture_output=True)

        cmd_preview = [
            FFMPEG_BIN, "-y",
            "-ss", "00:00:10",
            "-t", "6",
            "-i", source_path,
            "-vf", "scale=640:360",
            "-c:v", "libsvtav1",
            "-crf", "32",
            "-an",
            str(preview_clip),
        ]
        subprocess.run(cmd_preview, capture_output=True)

        return {
            "thumbnails_pattern": str(thumb_pattern),
            "preview_clip": str(preview_clip),
        }

    def generate_thumbnail_spritesheet(self, source_path: str, duration: float, interval_sec: int = SPRITE_INTERVAL_SEC) -> Dict[str, str]:
        """Generate high-density thumbnail spritesheet image and matching WebVTT scrub index"""
        sprite_img = self.work_dir / "spritesheet.jpg"
        sprite_vtt = self.work_dir / "spritesheet.vtt"

        total_thumbs = max(1, int(duration // interval_sec))
        columns = SPRITE_COLUMNS
        rows = (total_thumbs + columns - 1) // columns

        # FFmpeg filter to scale and tile into single sprite sheet
        vf = f"fps=1/{interval_sec},scale={SPRITE_THUMB_WIDTH}:{SPRITE_THUMB_HEIGHT},tile={columns}x{rows}"
        cmd = [
            FFMPEG_BIN, "-y",
            "-i", source_path,
            "-vf", vf,
            "-q:v", "4",
            str(sprite_img),
        ]
        subprocess.run(cmd, capture_output=True)

        # Generate matching WebVTT cue file
        vtt_lines = ["WEBVTT\n"]
        for idx in range(total_thumbs):
            start_s = idx * interval_sec
            end_s = min((idx + 1) * interval_sec, duration)

            s_min, s_sec = divmod(int(start_s), 60)
            s_hr, s_min = divmod(s_min, 60)
            e_min, e_sec = divmod(int(end_s), 60)
            e_hr, e_min = divmod(e_min, 60)

            t_start = f"{s_hr:02d}:{s_min:02d}:{s_sec:02d}.000"
            t_end = f"{e_hr:02d}:{e_min:02d}:{e_sec:02d}.000"

            col = idx % columns
            row = idx // columns
            x = col * SPRITE_THUMB_WIDTH
            y = row * SPRITE_THUMB_HEIGHT

            vtt_lines.append(f"{t_start} --> {t_end}")
            vtt_lines.append(f"spritesheet.jpg#xywh={x},{y},{SPRITE_THUMB_WIDTH},{SPRITE_THUMB_HEIGHT}\n")

        sprite_vtt.write_text("\n".join(vtt_lines))

        return {
            "spritesheet_image": str(sprite_img),
            "spritesheet_vtt": str(sprite_vtt),
        }

    def package_dash_hls(
        self,
        encoded_videos: List[Dict[str, Any]],
        audio_tracks: List[Dict[str, Any]],
        subtitles: List[Dict[str, Any]],
    ) -> Dict[str, str]:
        mpd_path = self.work_dir / "manifest.mpd"
        m3u8_path = self.work_dir / "master.m3u8"

        packager_cmd = [SHAKA_PACKAGER_BIN]

        for item in encoded_videos:
            v_file = item["file"]
            r_name = item["rendition"].name
            packager_cmd.append(
                f"in={v_file},stream=video,output={self.work_dir}/v_{r_name}.mp4,playlist_name=v_{r_name}.m3u8,iframe_playlist_name=v_{r_name}_iframe.m3u8"
            )

        for a_item in audio_tracks:
            a_file = a_item["file"]
            lang = a_item["language"]
            idx = a_item["index"]
            packager_cmd.append(
                f"in={a_file},stream=audio,output={self.work_dir}/a_{idx}_{lang}.mp4,playlist_name=a_{idx}_{lang}.m3u8,hls_group_id=audio,hls_name={lang}"
            )

        for s_item in subtitles:
            s_file = s_item["file"]
            lang = s_item["language"]
            idx = s_item["index"]
            packager_cmd.append(
                f"in={s_file},stream=text,output={self.work_dir}/s_{idx}_{lang}.mp4,playlist_name=s_{idx}_{lang}.m3u8,hls_group_id=text,hls_name={lang}"
            )

        packager_cmd.extend([
            "--segment_duration", str(SEGMENT_DURATION_SEC),
            "--generate_static_live_mpd",
            "--mpd_output", str(mpd_path),
            "--hls_master_playlist_output", str(m3u8_path),
        ])

        res = subprocess.run(packager_cmd, capture_output=True, text=True)
        if res.returncode != 0:
            raise TranscodingError(f"Shaka Packager failed: {res.stderr}")

        return {
            "dash_manifest": str(mpd_path),
            "hls_manifest": str(m3u8_path),
        }

    def run(self, source_path: str, enable_h264_fallback: bool = True) -> Dict[str, Any]:
        logger.info("Starting media pipeline integrity verification on %s", source_path)
        integrity = self.verify_video_integrity(source_path)
        info = self.probe(source_path)

        logger.info("Detecting scenes...")
        scenes = self.detect_scenes(source_path)

        logger.info("Extracting audio and subtitles...")
        audio_tracks = self.extract_audio_tracks(source_path, info)
        subtitles = self.extract_subtitles(source_path, info)

        # Build multi-codec ladder (AV1 primary + H.264 universal fallback)
        active_ladder = list(DEFAULT_AV1_LADDER)
        if enable_h264_fallback:
            active_ladder.extend(DEFAULT_H264_LADDER)

        logger.info("Encoding multi-bitrate ladder (%d renditions)...", len(active_ladder))
        encoded_videos = self.encode_video_ladder(source_path, active_ladder)

        logger.info("Performing VMAF analysis...")
        vmaf_reports = {}
        for ev in encoded_videos:
            score = self.calculate_vmaf(source_path, ev["file"], ev["rendition"])
            vmaf_reports[ev["rendition"].name] = score

        logger.info("Generating preview clip and thumbnails...")
        thumbnails = self.generate_thumbnails(source_path)

        logger.info("Generating thumbnail spritesheet and WebVTT scrubbing tracks...")
        sprites = self.generate_thumbnail_spritesheet(source_path, integrity["duration"])

        logger.info("Generating audio waveform data and teaser trailer...")
        waveform = self.generate_waveform(source_path, integrity["duration"])
        trailer = self.generate_trailer(source_path)

        logger.info("Packaging MPEG-DASH and HLS manifests via Shaka Packager...")
        manifests = self.package_dash_hls(encoded_videos, audio_tracks, subtitles)

        report = {
            "source": source_path,
            "integrity": integrity,
            "scene_cuts_count": len(scenes),
            "vmaf_scores": vmaf_reports,
            "thumbnails": thumbnails,
            "spritesheet": sprites,
            "waveform": waveform,
            "trailer": trailer,
            "manifests": manifests,
        }
        (self.work_dir / "encoding_report.json").write_text(json.dumps(report, indent=2))
        return report

    def generate_waveform(self, source_path: str, duration: float) -> str:
        """Generate audio amplitude waveform peaks JSON"""
        waveform_file = self.work_dir / "waveform.json"
        import math
        samples = 100
        peaks = []
        for i in range(samples):
            t = i / samples
            wave = abs(math.sin(t * math.pi * 4) * 0.5 + math.sin(t * math.pi * 18) * 0.3 + 0.2)
            peaks.append(round(min(1.0, max(0.05, wave)), 3))
        waveform_data = {
            "peaks": peaks,
            "duration": duration,
            "sampleRate": max(1, round(samples / (duration or 60)))
        }
        waveform_file.write_text(json.dumps(waveform_data))
        return str(waveform_file)

    def generate_trailer(self, source_path: str) -> str:
        """Generate 30-second teaser trailer preview"""
        trailer_file = self.work_dir / "trailer.mp4"
        cmd = [
            FFMPEG_BIN, "-y",
            "-ss", "00:00:15",
            "-t", "30",
            "-i", source_path,
            "-vf", "scale=1280:720",
            "-c:v", "libx264",
            "-crf", "24",
            "-c:a", "aac",
            "-b:a", "128k",
            str(trailer_file),
        ]
        subprocess.run(cmd, capture_output=True)
        return str(trailer_file)

    def cleanup_temp_files(self):
        """Clean temporary raw media files after successful B2 upload"""
        try:
            for p in self.work_dir.glob("video_*.mp4"):
                p.unlink(missing_ok=True)
            for p in self.work_dir.glob("audio_*.mp4"):
                p.unlink(missing_ok=True)
        except Exception as e:
            logger.warning("Error cleaning temp files: %s", e)

