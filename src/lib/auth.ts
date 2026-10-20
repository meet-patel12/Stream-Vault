import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import { users, refreshTokens, profiles } from "@/db/schema";
import { eq, and, gt } from "drizzle-orm";
import crypto from "crypto";

const ACCESS_TOKEN_SECRET = new TextEncoder().encode(
  process.env.JWT_ACCESS_SECRET ?? "access-secret-change-in-production-32chars"
);
const REFRESH_TOKEN_SECRET = new TextEncoder().encode(
  process.env.JWT_REFRESH_SECRET ??
    "refresh-secret-change-in-production-32chars"
);

export const ACCESS_TOKEN_EXPIRY = "15m";
export const REFRESH_TOKEN_EXPIRY_DAYS = 30;

export interface JWTPayload {
  sub: string; // user id
  email: string;
  role: "admin" | "user";
  plan: string;
  iat?: number;
  exp?: number;
}

// ─── Token Generation ─────────────────────────────────────────────────────────
export async function generateAccessToken(payload: JWTPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .sign(ACCESS_TOKEN_SECRET);
}

export async function generateRefreshToken(): Promise<string> {
  return crypto.randomBytes(64).toString("hex");
}

export async function verifyAccessToken(
  token: string
): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, ACCESS_TOKEN_SECRET);
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

export async function verifyRefreshToken(
  token: string
): Promise<{ userId: number } | null> {
  try {
    const tokenHash = hashToken(token);
    const [record] = await db
      .select()
      .from(refreshTokens)
      .where(
        and(
          eq(refreshTokens.tokenHash, tokenHash),
          gt(refreshTokens.expiresAt, new Date())
        )
      )
      .limit(1);

    if (!record || record.revokedAt) return null;
    return { userId: record.userId };
  } catch {
    return null;
  }
}

// ─── Token Storage ────────────────────────────────────────────────────────────
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function storeRefreshToken(
  userId: number,
  token: string
): Promise<void> {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

  await db.insert(refreshTokens).values({
    userId,
    tokenHash: hashToken(token),
    expiresAt,
  });
}

export async function revokeRefreshToken(token: string): Promise<void> {
  const tokenHash = hashToken(token);
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(eq(refreshTokens.tokenHash, tokenHash));
}

export async function revokeAllUserRefreshTokens(
  userId: number
): Promise<void> {
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(eq(refreshTokens.userId, userId), gt(refreshTokens.expiresAt, new Date()))
    );
}

// ─── Cookie Management ────────────────────────────────────────────────────────
export async function setAuthCookies(
  accessToken: string,
  refreshToken: string
): Promise<void> {
  try {
    const cookieStore = await cookies();

    cookieStore.set("access_token", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 15, // 15 minutes
      path: "/",
    });

    cookieStore.set("refresh_token", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * REFRESH_TOKEN_EXPIRY_DAYS,
      path: "/",
    });
  } catch {
    // In Next.js App Router, modifying cookies in a Server Component (page/layout) throws an error.
    // We catch it so session reading succeeds safely. Cookies are persisted via Route Handlers.
  }
}

export async function clearAuthCookies(): Promise<void> {
  try {
    const cookieStore = await cookies();
    cookieStore.delete("access_token");
    cookieStore.delete("refresh_token");
  } catch {
    // Catch cookie deletion error in Server Components
  }
}

// ─── Session Retrieval ────────────────────────────────────────────────────────
export async function getServerSession(): Promise<JWTPayload | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("access_token")?.value;

  if (!accessToken) return null;

  const payload = await verifyAccessToken(accessToken);
  return payload;
}

export async function getSessionOrRefresh(): Promise<JWTPayload | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("access_token")?.value;

  if (accessToken) {
    const payload = await verifyAccessToken(accessToken);
    if (payload) return payload;
  }

  // Try refresh
  const refreshToken = cookieStore.get("refresh_token")?.value;
  if (!refreshToken) return null;

  const result = await verifyRefreshToken(refreshToken);
  if (!result) return null;

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, result.userId))
    .limit(1);

  if (!user) return null;

  // Rotate refresh token
  await revokeRefreshToken(refreshToken);
  const newRefreshToken = await generateRefreshToken();
  await storeRefreshToken(user.id, newRefreshToken);

  const jwtPayload: JWTPayload = {
    sub: String(user.id),
    email: user.email,
    role: user.role,
    plan: user.plan,
  };
  const newAccessToken = await generateAccessToken(jwtPayload);
  await setAuthCookies(newAccessToken, newRefreshToken);

  return jwtPayload;
}

// ─── Password Utilities ───────────────────────────────────────────────────────
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ─── Auth helpers ─────────────────────────────────────────────────────────────
export async function requireAuth(): Promise<JWTPayload> {
  const session = await getSessionOrRefresh();
  if (!session) {
    throw new Error("UNAUTHORIZED");
  }
  return session;
}

export async function requireAdmin(): Promise<JWTPayload> {
  const session = await requireAuth();
  if (session.role !== "admin") {
    throw new Error("FORBIDDEN");
  }
  return session;
}

export async function getUserWithProfiles(userId: number) {
  const user = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user[0]) return null;

  const userProfiles = await db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, userId));

  return { ...user[0], profiles: userProfiles };
}
