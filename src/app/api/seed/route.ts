import { NextRequest, NextResponse } from "next/server";
import { seedDatabase } from "@/lib/seed-data";

export async function POST(request: NextRequest) {
  void request;
  // Only allow in non-production or with a secret
  const secret = request.headers.get("x-seed-secret");
  if (
    process.env.NODE_ENV === "production" &&
    secret !== process.env.SEED_SECRET
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await seedDatabase();
    return NextResponse.json({ success: true, message: "Database seeded." });
  } catch (err) {
    console.error("Seed error:", err);
    return NextResponse.json(
      { error: "Seed failed", details: String(err) },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  void request;
  // Always allowed in development
  try {
    await seedDatabase();
    return NextResponse.json({ success: true, message: "Database seeded." });
  } catch (err) {
    console.error("Seed error:", err);
    return NextResponse.json(
      { error: "Seed failed", details: String(err) },
      { status: 500 }
    );
  }
}
