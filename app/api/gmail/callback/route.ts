import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseServerClient } from "@/lib/auth";
import { encrypt } from "@/lib/crypto";

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const fail = () => NextResponse.redirect(`${origin}/settings?gmail=error`);

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const saved = req.cookies.get("gmail_oauth_state")?.value;
  if (!code || !state || state !== saved) return fail();

  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${origin}/api/gmail/callback`,
      grant_type: "authorization_code",
    }),
  });
  const tokens = await tokenRes.json();
  if (!tokens.refresh_token || !tokens.access_token) return fail();

  const info = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  }).then((r) => r.json());
  if (!info.email) return fail();

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { error } = await admin.from("gmail_connections").upsert({
    user_id: user.id,
    email: info.email,
    refresh_token_enc: encrypt(tokens.refresh_token),
    scope: tokens.scope,
    updated_at: new Date().toISOString(),
  });
  if (error) return fail();

  const res = NextResponse.redirect(`${origin}/settings?gmail=connected`);
  res.cookies.delete("gmail_oauth_state");
  return res;
}