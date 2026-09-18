// import { NextResponse } from "next/server";
// import { createClient } from "@supabase/supabase-js";
// import { getEmbedding } from "@/lib/embeddings";

// const supabase = createClient(
//   process.env.NEXT_PUBLIC_SUPABASE_URL!,
//   process.env.SUPABASE_SERVICE_ROLE_KEY!
// );

// export async function GET() {
//   // Get the most recently uploaded resume
//   const { data: resume, error } = await supabase
//     .from("resumes")
//     .select("*")
//     .order("created_at", { ascending: false })
//     .limit(1)
//     .single();

//   if (error || !resume) {
//     return NextResponse.json({ error: "No resume found" }, { status: 404 });
//   }

//   const embedding = await getEmbedding(resume.raw_text);

//   const { error: updateError } = await supabase
//     .from("resumes")
//     .update({ embedding })
//     .eq("id", resume.id);

//   if (updateError) {
//     return NextResponse.json({ error: updateError.message }, { status: 500 });
//   }

//   return NextResponse.json({ success: true, resumeId: resume.id });
// }

import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/auth";
import { getEmbedding } from "@/lib/embeddings";

export async function GET() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: resume, error } = await supabase
    .from("resumes")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !resume) {
    return NextResponse.json({ error: "No resume found" }, { status: 404 });
  }

  const embedding = await getEmbedding(resume.raw_text);

  const { error: updateError } = await supabase
    .from("resumes")
    .update({ embedding })
    .eq("id", resume.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, resumeId: resume.id });
}