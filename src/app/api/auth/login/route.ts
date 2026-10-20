import { NextRequest } from "next/server";
import { db } from "@/db";
import { users, profiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  comparePassword,
  generateAccessToken,
  generateRefreshToken,
  storeRefreshToken,
  setAuthCookies,
  type JWTPayload,
} from "@/lib/auth";
import {
  successResponse,
  errorResponse,
  validationErrorResponse,
  internalErrorResponse,
} from "@/lib/api-response";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const rl = rateLimit(`auth:login:${ip}`, RATE_LIMITS.auth);
  if (!rl.allowed) {
    return errorResponse("Too many login attempts. Try again in 15 minutes.", 429, "RATE_LIMITED");
  }

  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return validationErrorResponse("Email and password are required.");
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    // Constant-time comparison to prevent user enumeration
    const dummyHash = "$2b$12$notarealhashjustfortimingggggggggggggggggggggg";
    const isValid = user
      ? await comparePassword(password, user.passwordHash)
      : await comparePassword(password, dummyHash);

    if (!user || !isValid) {
      return errorResponse("Invalid email or password.", 401, "INVALID_CREDENTIALS");
    }

    const userProfiles = await db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, user.id));

    const jwtPayload: JWTPayload = {
      sub: String(user.id),
      email: user.email,
      role: user.role,
      plan: user.plan,
    };

    const accessToken = await generateAccessToken(jwtPayload);
    const refreshToken = await generateRefreshToken();
    await storeRefreshToken(user.id, refreshToken);
    await setAuthCookies(accessToken, refreshToken);

    return successResponse({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        plan: user.plan,
      },
      profiles: userProfiles,
    });
  } catch (err) {
    console.error("Login error:", err);
    return internalErrorResponse();
  }
}
