import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth-options";
import {
    createAiChat,
    deleteAiChat,
    getAiChat,
    getLatestAiChat,
    listAiChats,
    upsertAiChat,
} from "@/lib/db/aiChats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function userIdFromSession(session: unknown): string | undefined {
    // @ts-ignore
    return session?.user?.id as string | undefined;
}

export async function GET(request: NextRequest) {
    const session = await getServerSession(authOptions);
    const userId = userIdFromSession(session);
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projectKey = request.nextUrl.searchParams.get("projectKey")?.trim();
    const id = request.nextUrl.searchParams.get("id")?.trim();
    const latest = request.nextUrl.searchParams.get("latest") === "1";

    if (id) {
        const chat = await getAiChat(userId, id);
        if (!chat) return NextResponse.json({ error: "Not found" }, { status: 404 });
        return NextResponse.json({ chat });
    }

    if (!projectKey) {
        return NextResponse.json({ error: "projectKey required" }, { status: 400 });
    }

    if (latest) {
        const chat = await getLatestAiChat(userId, projectKey);
        return NextResponse.json({ chat });
    }

    const chats = await listAiChats(userId, projectKey);
    return NextResponse.json({ chats });
}

export async function POST(request: NextRequest) {
    const session = await getServerSession(authOptions);
    const userId = userIdFromSession(session);
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: {
        projectKey?: string;
        title?: string;
        messages?: unknown[];
        geminiContents?: unknown[];
        model?: string | null;
    };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const projectKey = body.projectKey?.trim();
    if (!projectKey) {
        return NextResponse.json({ error: "projectKey required" }, { status: 400 });
    }

    const chat = await createAiChat({
        userId,
        projectKey,
        title: body.title,
        messages: body.messages,
        geminiContents: body.geminiContents,
        model: body.model,
    });
    return NextResponse.json({ chat });
}

export async function PUT(request: NextRequest) {
    const session = await getServerSession(authOptions);
    const userId = userIdFromSession(session);
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: {
        id?: string | null;
        projectKey?: string;
        title?: string;
        messages?: unknown[];
        geminiContents?: unknown[];
        model?: string | null;
    };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const projectKey = body.projectKey?.trim();
    if (!projectKey) {
        return NextResponse.json({ error: "projectKey required" }, { status: 400 });
    }
    if (!Array.isArray(body.messages) || !Array.isArray(body.geminiContents)) {
        return NextResponse.json(
            { error: "messages and geminiContents arrays required" },
            { status: 400 },
        );
    }

    const chat = await upsertAiChat({
        id: body.id,
        userId,
        projectKey,
        title: body.title,
        messages: body.messages,
        geminiContents: body.geminiContents,
        model: body.model,
    });
    return NextResponse.json({ chat });
}

export async function DELETE(request: NextRequest) {
    const session = await getServerSession(authOptions);
    const userId = userIdFromSession(session);
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const id = request.nextUrl.searchParams.get("id")?.trim();
    if (!id) {
        return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    const deleted = await deleteAiChat(userId, id);
    if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true, id: deleted.id });
}
