import sys
from pathlib import Path

# Ensure workspace root is in sys.path
root_dir = Path(__file__).resolve().parent.parent.parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

import unittest
from media_server.pipeline.config import (
    SUPPORTED_CONTAINERS,
    DEFAULT_LADDER,
    DEFAULT_AV1_LADDER,
    DEFAULT_H264_LADDER,
)
from media_server.pipeline.transcoder import MediaPipeline, TranscodingError

class TestMediaPipeline(unittest.TestCase):
    def setUp(self):
        self.pipeline = MediaPipeline(work_dir="/tmp/test_stream")

    def test_supported_containers(self):
        for ext in [".mp4", ".mkv", ".mov", ".avi", ".webm", ".m4v", ".flv", ".ts", ".mpeg", ".wmv"]:
            self.assertIn(ext, SUPPORTED_CONTAINERS)

    def test_unsupported_container_raises(self):
        with self.assertRaises(TranscodingError):
            self.pipeline.probe("invalid_video.txt")

    def test_ladder_configuration(self):
        self.assertEqual(len(DEFAULT_LADDER), 4)
        names = [r.name for r in DEFAULT_LADDER]
        self.assertEqual(names, ["1080p", "720p", "480p", "360p"])
        for r in DEFAULT_AV1_LADDER:
            self.assertEqual(r.codec, "av1")

    def test_dual_codec_configuration(self):
        self.assertEqual(len(DEFAULT_H264_LADDER), 3)
        h264_names = [r.name for r in DEFAULT_H264_LADDER]
        self.assertIn("1080p_h264", h264_names)
        self.assertIn("720p_h264", h264_names)
        self.assertIn("480p_h264", h264_names)
        for r in DEFAULT_H264_LADDER:
            self.assertEqual(r.codec, "h264")

    def test_verify_video_integrity_missing_file_raises(self):
        with self.assertRaises(TranscodingError):
            self.pipeline.verify_video_integrity("non_existent_file.mp4")

if __name__ == "__main__":
    unittest.main()
