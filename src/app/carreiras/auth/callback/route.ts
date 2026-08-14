import { NextResponse, type NextRequest } from "next/server";
import {
  normalizeCandidateName,
  safeCareersDestination,
} from "@/lib/careers/auth-validation";
import { isCareersPortalEnabled } from "@/lib/careers/feature-flag";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function redirectToLogin(request: NextRequest, error: string) {
  const url = new URL("/carreiras/entrar", request.url);
  url.searchParams.set("error", error);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  if (!isCareersPortalEnabled()) {
    return new NextResponse("Não encontrado", { status: 404 });
  }

  const code = request.nextUrl.searchParams.get("code");
  const authError = request.nextUrl.searchParams.get("error");
  if (!code || authError) return redirectToLogin(request, "oauth");

  const supabase = await createSupabaseServerClient();
  if (!supabase) return redirectToLogin(request, "config");
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return redirectToLogin(request, "oauth");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return redirectToLogin(request, "session");

  const fullName = normalizeCandidateName(
    user.user_metadata.full_name ?? user.user_metadata.name,
  );
  const { error: accountError } = await supabase
    .from("candidate_accounts")
    .upsert(
      { id: user.id, full_name: fullName },
      { onConflict: "id", ignoreDuplicates: true },
    );
  if (accountError) {
    await supabase.auth.signOut();
    return redirectToLogin(request, "account");
  }

  const destination = safeCareersDestination(
    request.nextUrl.searchParams.get("next"),
  );
  return NextResponse.redirect(new URL(destination, request.url));
}
