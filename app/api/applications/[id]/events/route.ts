import { NextRequest, NextResponse } from "next/server";
import { requireUser, readJsonBody, jsonError } from "@/lib/api";
import {
  isUuid,
  isApplicationEventType,
  sanitizeText,
  parsePagination,
} from "@/lib/validation";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/applications/[id]/events — paged timeline
export async function GET(req: NextRequest, ctx: RouteContext) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth.ctx;

  const { id } = await ctx.params;
  if (!isUuid(id)) return jsonError(404, "Application not found");

  // RLS scopes to owner; the join-level check keeps 404 semantics consistent.
  const { data: app } = await supabase
    .from("applications")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!app) return jsonError(404, "Application not found");

  const { searchParams } = new URL(req.url);
  const pagination = parsePagination(searchParams);
  if (!pagination) {
    return jsonError(400, "Invalid pagination parameters");
  }
  const { page, pageSize, from } = pagination;

  const { data, error } = await supabase
    .from("application_events")
    .select("*", { count: "exact" })
    .eq("application_id", id)
    .order("event_date", { ascending: false })
    .range(from, from + pageSize - 1);

  if (error) return jsonError(500, error.message);

  return NextResponse.json({
    events: data ?? [],
    page,
    pageSize,
  });
}

// POST /api/applications/[id]/events — append explicit events (NOTE_ADDED, FOLLOWUP_SENT, …)
export async function POST(req: NextRequest, ctx: RouteContext) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth.ctx;

  const { id } = await ctx.params;
  if (!isUuid(id)) return jsonError(404, "Application not found");

  const body = await readJsonBody(req);
  if (!body) return jsonError(400, "Invalid JSON body");

  if (!isApplicationEventType(body.event_type)) {
    return jsonError(400, "Invalid event_type");
  }

  // Metadata must be a plain object if provided.
  let metadata: Record<string, unknown> = {};
  if (body.metadata !== undefined && body.metadata !== null) {
    if (
      typeof body.metadata !== "object" ||
      Array.isArray(body.metadata)
    ) {
      return jsonError(400, "metadata must be a JSON object");
    }
    metadata = body.metadata as Record<string, unknown>;
  }

  // NOTE_ADDED / FOLLOWUP_SENT carry the note in metadata.note
  if (
    (body.event_type === "NOTE_ADDED" || body.event_type === "FOLLOWUP_SENT")
  ) {
    const note = sanitizeText(body.note, 2000);
    if (!note) return jsonError(400, "note is required for this event type");
    metadata.note = note;
  }

  const { data: app } = await supabase
    .from("applications")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!app) return jsonError(404, "Application not found");

  const { data, error } = await supabase
    .from("application_events")
    .insert({
      user_id: user.id,
      application_id: id,
      event_type: body.event_type,
      metadata,
    })
    .select()
    .single();

  if (error) return jsonError(500, error.message);

  return NextResponse.json({ event: data }, { status: 201 });
}
