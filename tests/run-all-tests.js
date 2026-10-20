const { spawn } = require("child_process");
const path = require("path");

console.log("=================================================");
console.log("🚀 STREAMVAULT FULL PLATFORM TEST SUITE RUNNER");
console.log("=================================================\n");

const testFiles = [
  "tests/unit/video-player-architecture.test.js",
  "tests/unit/payment-gateways.test.js",
  "tests/unit/totp-security.test.js",
  "tests/unit/recommendations-search.test.js",
  "tests/unit/api-optimization-caching.test.js",
  "tests/unit/production-streaming-architecture.test.js",
  "tests/integration/database-schema.test.js",
];

async function runTests() {
  let passed = 0;
  let failed = 0;

  for (const file of testFiles) {
    console.log(`▶ Running: ${file}...`);
    const code = await new Promise((resolve) => {
      const proc = spawn("node", ["--test", file], {
        stdio: "inherit",
        shell: true,
      });
      proc.on("close", resolve);
    });

    if (code === 0) {
      console.log(`✅ PASSED: ${file}\n`);
      passed++;
    } else {
      console.error(`❌ FAILED: ${file}\n`);
      failed++;
    }
  }

  console.log("=================================================");
  console.log(`📊 TEST RESULTS: ${passed} passed, ${failed} failed`);
  console.log("=================================================");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
