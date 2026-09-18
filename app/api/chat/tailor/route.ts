import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { jobDescription } = await req.json();

  if (!jobDescription || jobDescription.trim().length < 20) {
    return NextResponse.json(
      { error: "Please paste a full job description." },
      { status: 400 }
    );
  }

  const { data: resume, error: resumeError } = await supabase
    .from("resumes")
    .select("raw_text")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (resumeError || !resume) {
    return NextResponse.json(
      { error: "No resume found. Upload one on the Dashboard first." },
      { status: 400 }
    );
  }

  const prompt = `You are a career assistant. Given a candidate's resume and a target job description, produce two things:

1. A COMPLETE tailored version of the ENTIRE resume — including the technical skills section, all work experience bullets, AND all projects. Reorder and rephrase technical skills to lead with the ones most relevant to this job. Rewrite bullets in work experience AND projects to mirror this job's language and priorities. Do not omit any section that exists in the original resume. Do NOT invent new skills, experience, or projects that aren't in the original.
2. A short cold outreach email (under 150 words) to a recruiter for this role, referencing 1-2 real, specific qualifications. Use "[Recruiter Name]" as a placeholder greeting, and sign off with the candidate's real name from the resume. Include a "Subject:" line.

Return your answer as valid JSON with exactly this shape, no markdown formatting, no commentary. The tailoredResume field must contain the full resume text with ALL original sections (contact info, education, technical skills, professional experience, projects) present and reordered/rephrased for relevance — formatted plainly so it can be copy-pasted directly:
{"tailoredResume": "...", "coldEmail": "..."}

JOB DESCRIPTION:
${jobDescription}

CANDIDATE RESUME:
${resume.raw_text}`;

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
      response_format: { type: "json_object" },
    }),
  });

  const data = await res.json();

  if (!data.choices) {
    return NextResponse.json(
      { error: `Generation failed: ${JSON.stringify(data)}` },
      { status: 500 }
    );
  }

  let parsed;
  try {
    parsed = JSON.parse(data.choices[0].message.content);
  } catch {
    return NextResponse.json(
      { error: "Failed to parse AI response" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    tailoredResume: parsed.tailoredResume,
    coldEmail: parsed.coldEmail,
  });
}