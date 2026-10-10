import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/auth";

export async function GET() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data, error } = await supabase
    .from("resume_versions")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ resumeVersions: data });
}

export async function POST(req: NextRequest) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json();
  const { name, content, baseResumeId, resumeType } = body;

  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
  if (!content && !body.filePath) {
    return NextResponse.json({ error: "content or filePath is required" }, { status: 400 });
  }

  // Auto-increment version per name (e.g. "Backend SWE" v1, v2, v3...)
  const { data: existing } = await supabase
    .from("resume_versions")
    .select("version")
    .eq("user_id", user.id)
    .eq("name", name)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = (existing?.version ?? 0) + 1;

  const { data, error } = await supabase
    .from("resume_versions")
    .insert({
      user_id: user.id,
      base_resume_id: baseResumeId ?? null,
      name,
      version: nextVersion,
      resume_type: resumeType ?? "CUSTOM",
      content: content ?? null,
      file_path: body.filePath ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ resumeVersion: data }, { status: 201 });
}