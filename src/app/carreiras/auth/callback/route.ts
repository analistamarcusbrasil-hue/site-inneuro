import { NextResponse, type NextRequest } from "next/server";
import { isCareersPortalEnabled } from "@/lib/careers/feature-flag";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function redirectToRecovery(request: NextRequest, error: string) {
  const url = new URL("/carreiras/recuperar-senha", request.url);
  url.searchParams.set("error", error);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  if (!isCareersPortalEnabled()) {
    return new NextResponse("Não encontrado", { status: 404 });
  }

  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  const authError = request.nextUrl.searchParams.get("error");
  if (authError || !tokenHash || type !== "recovery") {
    return redirectToRecovery(request, "expired");
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return redirectToRecovery(request, "config");
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: "recovery",
  });
  if (error) return redirectToRecovery(request, "expired");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return redirectToRecovery(request, "expired");

  return NextResponse.redirect(
    new URL("/carreiras/recuperar-senha?mode=update", request.url),
  );
}
