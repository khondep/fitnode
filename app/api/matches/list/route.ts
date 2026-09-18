import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/auth";

export async function GET() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("matches")
    .select(`
      id,
      score,
      tailored_resume,
      cold_email,
      job:jobs ( id, title, company, location, url, posted_at )
    `)
    .eq("user_id", user.id)
    .order("score", { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ matches: data });
}