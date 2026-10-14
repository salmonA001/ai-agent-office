import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

/**
 * Where the confirmation email's link lands: trade the one-time code for a session (stored in
 * cookies), then go back to the office. A link opened in another browser can't finish the
 * exchange, but the email is confirmed by then, so the office asks the person to sign in.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  if (code) {
    const supabase = await createSupabaseServer();
    const { error } = (await supabase?.auth.exchangeCodeForSession(code)) ?? { error: true };
    if (!error) return NextResponse.redirect(`${origin}/?account=confirmed`);
  }
  return NextResponse.redirect(`${origin}/?account=signin`);
}
