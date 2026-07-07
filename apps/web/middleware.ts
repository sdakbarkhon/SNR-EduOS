import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // .sb3 excluded so TurboWarp's project_url embed (docs.turbowarp.org/
    // url-parameters) can fetch /blank-project.sb3 anonymously — without
    // this the auth redirect served /login's HTML instead of the file.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|sb3)$).*)",
  ],
};
