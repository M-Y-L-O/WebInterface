import { getToken } from "next-auth/jwt"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

async function readSessionToken(req: NextRequest) {
    const secret = process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET
    // Prefer the request protocol over NEXTAUTH_URL. A leftover
    // NEXTAUTH_URL=http://localhost:3000 in production makes NextAuth set
    // `__Secure-…` cookies (HTTPS host) while getToken looks for the
    // non-secure name — which causes an /auth ↔ /home redirect loop.
    const secureCookie = req.nextUrl.protocol === "https:"
    const token = await getToken({ req, secret, secureCookie })
    if (token) return token
    return getToken({ req, secret, secureCookie: !secureCookie })
}

export async function proxy(req: NextRequest) {
    const token = await readSessionToken(req)
    if (token) {
        return NextResponse.next()
    }

    if (req.nextUrl.pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const signIn = new URL("/auth", req.url)
    signIn.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search)
    return NextResponse.redirect(signIn)
}

export const config = {
    matcher: [
        "/dashboard",
        "/home",
        "/api/cloud/:path*",
        "/api/ai/:path*",
        "/api/storage/:path*",
    ],
}
