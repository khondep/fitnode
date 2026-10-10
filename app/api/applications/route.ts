import { NextRequest, NextResponse } from "next/server";
import { requireUser, readJsonBody, userOwnsRow, jsonError } from "@/lib/api";
import {
  isUuid,
  isApplicationStatus,
  sanitizeText,
  parsePagination,
} from "@/lib/validation";

export const dynamic = "force-dynamic";

// GET /api/applications?status=APPLIED&page=1&pageSize=50
export async function GET(req: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth.ctx;

  const { searchParams } = new URL(req.url);
  const pagination = parsePagination(searchParams);
  if (!pagination) {
    return jsonError(400, "Invalid pagination parameters");
  }

  const status = searchParams.get("status");
  if (status && !isApplicationStatus(status)) {
    return jsonError(400, "Invalid status filter");
  }

  let query = supabase
    .from("applications")
    .select(
      "id, status, date_saved, date_applied, source, notes, resume_version_id, referral_contact_id, created_at, updated_at, job:jobs ( id, title, company, location, url, posted_at )",
      { count: "exact" }
    )
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .range(pagination.from, pagination.to);

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error, count } = await query;

  if (error) {
    return jsonError(500, error.message);
  }

  return NextResponse.json({
    applications: data ?? [],
    page: pagination.page,
    pageSize: pagination.pageSize,
    total: count ?? 0,
  });
}

// POST /api/applications — create ("save job") or return existing (idempotent)
export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth.ctx;

  const body = await readJsonBody(req);
  if (!body) return jsonError(400, "Invalid JSON body");

  const jobId = body.job_id;
  if (!isUuid(jobId)) {
    return jsonError(400, "job_id is required and must be a valid UUID");
  }

  // The job must exist and belong to the user (RLS also enforces this).
  if (!(await userOwnsRow(supabase, "jobs", jobId, user.id))) {
    return jsonError(404, "Job not found");
  }

  // Optional fields
  let status: string | undefined;
  if (body.status !== undefined && body.status !== null) {
    if (!isApplicationStatus(body.status)) {
      return jsonError(400, "Invalid status");
    }
    status = body.status;
  }

  let resumeVersionId: string | null | undefined;
  if (body.resume_version_id !== undefined && body.resume_version_id !== null) {
    if (!isUuid(body.resume_version_id)) {
      return jsonError(400, "resume_version_id must be a valid UUID");
    }
    if (!(await userOwnsRow(supabase, "resumes", body.resume_version_id, user.id))) {
      return jsonError(404, "Resume version not found");
    }
    resumeVersionId = body.resume_version_id;
  }

  let referralContactId: string | null | undefined;
  if (
    body.referral_contact_id !== undefined &&
    body.referral_contact_id !== null
  ) {
    if (!isUuid(body.referral_contact_id)) {
      return jsonError(400, "referral_contact_id must be a valid UUID");
    }
    if (!(await userOwnsRow(supabase, "contacts", body.referral_contact_id, user.id))) {
      return jsonError(404, "Contact not found");
    }
    referralContactId = body.referral_contact_id;
  }

  const source = sanitizeText(body.source, 120) ?? null;
  const notes = sanitizeText(body.notes, 5000) ?? null;

  // Idempotent create: a unique(user_id, job_id) violation means the
  // application already exists — fetch and return it with 200.
  const insert = await supabase
    .from("applications")
    .insert({
      user_id: user.id,
      job_id: jobId,
      ...(status ? { status } : {}),
      ...(resumeVersionId ? { resume_version_id: resumeVersionId } : {}),
      ...(referralContactId ? { referral_contact_id: referralContactId } : {}),
      source,
      notes,
    })
    .select()
    .single();

  if (insert.error) {
    if (insert.error.code === "23505") {
      const { data: existing } = await supabase
        .from("applications")
        .select("*")
        .eq("user_id", user.id)
        .eq("job_id", jobId)
        .maybeSingle();
      if (existing) {
        return NextResponse.json({ application: existing, existing: true });
      }
    }
    return jsonError(500, insert.error.message);
  }

  return NextResponse.json({ application: insert.data, existing: false }, { status: 201 });
}
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const status = req.nextUrl.searchParams.get("status");

  let query = supabase
    .from("applications")
    .select(`
      id, status, date_saved, date_applied, source, notes, created_at, updated_at,
      job:jobs ( id, title, company, location, url ),
      resume_version:resume_versions ( id, name, version ),
      recruiter:contacts!applications_recruiter_fk ( id, name, company )
    `)
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ applications: data });
}

export async function POST(req: NextRequest) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json();
  const { jobId, source } = body;

  if (!jobId) {
    return NextResponse.json({ error: "jobId is required" }, { status: 400 });
  }

  // Confirm the job belongs to this user before attaching an application to it
  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select("id")
    .eq("id", jobId)
    .eq("user_id", user.id)
    .single();

  if (jobError || !job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("applications")
    .insert({ user_id: user.id, job_id: jobId, source: source ?? "manual" })
    .select()
    .single();

  if (error) {
    // applications_one_per_job unique constraint — this job is already saved/tracked
    if (error.code === "23505") {
      return NextResponse.json({ error: "This job is already in your pipeline" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ application: data }, { status: 201 });
}