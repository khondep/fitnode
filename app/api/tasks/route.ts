import { NextRequest, NextResponse } from "next/server";
import { requireUser, readJsonBody, jsonError } from "@/lib/api";
import {
  isUuid,
  isTaskPriority,
  isTaskStatus,
  isTaskSource,
  sanitizeText,
  parseIsoTimestamp,
} from "@/lib/validation";

export const dynamic = "force-dynamic";

// GET /api/tasks?status=OPEN&application_id=…
export async function GET(req: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth.ctx;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const applicationId = searchParams.get("application_id");

  if (status && !isTaskStatus(status)) {
    return jsonError(400, "Invalid status filter");
  }
  if (applicationId && !isUuid(applicationId)) {
    return jsonError(400, "Invalid application_id filter");
  }

  let query = supabase
    .from("tasks")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(200);

  if (status) query = query.eq("status", status);
  if (applicationId) query = query.eq("application_id", applicationId);

  const { data, error } = await query;
  if (error) return jsonError(500, error.message);

  return NextResponse.json({ tasks: data ?? [] });
}

// POST /api/tasks — create a task, optionally tied to an application
export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth.ctx;

  const body = await readJsonBody(req);
  if (!body) return jsonError(400, "Invalid JSON body");

  const title = sanitizeText(body.title, 300);
  if (!title) return jsonError(400, "title is required");

  if (body.priority !== undefined && !isTaskPriority(body.priority)) {
    return jsonError(400, "Invalid priority");
  }
  if (body.status !== undefined && !isTaskStatus(body.status)) {
    return jsonError(400, "Invalid status");
  }
  if (body.source !== undefined && !isTaskSource(body.source)) {
    return jsonError(400, "Invalid source");
  }

  const dueAt = parseIsoTimestamp(body.due_at);
  if (dueAt === null) {
    return jsonError(400, "due_at must be a valid ISO-8601 timestamp");
  }

  let applicationId: string | null = null;
  if (body.application_id !== undefined && body.application_id !== null) {
    if (!isUuid(body.application_id)) {
      return jsonError(400, "application_id must be a valid UUID");
    }
    const { data: app } = await supabase
      .from("applications")
      .select("id")
      .eq("id", body.application_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!app) return jsonError(404, "Application not found");
    applicationId = body.application_id;
  }

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      user_id: user.id,
      application_id: applicationId,
      title,
      description: sanitizeText(body.description, 5000) ?? null,
      priority: body.priority ?? "MEDIUM",
      status: body.status ?? "OPEN",
      source: body.source ?? "USER",
      due_at: dueAt ?? null,
      completed_at:
        body.status === "COMPLETED" ? new Date().toISOString() : null,
    })
    .select()
    .single();

  if (error) return jsonError(500, error.message);

  return NextResponse.json({ task: data }, { status: 201 });
}
