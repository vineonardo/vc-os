import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { appConfig, hasSupabaseEnv } from "@/lib/config";
import { DEMO_SESSION_COOKIE } from "@/lib/demo-cookie";

export async function updateSession(request: NextRequest) {
  if (appConfig.supabaseDisabled) {
    const response = NextResponse.next({ request });
    if (!request.cookies.get(DEMO_SESSION_COOKIE)?.value) {
      response.cookies.set(DEMO_SESSION_COOKIE, crypto.randomUUID(), {
        httpOnly: true,
        maxAge: 60 * 60 * 24 * 30,
        path: "/",
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });
    }
    return response;
  }

  if (!hasSupabaseEnv()) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(appConfig.supabaseUrl, appConfig.supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { pathname } = request.nextUrl;
  const protectedFounder = ["/chat", "/assets", "/credits"].some((path) =>
    pathname.startsWith(path),
  );
  const protectedInvestor = pathname.startsWith("/dashboard");
  const authPage = pathname === "/login" || pathname === "/signup";

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && (protectedFounder || protectedInvestor)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && authPage) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role,email")
      .eq("id", user.id)
      .maybeSingle();
    const url = request.nextUrl.clone();
    url.pathname =
      profile?.role === "investor" || user.email?.toLowerCase() === appConfig.devangEmail
        ? "/dashboard"
        : "/chat";
    return NextResponse.redirect(url);
  }

  if (user && (protectedFounder || protectedInvestor)) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role,email")
      .eq("id", user.id)
      .maybeSingle();

    const email = (profile?.email || user.email || "").toLowerCase();
    const isInvestor = profile?.role === "investor" || email === appConfig.devangEmail;

    if (protectedInvestor && !isInvestor) {
      const url = request.nextUrl.clone();
      url.pathname = "/chat";
      return NextResponse.redirect(url);
    }

    if (protectedFounder && isInvestor) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  return response;
}
