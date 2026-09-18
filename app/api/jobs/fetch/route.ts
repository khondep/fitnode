import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/auth";

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

export async function GET() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // 1. Load this user's saved settings, falling back to sensible defaults
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

  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  const country = "us";
  let totalInserted = 0;
  const errors: string[] = [];

  for (const term of searchTerms) {
    // 2. Build the query, adding a location filter (Adzuna's "where" param) if set
    let url = `https://api.adzuna.com/v1/api/jobs/${country}/search/1?app_id=${appId}&app_key=${appKey}&results_per_page=20&what=${encodeURIComponent(
      term
    )}&content-type=application/json`;

    if (location) {
      url += `&where=${encodeURIComponent(location)}`;
    }

    const res = await fetch(url);
    if (!res.ok) {
      errors.push(`Adzuna request failed for "${term}": ${res.status}`);
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

    // 3. Filter out jobs that already exist for this user (by title+company+location,
    //    since Adzuna's external_id can shift between calls for the same posting)
    const { data: existingJobs } = await supabase
      .from("jobs")
      .select("title, company, location")
      .eq("user_id", user.id);

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

    if (error) errors.push(`DB insert failed for "${term}": ${error.message}`);
    else totalInserted += dedupedJobs.length;
  }

  return NextResponse.json({ totalInserted, errors, usedSettings: { searchTerms, location } });
}