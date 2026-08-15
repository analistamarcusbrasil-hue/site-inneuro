import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { safeCareersDestination } from "@/lib/careers/auth-validation";
import { ensureCandidateOnboarding } from "@/lib/careers/candidate-onboarding";
import { isCareersPortalEnabled } from "@/lib/careers/feature-flag";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function redirectToLogin(request: NextRequest, error: string) {
  const url = new URL("/carreiras/entrar", request.url);
  url.searchParams.set("error", error);
  url.searchParams.set(
    "next",
    safeCareersDestination(request.nextUrl.searchParams.get("next")),
  );
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  if (!isCareersPortalEnabled()) {
    return new NextResponse("Não encontrado", { status: 404 });
  }

  const code = request.nextUrl.searchParams.get("code");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;
  const authError = request.nextUrl.searchParams.get("error");
  const isRecovery = Boolean(tokenHash && type === "recovery");
  if (authError || (!code && !isRecovery)) {
    return redirectToLogin(request, "oauth");
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return redirectToLogin(request, "config");
  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : await supabase.auth.verifyOtp({
        token_hash: tokenHash!,
        type: "recovery",
      });
  if (error) return redirectToLogin(request, "oauth");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return redirectToLogin(request, "session");

  const requestedDestination = safeCareersDestination(
    request.nextUrl.searchParams.get("next"),
  );
  if (isRecovery) {
    return NextResponse.redirect(new URL(requestedDestination, request.url));
  }

  let profileSufficient = false;
  try {
    ({ profileSufficient } = await ensureCandidateOnboarding(supabase, user));
  } catch {
    await supabase.auth.signOut();
    return redirectToLogin(request, "account");
  }

  const destination = profileSufficient
    ? requestedDestination
    : "/carreiras/perfil";
  return NextResponse.redirect(new URL(destination, request.url));
}
