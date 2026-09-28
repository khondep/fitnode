import { NextRequest, NextResponse } from "next/server";
import { requireUser, readJsonBody, jsonError } from "@/lib/api";
import {
  isContactRelationship,
  sanitizeText,
  isValidEmail,
  isValidHttpUrl,
  parseIsoTimestamp,
} from "@/lib/validation";

export const dynamic = "force-dynamic";

// GET /api/contacts
export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth.ctx;

  const { data, error } = await supabase
    .from("contacts")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return jsonError(500, error.message);

  return NextResponse.json({ contacts: data ?? [] });
}

// POST /api/contacts — add a recruiter / hiring manager / referral
export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth.ctx;

  const body = await readJsonBody(req);
  if (!body) return jsonError(400, "Invalid JSON body");

  const name = sanitizeText(body.name, 200);
  if (!name) return jsonError(400, "name is required");

  if (body.relationship !== undefined && body.relationship !== null && !isContactRelationship(body.relationship)) {
    return jsonError(400, "Invalid relationship");
  }

  let email: string | null = null;
  if (body.email !== undefined && body.email !== null) {
    if (typeof body.email !== "string" || !isValidEmail(body.email.trim())) {
      return jsonError(400, "email must be a valid email address");
    }
    email = body.email.trim().slice(0, 200);
  }

  let linkedinUrl: string | null = null;
  if (body.linkedin_url !== undefined && body.linkedin_url !== null) {
    if (
      typeof body.linkedin_url !== "string" ||
      !isValidHttpUrl(body.linkedin_url.trim())
    ) {
      return jsonError(400, "linkedin_url must be a valid http(s) URL");
    }
    linkedinUrl = body.linkedin_url.trim().slice(0, 500);
  }

  const lastContactedAt = parseIsoTimestamp(body.last_contacted_at);
  if (lastContactedAt === null) {
    return jsonError(400, "last_contacted_at must be a valid ISO-8601 timestamp");
  }

  const { data, error } = await supabase
    .from("contacts")
    .insert({
      user_id: user.id,
      name,
      company: sanitizeText(body.company, 200) ?? null,
      role: sanitizeText(body.role, 200) ?? null,
      email,
      linkedin_url: linkedinUrl,
      relationship: body.relationship ?? null,
      notes: sanitizeText(body.notes, 5000) ?? null,
      last_contacted_at: lastContactedAt ?? null,
    })
    .select()
    .single();

  if (error) return jsonError(500, error.message);

  return NextResponse.json({ contact: data }, { status: 201 });
}
