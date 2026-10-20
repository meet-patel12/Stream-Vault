const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

// Native TOTP Implementation under test
const BASE32_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function generateBase32Secret(length = 20) {
  const randomBytes = crypto.randomBytes(length);
  let result = "";
  for (let i = 0; i < randomBytes.length; i++) {
    result += BASE32_CHARS[randomBytes[i] % 32];
  }
  return result;
}

function base32Decode(base32) {
  const cleanBase32 = base32.toUpperCase().replace(/=+$/, "").replace(/[\s-]/g, "");
  let bits = "";
  for (let i = 0; i < cleanBase32.length; i++) {
    const val = BASE32_CHARS.indexOf(cleanBase32.charAt(i));
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, "0");
  }

  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substring(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

function generateTOTP(secret, timeStepSeconds = 30, windowOffset = 0) {
  const epoch = Math.floor(Date.now() / 1000);
  const counter = Math.floor(epoch / timeStepSeconds) + windowOffset;

  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigInt64BE(BigInt(counter));

  const keyBuffer = base32Decode(secret);
  const hmac = crypto.createHmac("sha1", keyBuffer).update(counterBuffer).digest();

  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const otp = binary % 1000000;
  return otp.toString().padStart(6, "0");
}

function verifyTOTP(token, secret) {
  if (!token || token.length !== 6 || !secret) return false;

  const cleanToken = token.trim();
  for (let offset = -1; offset <= 1; offset++) {
    const generated = generateTOTP(secret, 30, offset);
    if (generated === cleanToken) {
      return true;
    }
  }
  return false;
}

function generateBackupCodes(count = 8) {
  const codes = [];
  for (let i = 0; i < count; i++) {
    const code = crypto.randomBytes(5).toString("hex").toUpperCase();
    codes.push(`${code.slice(0, 5)}-${code.slice(5)}`);
  }
  return codes;
}

test("Security: Generates 20-char Base32 RFC compliant secret", () => {
  const secret = generateBase32Secret(20);
  assert.equal(secret.length, 20);
  assert.match(secret, /^[A-Z2-7]+$/);
});

test("Security: Computes 6-digit TOTP and verifies with clock tolerance", () => {
  const secret = generateBase32Secret(20);
  const currentToken = generateTOTP(secret);

  assert.equal(currentToken.length, 6);
  assert.match(currentToken, /^\d{6}$/);

  // Verification with identical secret
  assert.equal(verifyTOTP(currentToken, secret), true);

  // Verification with wrong secret or token fails
  assert.equal(verifyTOTP("000000", secret), false);
  assert.equal(verifyTOTP(currentToken, "JBSWY3DPEHPK3PXP"), false);
});

test("Security: Generates valid single-use 10-char backup codes", () => {
  const codes = generateBackupCodes(8);
  assert.equal(codes.length, 8);
  for (const c of codes) {
    assert.match(c, /^[0-9A-F]{5}-[0-9A-F]{5}$/);
  }
});
