import { cookies } from "next/headers";
import { AI_SID_COOKIE } from "@/middleware";

/**
 * The anonymous session id for AI configuration (route handlers only).
 * Empty string = no session cookie yet = no AI config (Demo/Fallback).
 */
export function aiSessionId(): string {
  const v = cookies().get(AI_SID_COOKIE)?.value ?? "";
  return /^[a-f0-9-]{16,64}$/i.test(v) ? v : "";
}
