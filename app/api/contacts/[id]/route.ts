import { NextRequest, NextResponse } from "next/server";
import { requireUser, readJsonBody, jsonError } from "@/lib/api";
import {
  isUuid,
  isContactRelationship,
  sanitizeText,
  isValidEmail,
  isValidHttpUrl,
  parseIsoTimestamp,
} from "@/lib/validation";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

// PATCH /api/contacts/[id] — update contact details / log last contact
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth.ctx;

  const { id } = await ctx.params;
  if (!isUuid(id)) return jsonError(404, "Contact not found");

  const body = await readJsonBody(req);
  if (!body) return jsonError(400, "Invalid JSON body");

  const updates: Record<string, unknown> = {};

  if (body.name !== undefined) {
    const name = sanitizeText(body.name, 200);
    if (!name) return jsonError(400, "name cannot be empty");
    updates.name = name;
  }

  if (body.company !== undefined) {
    const company = sanitizeText(body.company, 200);
    if (company === undefined) return jsonError(400, "Invalid company");
    updates.company = company;
  }

  if (body.role !== undefined) {
    const role = sanitizeText(body.role, 200);
    if (role === undefined) return jsonError(400, "Invalid role");
    updates.role = role;
  }

  if (body.email !== undefined) {
    if (body.email === null) {
      updates.email = null;
    } else if (typeof body.email === "string" && isValidEmail(body.email.trim())) {
      updates.email = body.email.trim().slice(0, 200);
    } else {
      return jsonError(400, "email must be a valid email address or null");
    }
  }

  if (body.linkedin_url !== undefined) {
    if (body.linkedin_url === null) {
      updates.linkedin_url = null;
    } else if (
      typeof body.linkedin_url === "string" &&
      isValidHttpUrl(body.linkedin_url.trim())
    ) {
      updates.linkedin_url = body.linkedin_url.trim().slice(0, 500);
    } else {
      return jsonError(400, "linkedin_url must be a valid http(s) URL or null");
    }
  }

  if (body.relationship !== undefined) {
    if (body.relationship === null) {
      updates.relationship = null;
    } else if (isContactRelationship(body.relationship)) {
      updates.relationship = body.relationship;
    } else {
      return jsonError(400, "Invalid relationship");
    }
  }

  if (body.notes !== undefined) {
    const notes = sanitizeText(body.notes, 5000);
    if (notes === undefined) return jsonError(400, "Invalid notes");
    updates.notes = notes;
  }

  if (body.last_contacted_at !== undefined) {
    const lastContactedAt = parseIsoTimestamp(body.last_contacted_at);
    if (lastContactedAt === null) {
      return jsonError(400, "last_contacted_at must be a valid ISO-8601 timestamp");
    }
    updates.last_contacted_at = lastContactedAt;
  }

  if (Object.keys(updates).length === 0) {
    return jsonError(400, "No valid fields to update");
  }

  const { data, error } = await supabase
    .from("contacts")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .maybeSingle();

  if (error) return jsonError(500, error.message);
  if (!data) return jsonError(404, "Contact not found");

  return NextResponse.json({ contact: data });
}

// DELETE /api/contacts/[id]
export async function DELETE(req: NextRequest, ctx: RouteContext) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth.ctx;

  const { id } = await ctx.params;
  if (!isUuid(id)) return jsonError(404, "Contact not found");

  const { data, error } = await supabase
    .from("contacts")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) return jsonError(500, error.message);
  if (!data) return jsonError(404, "Contact not found");

  return NextResponse.json({ success: true });
}
