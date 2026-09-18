import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/auth";
import { getEmbedding, cosineSimilarity } from "@/lib/embeddings";

type JobInsert = {
  source: string;
  external_id: string;
  title: string;
  company: string;
  location: string;
  description: string;
  url: string;
  posted_at: string;
  user_id: string;
};

export async function POST() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const steps: Record<string, any> = {};

  const { data: settings } = await supabase
    .from("settings")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  const searchTerms =
    settings?.keywords && settings.keywords.length > 0
      ? settings.keywords
      : ["full stack developer", "software engineer"];

  const location = settings?.location?.trim() || "";

  // STEP 1: Fetch jobs from Adzuna
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  const country = "us";
  let totalInserted = 0;
  const fetchErrors: string[] = [];

  for (const term of searchTerms) {
    let url = `https://api.adzuna.com/v1/api/jobs/${country}/search/1?app_id=${appId}&app_key=${appKey}&results_per_page=20&what=${encodeURIComponent(
      term
    )}&content-type=application/json`;

    if (location) {
      url += `&where=${encodeURIComponent(location)}`;
    }

    const res = await fetch(url);
    if (!res.ok) {
      fetchErrors.push(`Adzuna request failed for "${term}": ${res.status}`);
      continue;
    }

    const data = await res.json();
    const jobsToInsert: JobInsert[] = data.results.map((job: any) => ({
      source: "adzuna",
      external_id: job.id,
      title: job.title,
      company: job.company?.display_name ?? "Unknown",
      location: job.location?.display_name ?? "Unknown",
      description: job.description,
      url: job.redirect_url,
      posted_at: job.created,
      user_id: user.id,
    }));

    const { data: existingJobs } = await supabase
      .from("jobs")
      .select("title, company, location")
      .eq("user_id", user.id)
      .eq("source", "adzuna");

    const existingKeys = new Set(
      (existingJobs ?? []).map((j) => `${j.title}|${j.company}|${j.location}`)
    );

    const dedupedJobs = jobsToInsert.filter(
      (j: JobInsert) => !existingKeys.has(`${j.title}|${j.company}|${j.location}`)
    );

    const { error } = await supabase
      .from("jobs")
      .upsert(dedupedJobs, { onConflict: "source,external_id,user_id", ignoreDuplicates: true })
      .select();

    if (error) fetchErrors.push(`DB insert failed for "${term}": ${error.message}`);
    else totalInserted += dedupedJobs.length;
  }
  steps.fetchJobs = { totalInserted, errors: fetchErrors, usedSettings: { searchTerms, location } };

  // STEP 1b: Fetch jobs from USAJobs
  let usaJobsInserted = 0;
  const usaJobsErrors: string[] = [];

  for (const term of searchTerms) {
    const usaJobsUrl = `https://data.usajobs.gov/api/search?Keyword=${encodeURIComponent(
      term
    )}&ResultsPerPage=20${location ? `&LocationName=${encodeURIComponent(location)}` : ""}`;

    const usaRes = await fetch(usaJobsUrl, {
      headers: {
        "Host": "data.usajobs.gov",
        "User-Agent": process.env.USAJOBS_USER_AGENT!,
        "Authorization-Key": process.env.USAJOBS_API_KEY!,
      },
    });

    if (!usaRes.ok) {
      usaJobsErrors.push(`USAJobs request failed for "${term}": ${usaRes.status}`);
      continue;
    }

    const usaData = await usaRes.json();
    console.log("USAJOBS RAW RESPONSE for term:", term, JSON.stringify(usaData).slice(0, 1000));
    const items = usaData.SearchResult?.SearchResultItems ?? [];

    const usaJobsToInsert: JobInsert[] = items.map((item: any) => {
      const details = item.MatchedObjectDescriptor;
      return {
        source: "usajobs",
        external_id: item.MatchedObjectId,
        title: details.PositionTitle,
        company: details.OrganizationName ?? "U.S. Government",
        location: details.PositionLocationDisplay ?? "Unknown",
        description: details.UserArea?.Details?.JobSummary ?? details.QualificationSummary ?? "",
        url: details.PositionURI,
        posted_at: details.PublicationStartDate,
        user_id: user.id,
      };
    });

    const { data: existingUsaJobs } = await supabase
      .from("jobs")
      .select("title, company, location")
      .eq("user_id", user.id)
      .eq("source", "usajobs");

      const existingUsaKeys = new Set(
        (existingUsaJobs ?? []).map((j) => `${j.title}|${j.company}|${j.location}`)
      );
  
      console.log(
        `EXISTING USAJOBS KEYS for "${term}": count=${existingUsaKeys.size}`,
        Array.from(existingUsaKeys).slice(0, 3)
      );
      console.log(
        `NEW USAJOBS KEYS for "${term}":`,
        usaJobsToInsert.slice(0, 3).map((j) => `${j.title}|${j.company}|${j.location}`)
      );

    const dedupedUsaJobs = usaJobsToInsert.filter(
        (j: JobInsert) => !existingUsaKeys.has(`${j.title}|${j.company}|${j.location}`)
      );
  
      console.log(
        `USAJOBS DEDUP for "${term}": raw=${usaJobsToInsert.length}, afterDedup=${dedupedUsaJobs.length}`
      );
  
      const { error: usaError, data: insertedData } = await supabase
        .from("jobs")
        .upsert(dedupedUsaJobs, { onConflict: "source,external_id,user_id", ignoreDuplicates: true })
        .select();
  
      console.log(`USAJOBS INSERT RESULT for "${term}":`, JSON.stringify({ usaError, insertedCount: insertedData?.length }));
  
      if (usaError) usaJobsErrors.push(`DB insert failed for "${term}": ${usaError.message}`);
      else usaJobsInserted += dedupedUsaJobs.length;

  }
  steps.fetchUsaJobs = { totalInserted: usaJobsInserted, errors: usaJobsErrors };
  console.log("USAJOBS STEP RESULT:", JSON.stringify(steps.fetchUsaJobs, null, 2));

  // STEP 2: Embed resume (only if not already embedded)
  const { data: resume, error: resumeError } = await supabase
    .from("resumes")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (resumeError || !resume) {
    return NextResponse.json(
      { error: "No resume found. Upload one first.", steps },
      { status: 400 }
    );
  }

  let resumeEmbedding = resume.embedding;
  if (!resumeEmbedding) {
    resumeEmbedding = await getEmbedding(resume.raw_text);
    await supabase.from("resumes").update({ embedding: resumeEmbedding }).eq("id", resume.id);
  }
  steps.embedResume = { success: true };

  // STEP 3: Generate matches — respecting the minimum match score filter
  const { data: jobs, error: jobsError } = await supabase
    .from("jobs")
    .select("*")
    .eq("user_id", user.id);

  if (jobsError || !jobs) {
    return NextResponse.json(
      { error: "Failed to fetch jobs for matching", steps },
      { status: 500 }
    );
  }

  const minScore = settings?.min_match_score ?? 0;
  let processed = 0;
  let skippedBelowThreshold = 0;
  const matchErrors: string[] = [];

  for (const job of jobs) {
    try {
      let jobEmbedding = job.embedding;
      if (!jobEmbedding) {
        jobEmbedding = await getEmbedding(job.description);
        await supabase.from("jobs").update({ embedding: jobEmbedding }).eq("id", job.id);
      }

      const score = cosineSimilarity(resumeEmbedding, jobEmbedding);

      if (score < minScore) {
        skippedBelowThreshold++;
        continue;
      }

      await supabase.from("matches").upsert(
        { resume_id: resume.id, job_id: job.id, score, user_id: user.id },
        { onConflict: "resume_id,job_id" }
      );

      processed++;
    } catch (err: any) {
      matchErrors.push(`Job ${job.id}: ${err.message}`);
    }
  }
  steps.generateMatches = { processed, skippedBelowThreshold, errors: matchErrors, minScoreUsed: minScore };

  return NextResponse.json({ success: true, steps });
}