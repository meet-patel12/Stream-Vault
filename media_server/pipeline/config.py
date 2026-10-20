from dataclasses import dataclass
from typing import List, Dict, Any, Union
import os

@dataclass
class VideoRendition:
    name: str
    width: int
    height: int
    bitrate: int            # in bps
    max_bitrate: int        # in bps
    crf: int                # CRF (SVT-AV1, x264, x265, vp9)
    preset: Union[int, str] # Preset depending on codec
    codec: str = "av1"      # 'av1', 'h265', 'h264', or 'vp9'

# 1. High-efficiency SVT-AV1 ladder for modern devices & browsers (2160p to 240p)
DEFAULT_AV1_LADDER: List[VideoRendition] = [
    VideoRendition(name="2160p_av1", width=3840, height=2160, bitrate=8500000, max_bitrate=11000000, crf=24, preset=6, codec="av1"),
    VideoRendition(name="1440p_av1", width=2560, height=1440, bitrate=5200000, max_bitrate=6800000,  crf=26, preset=6, codec="av1"),
    VideoRendition(name="1080p_av1", width=1920, height=1080, bitrate=3200000, max_bitrate=4000000,  crf=28, preset=6, codec="av1"),
    VideoRendition(name="720p_av1",  width=1280, height=720,  bitrate=1800000, max_bitrate=2200000,  crf=32, preset=6, codec="av1"),
    VideoRendition(name="480p_av1",  width=854,  height=480,  bitrate=850000,  max_bitrate=1100000,  crf=36, preset=7, codec="av1"),
    VideoRendition(name="360p_av1",  width=640,  height=360,  bitrate=450000,  max_bitrate=600000,   crf=40, preset=8, codec="av1"),
    VideoRendition(name="240p_av1",  width=426,  height=240,  bitrate=220000,  max_bitrate=300000,   crf=42, preset=8, codec="av1"),
]

# 2. Next-Gen H.265 (HEVC / libx265) ladder for Apple devices & Smart 4K TVs
DEFAULT_H265_LADDER: List[VideoRendition] = [
    VideoRendition(name="2160p_h265", width=3840, height=2160, bitrate=9500000, max_bitrate=12000000, crf=22, preset="fast", codec="h265"),
    VideoRendition(name="1440p_h265", width=2560, height=1440, bitrate=5800000, max_bitrate=7200000,  crf=23, preset="fast", codec="h265"),
    VideoRendition(name="1080p_h265", width=1920, height=1080, bitrate=3400000, max_bitrate=4200000,  crf=24, preset="fast", codec="h265"),
    VideoRendition(name="720p_h265",  width=1280, height=720,  bitrate=1900000, max_bitrate=2400000,  crf=26, preset="fast", codec="h265"),
    VideoRendition(name="480p_h265",  width=854,  height=480,  bitrate=950000,  max_bitrate=1200000,  crf=28, preset="fast", codec="h265"),
    VideoRendition(name="360p_h265",  width=640,  height=360,  bitrate=500000,  max_bitrate=650000,   crf=30, preset="fast", codec="h265"),
    VideoRendition(name="240p_h265",  width=426,  height=240,  bitrate=240000,  max_bitrate=320000,   crf=32, preset="fast", codec="h265"),
]

# 3. Universal H.264 (libx264) fallback ladder for legacy hardware & Safari
DEFAULT_H264_LADDER: List[VideoRendition] = [
    VideoRendition(name="2160p_h264", width=3840, height=2160, bitrate=12500000, max_bitrate=16000000, crf=21, preset="faster", codec="h264"),
    VideoRendition(name="1440p_h264", width=2560, height=1440, bitrate=7200000,  max_bitrate=9000000,  crf=22, preset="faster", codec="h264"),
    VideoRendition(name="1080p_h264", width=1920, height=1080, bitrate=4500000,  max_bitrate=5500000,  crf=23, preset="faster", codec="h264"),
    VideoRendition(name="720p_h264",  width=1280, height=720,  bitrate=2500000,  max_bitrate=3000000,  crf=24, preset="faster", codec="h264"),
    VideoRendition(name="480p_h264",  width=854,  height=480,  bitrate=1200000,  max_bitrate=1500000,  crf=26, preset="faster", codec="h264"),
    VideoRendition(name="360p_h264",  width=640,  height=360,  bitrate=600000,   max_bitrate=800000,   crf=28, preset="faster", codec="h264"),
    VideoRendition(name="240p_h264",  width=426,  height=240,  bitrate=280000,   max_bitrate=380000,   crf=30, preset="faster", codec="h264"),
]

# 4. Google VP9 (libvpx-vp9) ladder for Android & YouTube compatibility
DEFAULT_VP9_LADDER: List[VideoRendition] = [
    VideoRendition(name="1080p_vp9", width=1920, height=1080, bitrate=3100000, max_bitrate=3800000, crf=31, preset="good", codec="vp9"),
    VideoRendition(name="720p_vp9",  width=1280, height=720,  bitrate=1750000, max_bitrate=2100000, crf=34, preset="good", codec="vp9"),
]

# Default ladder preserves backwards compatibility
DEFAULT_LADDER: List[VideoRendition] = DEFAULT_AV1_LADDER

SEGMENT_DURATION_SEC = 4
KEYFRAME_INTERVAL = 96  # 4 seconds at 24fps
TARGET_VMAF_SCORE = 93.0
SPRITE_THUMB_WIDTH = 160
SPRITE_THUMB_HEIGHT = 90
SPRITE_INTERVAL_SEC = 5
SPRITE_COLUMNS = 10

SUPPORTED_CONTAINERS = {
    ".mp4", ".mkv", ".mov", ".avi", ".webm", ".m4v", ".flv", ".ts", ".mpeg", ".wmv"
}

FFMPEG_BIN = os.getenv("FFMPEG_PATH", "ffmpeg")
FFPROBE_BIN = os.getenv("FFPROBE_PATH", "ffprobe")
SHAKA_PACKAGER_BIN = os.getenv("SHAKA_PACKAGER_PATH", "packager")
