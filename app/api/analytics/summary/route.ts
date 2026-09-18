import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/auth";

export async function GET() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Match score distribution
  const { data: matches } = await supabase
    .from("matches")
    .select("score")
    .eq("user_id", user.id);

  const buckets = { "0-40%": 0, "40-60%": 0, "60-80%": 0, "80-100%": 0 };
  (matches ?? []).forEach((m) => {
    const pct = m.score * 100;
    if (pct < 40) buckets["0-40%"]++;
    else if (pct < 60) buckets["40-60%"]++;
    else if (pct < 80) buckets["60-80%"]++;
    else buckets["80-100%"]++;
  });

  const matchDistribution = Object.entries(buckets).map(([name, value]) => ({
    name,
    value,
  }));

  // Job source breakdown
  const { data: jobs } = await supabase
    .from("jobs")
    .select("source")
    .eq("user_id", user.id);

  const sourceCounts: Record<string, number> = {};
  (jobs ?? []).forEach((j) => {
    sourceCounts[j.source] = (sourceCounts[j.source] ?? 0) + 1;
  });

  const sourceBreakdown = Object.entries(sourceCounts).map(([name, value]) => ({
    name,
    value,
  }));

  return NextResponse.json({ matchDistribution, sourceBreakdown });
}