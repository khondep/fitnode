import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/auth";

const VALID_TYPES = [
  "PHONE_SCREEN", "RECRUITER_SCREEN", "TECHNICAL", "BEHAVIORAL",
  "SYSTEM_DESIGN", "ONSITE", "FINAL", "OTHER",
];

export async function POST(req: NextRequest) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json();
  const { applicationId, type, scheduledAt } = body;

  if (!applicationId) return NextResponse.json({ error: "applicationId is required" }, { status: 400 });
  if (type && !VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: "Invalid interview type" }, { status: 400 });
  }

  // Confirm the application belongs to this user
  const { data: app, error: appError } = await supabase
    .from("applications")
    .select("id")
    .eq("id", applicationId)
    .eq("user_id", user.id)
    .single();

  if (appError || !app) return NextResponse.json({ error: "Application not found" }, { status: 404 });

  const { data, error } = await supabase
    .from("interviews")
    .insert({
      user_id: user.id,
      application_id: applicationId,
      type: type ?? "OTHER",
      scheduled_at: scheduledAt ?? null,
      duration_minutes: body.durationMinutes ?? null,
      meeting_url: body.meetingUrl ?? null,
      interviewer: body.interviewer ?? null,
      notes: body.notes ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Log this on the timeline — interviews don't go through the status trigger, so we do it explicitly
  await supabase.from("application_events").insert({
    user_id: user.id,
    application_id: applicationId,
    event_type: "INTERVIEW_SCHEDULED",
    metadata: { interview_id: data.id, type: data.type, scheduled_at: data.scheduled_at },
  });

  return NextResponse.json({ interview: data }, { status: 201 });
}