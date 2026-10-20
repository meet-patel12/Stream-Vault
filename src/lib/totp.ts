import crypto from "crypto";

/**
 * RFC 6238 Time-Based One-Time Password (TOTP) Implementation
 * Standard 30-second window, 6 digits, HMAC-SHA1
 */

const BASE32_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function generateBase32Secret(length = 20): string {
  const randomBytes = crypto.randomBytes(length);
  let result = "";
  for (let i = 0; i < randomBytes.length; i++) {
    result += BASE32_CHARS[randomBytes[i] % 32];
  }
  return result;
}

function base32Decode(base32: string): Buffer {
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

export function generateTOTP(secret: string, timeStepSeconds = 30, windowOffset = 0): string {
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

/**
 * Verifies TOTP with ±1 step window tolerance (accommodates 30s clock drift)
 */
export function verifyTOTP(token: string, secret: string): boolean {
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

/**
 * Generates 8 single-use 10-character backup recovery codes
 */
export function generateBackupCodes(count = 8): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const code = crypto.randomBytes(5).toString("hex").toUpperCase();
    codes.push(`${code.slice(0, 5)}-${code.slice(5)}`);
  }
  return codes;
}

export function buildOtpAuthUrl(email: string, secret: string, issuer = "StreamVault"): string {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}
