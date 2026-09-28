import { NextRequest, NextResponse } from "next/server";
import { requireUser, readJsonBody, jsonError } from "@/lib/api";
import {
  isUuid,
  isInterviewType,
  parseIsoTimestamp,
  sanitizeText,
  isValidHttpUrl,
  parseIntField,
} from "@/lib/validation";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/applications/[id]/interviews — schedule an interview
export async function POST(req: NextRequest, ctx: RouteContext) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth.ctx;

  const { id } = await ctx.params;
  if (!isUuid(id)) return jsonError(404, "Application not found");

  const body = await readJsonBody(req);
  if (!body) return jsonError(400, "Invalid JSON body");

  if (!isInterviewType(body.type)) {
    return jsonError(400, "Invalid interview type");
  }

  const scheduledAt = parseIsoTimestamp(body.scheduled_at);
  if (scheduledAt === null) {
    return jsonError(400, "scheduled_at must be a valid ISO-8601 timestamp");
  }

  const duration = parseIntField(body.duration_minutes, 1, 600);

  if (duration === null) {
    return jsonError(400, "duration_minutes must be an integer between 1 and 600");
  }

  let meetingUrl: string | null = null;
  if (body.meeting_url !== undefined && body.meeting_url !== null) {
    if (typeof body.meeting_url !== "string" || !isValidHttpUrl(body.meeting_url.trim())) {
      return jsonError(400, "meeting_url must be a valid http(s) URL");
    }
    meetingUrl = body.meeting_url.trim().slice(0, 500);
  }

  const interviewer = sanitizeText(body.interviewer, 200) ?? null;
  const notes = sanitizeText(body.notes, 5000) ?? null;

  const { data: app } = await supabase
    .from("applications")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!app) return jsonError(404, "Application not found");

  const { data, error } = await supabase
    .from("interviews")
    .insert({
      user_id: user.id,
      application_id: id,
      type: body.type,
      status: "SCHEDULED",
      scheduled_at: scheduledAt ?? null,
      duration_minutes: duration ?? null,
      meeting_url: meetingUrl,
      interviewer,
      notes,
    })
    .select()
    .single();

  if (error) return jsonError(500, error.message);

  return NextResponse.json({ interview: data }, { status: 201 });
}
