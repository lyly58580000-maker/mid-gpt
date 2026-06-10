import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";

export const SESSION_COOKIE = "sheyan_session";

export type SessionPayload = {
  userId: string;
  email: string;
  role: UserRole;
  nickname: string | null;
};

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(payload: SessionPayload) {
  const expiresIn = payload.role === "ADMIN" ? "1d" : "7d";
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getSecret());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function getSessionFromRequest(req: NextRequest): Promise<SessionPayload | null> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

function getSessionCookieOptions(role: UserRole = "USER") {
  const maxAge = role === "ADMIN" ? 60 * 60 * 24 : 60 * 60 * 24 * 7;
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge,
  };
}

export function attachSessionCookie<T>(
  response: NextResponse<T>,
  token: string,
  role: UserRole = "USER",
) {
  response.cookies.set(SESSION_COOKIE, token, getSessionCookieOptions(role));
  return response;
}

export function detachSessionCookie<T>(response: NextResponse<T>) {
  response.cookies.delete(SESSION_COOKIE);
  return response;
}

export async function setSessionCookie(token: string, role: UserRole = "USER") {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, getSessionCookieOptions(role));
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export function requireSession(session: SessionPayload | null): SessionPayload {
  if (!session) throw new Error("UNAUTHORIZED");
  return session;
}

export function requireAdmin(session: SessionPayload | null): SessionPayload {
  const s = requireSession(session);
  if (s.role !== "ADMIN") throw new Error("FORBIDDEN");
  return s;
}
