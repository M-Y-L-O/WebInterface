import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getConfigInternal } from "@/lib/db/configs";
import { assertSafeProxyTarget } from "@/lib/cloud/proxyTarget";
import { CLOUD_DISABLED_ERROR, isCloudEnabled } from "@/lib/cloud/enabled";
import { ClientType, CLOUD_CONFIG_HEADER } from "@/lib/client/ClientTypes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function hashApiKey(apiKey: string) {
    return createHash("sha256").update(apiKey).digest("hex");
}

/** New rows store sha256 hex; legacy rows may still hold plaintext. */
function bearerToken(apiKey: string) {
    if (/^[a-f0-9]{64}$/i.test(apiKey)) return apiKey;
    return hashApiKey(apiKey);
}

async function proxy(request: NextRequest, pathSegments: string[] | undefined) {
    if (!isCloudEnabled()) {
        return NextResponse.json({ error: CLOUD_DISABLED_ERROR }, { status: 403 });
    }

    const session = await getServerSession(authOptions);
    // @ts-ignore
    const userId = session?.user?.id as string | undefined;
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const configId =
        request.headers.get(CLOUD_CONFIG_HEADER) ||
        request.nextUrl.searchParams.get("configId");
    if (!configId) {
        return NextResponse.json({ error: `Missing ${CLOUD_CONFIG_HEADER} header` }, { status: 400 });
    }

    const config = await getConfigInternal(userId, configId);
    if (!config || config.type !== ClientType.CLOUD) {
        return NextResponse.json({ error: "Cloud config not found" }, { status: 404 });
    }
    if (!config.address || !config.apiKey) {
        return NextResponse.json({ error: "Cloud session not provisioned" }, { status: 409 });
    }

    const agentPath = pathSegments && pathSegments.length > 0
        ? `/${pathSegments.join("/")}`
        : "/";

    let target: URL;
    try {
        target = assertSafeProxyTarget(config.address, agentPath);
    } catch (e) {
        const message = e instanceof Error ? e.message : "Invalid proxy target";
        return NextResponse.json({ error: message }, { status: 400 });
    }

    const forwardSearch = new URLSearchParams(request.nextUrl.searchParams);
    forwardSearch.delete("configId");
    const search = forwardSearch.toString() ? `?${forwardSearch.toString()}` : "";
    const targetUrl = `${target.origin}${target.pathname}${search}`;

    const headers = new Headers();
    const contentType = request.headers.get("content-type");
    if (contentType) headers.set("content-type", contentType);
    headers.set("Authorization", `Bearer ${bearerToken(config.apiKey)}`);

    const method = request.method.toUpperCase();
    const hasBody = !["GET", "HEAD"].includes(method);

    try {
        const agentRes = await fetch(targetUrl, {
            method,
            headers,
            body: hasBody ? request.body : undefined,
            // @ts-expect-error duplex is required for streaming request bodies in Node fetch
            duplex: hasBody ? "half" : undefined,
            cache: "no-store",
            redirect: "manual",
        });

        // Do not follow redirects (SSRF / credential leak via Location).
        if (agentRes.status >= 300 && agentRes.status < 400) {
            return NextResponse.json({ error: "Unexpected redirect from agent" }, { status: 502 });
        }

        const outHeaders = new Headers();
        const passThrough = ["content-type", "content-disposition", "cache-control"];
        for (const key of passThrough) {
            const value = agentRes.headers.get(key);
            if (value) outHeaders.set(key, value);
        }

        return new NextResponse(agentRes.body, {
            status: agentRes.status,
            headers: outHeaders,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Proxy request failed";
        return NextResponse.json({ error: message }, { status: 502 });
    }
}

type Ctx = { params: Promise<{ path?: string[] }> };

export async function GET(request: NextRequest, ctx: Ctx) {
    const { path } = await ctx.params;
    return proxy(request, path);
}

export async function POST(request: NextRequest, ctx: Ctx) {
    const { path } = await ctx.params;
    return proxy(request, path);
}

export async function PUT(request: NextRequest, ctx: Ctx) {
    const { path } = await ctx.params;
    return proxy(request, path);
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
    const { path } = await ctx.params;
    return proxy(request, path);
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
    const { path } = await ctx.params;
    return proxy(request, path);
}
