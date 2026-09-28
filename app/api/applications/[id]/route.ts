import { NextRequest, NextResponse } from "next/server";
import { requireUser, readJsonBody, userOwnsRow, jsonError } from "@/lib/api";
import {
  isUuid,
  isApplicationStatus,
  sanitizeText,
} from "@/lib/validation";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/applications/[id] — full aggregate for the detail view
export async function GET(req: NextRequest, ctx: RouteContext) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth.ctx;

  const { id } = await ctx.params;
  if (!isUuid(id)) return jsonError(404, "Application not found");

  const { data: application, error } = await supabase
    .from("applications")
    .select(
      `*,
       job:jobs ( id, title, company, location, url, description, posted_at, source ),
       resume_version:resumes ( id, name, version, resume_type ),
       referral_contact:contacts ( id, name, role, company, email, linkedin_url, last_contacted_at )`
    )
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) return jsonError(500, error.message);
  if (!application) return jsonError(404, "Application not found");

  const [interviews, tasks, events] = await Promise.all([
    supabase
      .from("interviews")
      .select("*")
      .eq("application_id", id)
      .order("scheduled_at", { ascending: true }),
    supabase
      .from("tasks")
      .select("*")
      .eq("application_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("application_events")
      .select("*")
      .eq("application_id", id)
      .order("event_date", { ascending: false }),
  ]);

  return NextResponse.json({
    application: {
      ...application,
      interviews: interviews.data ?? [],
      tasks: tasks.data ?? [],
      events: events.data ?? [],
    },
  });
}

// PATCH /api/applications/[id] — update status / resume version / referral / notes / source
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth.ctx;

  const { id } = await ctx.params;
  if (!isUuid(id)) return jsonError(404, "Application not found");

  const body = await readJsonBody(req);
  if (!body) return jsonError(400, "Invalid JSON body");

  const updates: Record<string, unknown> = {};

  if (body.status !== undefined) {
    if (!isApplicationStatus(body.status)) {
      return jsonError(400, "Invalid status");
    }
    updates.status = body.status;
  }

  if (body.resume_version_id !== undefined) {
    if (body.resume_version_id === null) {
      updates.resume_version_id = null;
    } else if (isUuid(body.resume_version_id)) {
      if (!(await userOwnsRow(supabase, "resumes", body.resume_version_id, user.id))) {
        return jsonError(404, "Resume version not found");
      }
      updates.resume_version_id = body.resume_version_id;
    } else {
      return jsonError(400, "resume_version_id must be a valid UUID or null");
    }
  }

  if (body.referral_contact_id !== undefined) {
    if (body.referral_contact_id === null) {
      updates.referral_contact_id = null;
    } else if (isUuid(body.referral_contact_id)) {
      if (!(await userOwnsRow(supabase, "contacts", body.referral_contact_id, user.id))) {
        return jsonError(404, "Contact not found");
      }
      updates.referral_contact_id = body.referral_contact_id;
    } else {
      return jsonError(400, "referral_contact_id must be a valid UUID or null");
    }
  }

  if (body.source !== undefined) {
    const source = sanitizeText(body.source, 120);
    if (source === undefined) return jsonError(400, "Invalid source");
    updates.source = source;
  }

  if (body.notes !== undefined) {
    const notes = sanitizeText(body.notes, 5000);
    if (notes === undefined) return jsonError(400, "Invalid notes");
    updates.notes = notes;
  }

  if (Object.keys(updates).length === 0) {
    return jsonError(400, "No valid fields to update");
  }

  // Single round-trip: update + return. If nothing matched this user's rows,
  // Postgres returns zero rows → treat as 404.
  const { data, error } = await supabase
    .from("applications")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .maybeSingle();

  if (error) return jsonError(500, error.message);
  if (!data) return jsonError(404, "Application not found");

  return NextResponse.json({ application: data });
}

// DELETE /api/applications/[id]
export async function DELETE(req: NextRequest, ctx: RouteContext) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth.ctx;

  const { id } = await ctx.params;
  if (!isUuid(id)) return jsonError(404, "Application not found");

  const { data, error } = await supabase
    .from("applications")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) return jsonError(500, error.message);
  if (!data) return jsonError(404, "Application not found");

  return NextResponse.json({ success: true });
}
