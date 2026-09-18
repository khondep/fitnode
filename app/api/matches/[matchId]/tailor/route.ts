import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  const { matchId } = await params;
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select(`
      id,
      resume:resumes ( raw_text ),
      job:jobs ( title, company, description )
    `)
    .eq("id", matchId)
    .eq("user_id", user.id)
    .single();

  if (matchError || !match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  const resumeText = (match.resume as any).raw_text;
  const job = match.job as any;

  const prompt = `You are a resume writing assistant. Rewrite the following resume's bullet points to better align with the target job description below. 

Rules:
- Do NOT invent new experience, skills, or achievements the candidate doesn't have.
- Only rephrase and reprioritize existing content to emphasize what's relevant to this job.
- Mirror keywords/phrasing from the job description where genuinely applicable.
- Keep the same overall structure and length.
- Return ONLY the rewritten resume text, no commentary.

TARGET JOB TITLE: ${job.title}
TARGET COMPANY: ${job.company}
JOB DESCRIPTION:
${job.description}

ORIGINAL RESUME:
${resumeText}`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4,
    }),
  });

  const data = await res.json();

  if (!data.choices) {
    return NextResponse.json(
      { error: `Tailoring failed: ${JSON.stringify(data)}` },
      { status: 500 }
    );
  }

  const tailoredResume = data.choices[0].message.content;

  const { error: updateError } = await supabase
    .from("matches")
    .update({ tailored_resume: tailoredResume })
    .eq("id", matchId)
    .eq("user_id", user.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, tailoredResume });
}