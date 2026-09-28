// FitNode 2.0 — shared API route helpers.
// Extracts the pattern every existing route repeats: build the cookie-based
// server client, verify the session, return JSON errors in one shape.

import { NextRequest, NextResponse } from "next/server";
import { SupabaseClient, User } from "@supabase/supabase-js";
import { getSupabaseServerClient } from "./auth";

export function jsonError(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

type AuthedContext = {
  supabase: SupabaseClient;
  user: User;
};

/**
 * Resolve the cookie session for a route handler.
 * Returns { supabase, user } or a 401 NextResponse to return immediately.
 */
export async function requireUser(): Promise<
  { ok: true; ctx: AuthedContext } | { ok: false; response: NextResponse }
> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, response: jsonError(401, "Not authenticated") };
  }
  return { ok: true, ctx: { supabase, user } };
}

/** Parse a JSON body, tolerating empty bodies (e.g. PATCH with no fields). */
export async function readJsonBody(
  req: NextRequest
): Promise<Record<string, unknown> | null> {
  try {
    const body = await req.json();
    if (body === null || typeof body !== "object" || Array.isArray(body)) {
      return null;
    }
    return body as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * True when a row with this id exists AND belongs to the user.
 * RLS already scopes the select; this makes intent explicit and lets
 * routes reject foreign ids with 404 before writing.
 */
export async function userOwnsRow(
  supabase: SupabaseClient,
  table: "resumes" | "jobs" | "contacts" | "applications" | "interviews" | "tasks",
  id: string,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from(table)
    .select("id")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  return Boolean(data);
}
