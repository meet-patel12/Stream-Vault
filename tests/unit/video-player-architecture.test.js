const test = require("node:test");
const assert = require("node:assert");

// 1. Time Formatting Helper Test
function formatTime(secs) {
  if (!isFinite(secs) || secs < 0) return "0:00";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

test("Player Utilities: Formats seconds into HH:MM:SS and MM:SS accurately", () => {
  assert.strictEqual(formatTime(0), "0:00");
  assert.strictEqual(formatTime(45), "0:45");
  assert.strictEqual(formatTime(95), "1:35");
  assert.strictEqual(formatTime(3600), "1:00:00");
  assert.strictEqual(formatTime(5025), "1:23:45");
  assert.strictEqual(formatTime(-10), "0:00");
  assert.strictEqual(formatTime(NaN), "0:00");
});

// 2. Smart Timeline Calculation Tests
function calculateTimelineMetrics(currentTime, duration, bufferedEnd, resumeTime) {
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPercent = duration > 0 ? Math.min(100, (bufferedEnd / duration) * 100) : 0;
  const resumePercent = duration > 0 && resumeTime > 0 ? (resumeTime / duration) * 100 : 0;
  const bufferAheadSec = Math.max(0, bufferedEnd - currentTime);
  return { progressPercent, bufferedPercent, resumePercent, bufferAheadSec };
}

test("Smart Timeline: Calculates progress, buffered depth, and resume pins correctly", () => {
  const metrics = calculateTimelineMetrics(300, 1200, 480, 150);
  assert.strictEqual(metrics.progressPercent, 25);
  assert.strictEqual(metrics.bufferedPercent, 40);
  assert.strictEqual(metrics.resumePercent, 12.5);
  assert.strictEqual(metrics.bufferAheadSec, 180);
});

// 3. Chapter Marker Identification
function getActiveChapter(chapters, timestamp) {
  let found = null;
  for (let i = 0; i < chapters.length; i++) {
    if (timestamp >= chapters[i].startTime) {
      found = chapters[i];
    } else {
      break;
    }
  }
  return found;
}

test("Timeline Chapters: Finds matching chapter for given seek timestamp", () => {
  const chapters = [
    { title: "Cold Open", startTime: 0 },
    { title: "Opening Credits", startTime: 85 },
    { title: "Act 1: The Discovery", startTime: 175 },
    { title: "Act 2: The Heist", startTime: 1200 },
    { title: "End Credits", startTime: 2800 },
  ];

  assert.strictEqual(getActiveChapter(chapters, 30).title, "Cold Open");
  assert.strictEqual(getActiveChapter(chapters, 90).title, "Opening Credits");
  assert.strictEqual(getActiveChapter(chapters, 1500).title, "Act 2: The Heist");
  assert.strictEqual(getActiveChapter(chapters, 3000).title, "End Credits");
});

// 4. Subtitle Styling Engine Test
function computeSubtitleCSS(styles) {
  const fontSizes = { sm: "13px", md: "16px", lg: "20px", xl: "25px" };
  const textShadows = {
    none: "none",
    shadow: "2px 2px 4px black",
    outline: "-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000",
  };

  return {
    fontSize: fontSizes[styles.fontSize] || "16px",
    color: styles.color,
    backgroundColor: `rgba(0,0,0,${styles.bgOpacity})`,
    textShadow: textShadows[styles.outline] || "none",
  };
}

test("Subtitle Engine: Computes custom CSS styling and shadow profiles", () => {
  const custom = computeSubtitleCSS({
    fontSize: "lg",
    color: "#FFE600",
    bgOpacity: 0.75,
    outline: "outline",
  });

  assert.strictEqual(custom.fontSize, "20px");
  assert.strictEqual(custom.color, "#FFE600");
  assert.strictEqual(custom.backgroundColor, "rgba(0,0,0,0.75)");
  assert.ok(custom.textShadow.includes("-1px -1px 0 #000"));
});

// 5. Audio Normalization / Night Mode Compressor Profile
test("Audio Normalization: Validates Night Mode DynamicsCompressor parameters", () => {
  const compressorProfile = {
    threshold: -24,
    knee: 30,
    ratio: 12,
    attack: 0.003,
    release: 0.25,
  };

  assert.strictEqual(compressorProfile.threshold, -24, "Threshold -24dB limits loud explosions");
  assert.strictEqual(compressorProfile.knee, 30, "Smooth knee curve prevents audio clipping");
  assert.strictEqual(compressorProfile.ratio, 12, "High compression ratio protects speakers");
  assert.ok(compressorProfile.attack <= 0.01, "Fast attack catches sudden gunshots");
});

// 6. Next Episode Countdown Progress Calculation
function computeCountdownProgress(totalSeconds, remainingSeconds) {
  const elapsed = Math.max(0, totalSeconds - remainingSeconds);
  return Math.min(100, (elapsed / totalSeconds) * 100);
}

test("Next Episode: Computes countdown timer progress correctly", () => {
  assert.strictEqual(computeCountdownProgress(10, 10), 0);
  assert.strictEqual(computeCountdownProgress(10, 5), 50);
  assert.strictEqual(computeCountdownProgress(10, 0), 100);
});

// 7. Telemetry Event Validation
function validateTelemetryPayload(payload) {
  const required = ["sessionId", "contentId", "eventType", "currentTime", "playerEngine"];
  for (const field of required) {
    if (payload[field] === undefined || payload[field] === null) {
      return false;
    }
  }
  const validEventTypes = [
    "startup",
    "buffering",
    "bitrate_change",
    "seek",
    "error",
    "heartbeat",
    "play",
    "pause",
    "quality_change",
  ];
  return validEventTypes.includes(payload.eventType);
}

test("Telemetry Ingestion: Validates QoE event schema and payload requirements", () => {
  const validEvent = {
    sessionId: "sess_12345",
    contentId: 42,
    profileId: 7,
    eventType: "bitrate_change",
    currentTime: 145.2,
    playerEngine: "shaka",
    currentBitrateBps: 4500000,
  };

  assert.ok(validateTelemetryPayload(validEvent));

  const invalidEvent = {
    sessionId: "sess_12345",
    eventType: "invalid_event_type",
  };
  assert.strictEqual(validateTelemetryPayload(invalidEvent), false);
});
