import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export default clerkMiddleware(async (auth, req) => {
    const { userId, orgId } = await auth();
    const { pathname } = req.nextUrl;

    const isPublicRoute = pathname.startsWith("/sign-in") || pathname.startsWith("/sign-up");

    if (isPublicRoute) {
        return NextResponse.next();
    }

    if (!userId) {
        await auth.protect();
    }

    const isOrgSelectionRoute = pathname.startsWith("/org-selection");

    //allow org selection page
    if (isOrgSelectionRoute) {
        return NextResponse.next();
    }

    // for all protected routes, ensure org is selected
    if (userId && !orgId) {
        const orgSelection = new URL("/org-selection", req.url);
        return NextResponse.redirect(orgSelection);
    }

    return NextResponse.next();
})

export const config = {
    matcher: [
        // Skip Next.js internals and all static files, unless found in search params
        '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
        // Always run for API routes
        '/(api|trpc)(.*)',
        // Always run for Clerk-specific frontend API routes
        '/__clerk/(.*)',
    ],
}