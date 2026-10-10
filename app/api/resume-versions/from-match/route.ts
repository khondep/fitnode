import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { matchId, name, applicationId } = await req.json();
  if (!matchId || !name) {
    return NextResponse.json({ error: "matchId and name are required" }, { status: 400 });
  }

  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select("tailored_resume, job:jobs ( title, company )")
    .eq("id", matchId)
    .eq("user_id", user.id)
    .single();

  if (matchError || !match || !match.tailored_resume) {
    return NextResponse.json({ error: "No tailored resume found for this match" }, { status: 404 });
  }

  const { data: existing } = await supabase
    .from("resume_versions")
    .select("version")
    .eq("user_id", user.id)
    .eq("name", name)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = (existing?.version ?? 0) + 1;

  const { data: resumeVersion, error: insertError } = await supabase
    .from("resume_versions")
    .insert({
      user_id: user.id,
      name,
      version: nextVersion,
      resume_type: "TAILORED",
      content: match.tailored_resume,
    })
    .select()
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  if (applicationId) {
    await supabase
      .from("applications")
      .update({ resume_version_id: resumeVersion.id })
      .eq("id", applicationId)
      .eq("user_id", user.id);
  }

  return NextResponse.json({ resumeVersion }, { status: 201 });
}