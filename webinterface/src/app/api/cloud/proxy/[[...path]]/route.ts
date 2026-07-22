import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getConfigInternal } from "@/lib/db/configs";
import { ClientType, CLOUD_CONFIG_HEADER } from "@/lib/client/ClientTypes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function hashApiKey(apiKey: string) {
    return createHash("sha256").update(apiKey).digest("hex");
}

async function proxy(request: NextRequest, pathSegments: string[] | undefined) {
    const session = await getServerSession(authOptions);
    // @ts-ignore
    const userId = session?.user?.id as string | undefined;
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Header preferred; query used for EventSource (cannot set custom headers).
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
    const forwardSearch = new URLSearchParams(request.nextUrl.searchParams);
    forwardSearch.delete("configId");
    const search = forwardSearch.toString() ? `?${forwardSearch.toString()}` : "";
    const targetUrl = `${config.address.replace(/\/$/, "")}${agentPath}${search}`;

    const headers = new Headers();
    const contentType = request.headers.get("content-type");
    if (contentType) headers.set("content-type", contentType);
    headers.set("Authorization", `Bearer ${hashApiKey(config.apiKey)}`);

    const method = request.method.toUpperCase();
    const hasBody = !["GET", "HEAD"].includes(method);

    try {
        const agentRes = await fetch(targetUrl, {
            method,
            headers,
            body: hasBody ? request.body : undefined,
            // @ts-expect-error duplex required for streaming request bodies in Node
            duplex: hasBody ? "half" : undefined,
            cache: "no-store",
        });

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
