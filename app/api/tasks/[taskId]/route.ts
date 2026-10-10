import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json();
  const updates: Record<string, any> = {};

  if (body.status !== undefined) {
    updates.status = body.status;
    if (body.status === "DONE") updates.completed_at = new Date().toISOString();
  }
  if (body.title !== undefined) updates.title = body.title;
  if (body.priority !== undefined) updates.priority = body.priority;
  if (body.dueAt !== undefined) updates.due_at = body.dueAt;

  const { data, error } = await supabase
    .from("tasks")
    .update(updates)
    .eq("id", taskId)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error || !data) return NextResponse.json({ error: "Task not found" }, { status: 404 });
  return NextResponse.json({ task: data });
}