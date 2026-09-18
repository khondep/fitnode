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

  const prompt = `Write a short, genuine-sounding cold email from a job candidate to a recruiter, expressing interest in a specific open role.

Rules:
- Keep it under 150 words.
- No generic flattery or clichés like "I was thrilled to see" or "I'd love the opportunity."
- Reference 1-2 specific, real qualifications from the resume that match the job description.
- End with a clear, low-pressure ask (e.g., a quick call, or just "happy to share more").
- Use "[Recruiter Name]" as a placeholder greeting since we don't know their name yet.
- Sign off with the candidate's actual name from the resume.
- Return ONLY the email text (including a short subject line at the top prefixed with "Subject:"), no extra commentary.

JOB TITLE: ${job.title}
COMPANY: ${job.company}
JOB DESCRIPTION:
${job.description}

CANDIDATE RESUME:
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
      temperature: 0.6,
    }),
  });

  const data = await res.json();

  if (!data.choices) {
    return NextResponse.json(
      { error: `Cold email generation failed: ${JSON.stringify(data)}` },
      { status: 500 }
    );
  }

  const coldEmail = data.choices[0].message.content;

  const { error: updateError } = await supabase
    .from("matches")
    .update({ cold_email: coldEmail })
    .eq("id", matchId)
    .eq("user_id", user.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, coldEmail });
}