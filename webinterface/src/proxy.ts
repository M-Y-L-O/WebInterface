import { getToken } from "next-auth/jwt"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export async function proxy(req: NextRequest) {
    const token = await getToken({ req })
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
