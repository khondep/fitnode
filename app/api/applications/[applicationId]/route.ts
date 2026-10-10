import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/auth";

const VALID_STATUSES = [
  "SAVED", "APPLIED", "RECRUITER_CONTACT", "OA", "INTERVIEW",
  "FINAL_ROUND", "OFFER", "REJECTED", "WITHDRAWN", "GHOSTED",
];

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ applicationId: string }> }
) {
  const { applicationId } = await params;
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data, error } = await supabase
    .from("applications")
    .select(`
      id, status, date_saved, date_applied, source, notes, created_at, updated_at,
      job:jobs ( id, title, company, location, url, description ),
      resume_version:resume_versions ( id, name, version, content, file_path ),
     recruiter:contacts!applications_recruiter_fk ( id, name, email, role, last_contacted_at ),
     referral:contacts!applications_referral_fk ( id, name ),
      events:application_events ( id, event_type, event_date, metadata ),
      interviews ( id, type, scheduled_at, status, interviewer )
    `)
    .eq("id", applicationId)
    .eq("user_id", user.id)
    .order("event_date", { referencedTable: "application_events", ascending: false })
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  return NextResponse.json({ application: data });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ applicationId: string }> }
) {
  const { applicationId } = await params;
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json();
  const updates: Record<string, any> = {};

  if (body.status !== undefined) {
    if (!VALID_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    updates.status = body.status;
    if (body.status === "APPLIED") {
      updates.date_applied = new Date().toISOString();
    }
  }
  if (body.notes !== undefined) updates.notes = body.notes;
  if (body.resumeVersionId !== undefined) updates.resume_version_id = body.resumeVersionId;
  if (body.recruiterContactId !== undefined) updates.recruiter_contact_id = body.recruiterContactId;
  if (body.referralContactId !== undefined) updates.referral_contact_id = body.referralContactId;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("applications")
    .update(updates)
    .eq("id", applicationId)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Application not found or update failed" }, { status: 404 });
  }

  return NextResponse.json({ application: data });
}