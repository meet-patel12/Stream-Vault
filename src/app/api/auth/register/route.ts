import { NextRequest } from "next/server";
import { db } from "@/db";
import { users, profiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  hashPassword,
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
  const rl = rateLimit(`auth:register:${ip}`, RATE_LIMITS.auth);
  if (!rl.allowed) {
    return errorResponse("Too many registration attempts. Try again later.", 429, "RATE_LIMITED");
  }

  try {
    const body = await request.json();
    const { email, password, name } = body;

    // Validation
    if (!email || !password || !name) {
      return validationErrorResponse("Email, password, and name are required.");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return validationErrorResponse("Invalid email format.");
    }

    if (password.length < 8) {
      return validationErrorResponse("Password must be at least 8 characters.");
    }

    if (name.trim().length < 2) {
      return validationErrorResponse("Name must be at least 2 characters.");
    }

    // Check existing user
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (existing.length > 0) {
      return errorResponse("An account with this email already exists.", 409, "EMAIL_EXISTS");
    }

    const passwordHash = await hashPassword(password);

    const [newUser] = await db
      .insert(users)
      .values({
        email: email.toLowerCase(),
        passwordHash,
        role: "user",
        plan: "basic",
        emailVerified: true, // auto-verify for demo
      })
      .returning();

    // Create default profile
    const [newProfile] = await db
      .insert(profiles)
      .values({
        userId: newUser.id,
        name: name.trim(),
        avatarColor: "#E50914",
        avatarEmoji: "🎬",
      })
      .returning();

    // Generate tokens
    const jwtPayload: JWTPayload = {
      sub: String(newUser.id),
      email: newUser.email,
      role: newUser.role,
      plan: newUser.plan,
    };

    const accessToken = await generateAccessToken(jwtPayload);
    const refreshToken = await generateRefreshToken();
    await storeRefreshToken(newUser.id, refreshToken);
    await setAuthCookies(accessToken, refreshToken);

    return successResponse(
      {
        user: {
          id: newUser.id,
          email: newUser.email,
          role: newUser.role,
          plan: newUser.plan,
        },
        profile: newProfile,
      },
      201
    );
  } catch (err) {
    console.error("Registration error:", err);
    return internalErrorResponse();
  }
}
