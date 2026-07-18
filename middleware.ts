import type { NextRequest } from "next/server";
import { updateSupabaseSession } from "./lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSupabaseSession(request);
}

export const config = {
  matcher: ["/inventory/:path*", "/admin/:path*", "/operations/:path*", "/login"],
};
