import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/auth";
import { getEmbedding, cosineSimilarity } from "@/lib/embeddings";

export async function GET() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: resume, error: resumeError } = await supabase
    .from("resumes")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (resumeError || !resume || !resume.embedding) {
    return NextResponse.json(
      { error: "No embedded resume found. Run /api/resume/embed first." },
      { status: 400 }
    );
  }

  const { data: jobs, error: jobsError } = await supabase
    .from("jobs")
    .select("*")
    .eq("user_id", user.id);

  if (jobsError || !jobs) {
    return NextResponse.json({ error: "Failed to fetch jobs" }, { status: 500 });
  }

  let processed = 0;
  const errors: string[] = [];

  for (const job of jobs) {
    try {
      let jobEmbedding = job.embedding;
      if (!jobEmbedding) {
        jobEmbedding = await getEmbedding(job.description);
        await supabase.from("jobs").update({ embedding: jobEmbedding }).eq("id", job.id);
      }

      const score = cosineSimilarity(resume.embedding, jobEmbedding);

      await supabase.from("matches").upsert(
        { resume_id: resume.id, job_id: job.id, score, user_id: user.id },
        { onConflict: "resume_id,job_id" }
      );

      processed++;
    } catch (err: any) {
      errors.push(`Job ${job.id}: ${err.message}`);
    }
  }

  return NextResponse.json({ processed, errors });
}