import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/auth";

export async function GET() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let { data, error } = await supabase
    .from("settings")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle(); 

  if (error) {
    console.log("SETTINGS SELECT ERROR:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    const { data: created, error: createError } = await supabase
      .from("settings")
      .insert({
        user_id: user.id,
        keywords: ["Full Stack Developer", "Software Engineer"],
        location: "",
        work_modes: [],
        min_match_score: 0,
      })
      .select()
      .single();

    if (createError) {
      console.log("SETTINGS INSERT ERROR:", createError);
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }
    data = created;
  }

  return NextResponse.json({ settings: data });
}

export async function POST(req: NextRequest) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json();

  const { error } = await supabase
    .from("settings")
    .update({
      keywords: body.keywords,
      location: body.location,
      work_modes: body.workModes,
      min_match_score: body.minMatchScore,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);

  if (error) {
    console.log("SETTINGS UPDATE ERROR:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}