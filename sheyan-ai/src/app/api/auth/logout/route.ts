import { NextResponse } from "next/server";
import { detachSessionCookie } from "@/lib/auth";

export async function POST() {
  return detachSessionCookie(NextResponse.json({ success: true }));
}
