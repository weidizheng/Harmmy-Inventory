import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublicConfig } from "./config";

function isProtectedPath(pathname: string) {
  return pathname.startsWith("/inventory") || pathname.startsWith("/admin") || pathname.startsWith("/operations") || pathname.startsWith("/logs");
}

export async function updateSupabaseSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, publishableKey } = getSupabasePublicConfig();
  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  const { data: activeStaff } = user
    ? await supabase.rpc("is_active_staff")
    : { data: false };

  if (isProtectedPath(request.nextUrl.pathname) && (!user || !activeStaff)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("reason", user ? "inactive" : "signin");
    return NextResponse.redirect(loginUrl);
  }

  if (request.nextUrl.pathname === "/login" && user && activeStaff) {
    const inventoryUrl = request.nextUrl.clone();
    inventoryUrl.pathname = "/inventory";
    inventoryUrl.search = "";
    return NextResponse.redirect(inventoryUrl);
  }

  return response;
}
