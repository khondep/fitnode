import { NextRequest, NextResponse } from "next/server";
import { requireUser, readJsonBody, jsonError } from "@/lib/api";
import { isUuid, isTaskStatus, sanitizeText, parseIsoTimestamp, isTaskPriority } from "@/lib/validation";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

// PATCH /api/tasks/[id] — complete/reopen or edit a task
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth.ctx;

  const { id } = await ctx.params;
  if (!isUuid(id)) return jsonError(404, "Task not found");

  const body = await readJsonBody(req);
  if (!body) return jsonError(400, "Invalid JSON body");

  const updates: Record<string, unknown> = {};

  if (body.status !== undefined) {
    if (!isTaskStatus(body.status)) return jsonError(400, "Invalid status");
    updates.status = body.status;
    updates.completed_at =
      body.status === "COMPLETED" ? new Date().toISOString() : null;
  }

  if (body.title !== undefined) {
    const title = sanitizeText(body.title, 300);
    if (!title) return jsonError(400, "title cannot be empty");
    updates.title = title;
  }

  if (body.description !== undefined) {
    const description = sanitizeText(body.description, 5000);
    if (description === undefined) return jsonError(400, "Invalid description");
    updates.description = description;
  }

  if (body.priority !== undefined) {
    if (!isTaskPriority(body.priority)) return jsonError(400, "Invalid priority");
    updates.priority = body.priority;
  }

  if (body.due_at !== undefined) {
    const dueAt = parseIsoTimestamp(body.due_at);
    if (dueAt === null) {
      return jsonError(400, "due_at must be a valid ISO-8601 timestamp");
    }
    updates.due_at = dueAt;
  }

  if (Object.keys(updates).length === 0) {
    return jsonError(400, "No valid fields to update");
  }

  const { data, error } = await supabase
    .from("tasks")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .maybeSingle();

  if (error) return jsonError(500, error.message);
  if (!data) return jsonError(404, "Task not found");

  return NextResponse.json({ task: data });
}

// DELETE /api/tasks/[id]
export async function DELETE(req: NextRequest, ctx: RouteContext) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth.ctx;

  const { id } = await ctx.params;
  if (!isUuid(id)) return jsonError(404, "Task not found");

  const { data, error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) return jsonError(500, error.message);
  if (!data) return jsonError(404, "Task not found");

  return NextResponse.json({ success: true });
}
