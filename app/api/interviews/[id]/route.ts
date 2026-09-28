import { NextRequest, NextResponse } from "next/server";
import { requireUser, readJsonBody, jsonError } from "@/lib/api";
import {
  isUuid,
  isInterviewStatus,
  sanitizeText,
  parseIsoTimestamp,
  isValidHttpUrl,
  parseIntField,
} from "@/lib/validation";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

// PATCH /api/interviews/[id] — reschedule, mark completed/cancelled, edit
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth.ctx;

  const { id } = await ctx.params;
  if (!isUuid(id)) return jsonError(404, "Interview not found");

  const body = await readJsonBody(req);
  if (!body) return jsonError(400, "Invalid JSON body");

  const updates: Record<string, unknown> = {};

  if (body.status !== undefined) {
    if (!isInterviewStatus(body.status)) return jsonError(400, "Invalid status");
    updates.status = body.status;
  }

  if (body.scheduled_at !== undefined) {
    const scheduledAt = parseIsoTimestamp(body.scheduled_at);
    if (scheduledAt === null) {
      return jsonError(400, "scheduled_at must be a valid ISO-8601 timestamp");
    }
    updates.scheduled_at = scheduledAt;
  }

  if (body.duration_minutes !== undefined) {
    const duration = parseIntField(body.duration_minutes, 1, 600);
    if (duration === null) {
      return jsonError(400, "duration_minutes must be an integer between 1 and 600");
    }
    updates.duration_minutes = duration;
  }

  if (body.meeting_url !== undefined) {
    if (body.meeting_url === null) {
      updates.meeting_url = null;
    } else if (
      typeof body.meeting_url === "string" &&
      isValidHttpUrl(body.meeting_url.trim())
    ) {
      updates.meeting_url = body.meeting_url.trim().slice(0, 500);
    } else {
      return jsonError(400, "meeting_url must be a valid http(s) URL or null");
    }
  }

  if (body.interviewer !== undefined) {
    const interviewer = sanitizeText(body.interviewer, 200);
    if (interviewer === undefined) return jsonError(400, "Invalid interviewer");
    updates.interviewer = interviewer;
  }

  if (body.notes !== undefined) {
    const notes = sanitizeText(body.notes, 5000);
    if (notes === undefined) return jsonError(400, "Invalid notes");
    updates.notes = notes;
  }

  if (Object.keys(updates).length === 0) {
    return jsonError(400, "No valid fields to update");
  }

  const { data, error } = await supabase
    .from("interviews")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .maybeSingle();

  if (error) return jsonError(500, error.message);
  if (!data) return jsonError(404, "Interview not found");

  return NextResponse.json({ interview: data });
}

// DELETE /api/interviews/[id]
export async function DELETE(req: NextRequest, ctx: RouteContext) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth.ctx;

  const { id } = await ctx.params;
  if (!isUuid(id)) return jsonError(404, "Interview not found");

  const { data, error } = await supabase
    .from("interviews")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) return jsonError(500, error.message);
  if (!data) return jsonError(404, "Interview not found");

  return NextResponse.json({ success: true });
}
