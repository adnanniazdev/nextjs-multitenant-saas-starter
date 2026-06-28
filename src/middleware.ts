import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Define public routes that do not require authentication
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)", // Clerk/Stripe webhooks are public (verified cryptographically)
  "/invite/(.*)", // Acceptance page handles auth internally
]);

// Paths that should NOT be rewritten to subdomains
const isGlobalRoute = (pathname: string) => {
  return (
    pathname.startsWith("/sign-in") ||
    pathname.startsWith("/sign-up") ||
    pathname.startsWith("/workspaces") ||
    pathname.startsWith("/invite") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico")
  );
};

export default clerkMiddleware(async (auth, req) => {
  const url = req.nextUrl;
  const hostname = req.headers.get("host") || "";

  // 1. Resolve Subdomain
  // Configured local dev domains (lvh.me loops back to localhost) and prod domains
  const searchDomains = [
    ".localhost:3000",
    "localhost:3000",
    ".lvh.me:3000",
    "lvh.me:3000",
    ".yourdomain.com",
    "yourdomain.com",
  ];

  let subdomain = "";
  for (const domain of searchDomains) {
    if (hostname.endsWith(domain)) {
      subdomain = hostname.replace(domain, "");
      break;
    }
  }

  // Sanitize trailing dots
  subdomain = subdomain.replace(/\.+$/, "").trim();

  // If subdomain is 'www', ignore (render public landing page)
  if (subdomain === "www") {
    subdomain = "";
  }

  // 2. Route Protection
  if (!isPublicRoute(req)) {
    await auth.protect();
  }

  // 3. Subdomain Rewrite
  if (subdomain && !isGlobalRoute(url.pathname)) {
    // Rewrite subdomain request to dynamic route context internally:
    // e.g., acme.lvh.me:3000/dashboard -> /acme/dashboard
    if (!url.pathname.startsWith(`/${subdomain}`)) {
      return NextResponse.rewrite(
        new URL(`/${subdomain}${url.pathname}${url.search}`, req.url),
      );
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    "/((?!_next|[^?]*\\.(?:html|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API and tRPC routes
    "/(api|trpc)(.*)",
  ],
};
