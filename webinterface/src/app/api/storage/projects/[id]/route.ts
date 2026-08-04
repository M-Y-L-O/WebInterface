import {NextRequest, NextResponse} from "next/server";
import {getServerSession} from "next-auth";
import {authOptions} from "@/lib/auth-options";
import {getCloudProject} from "@/lib/db/cloudProjects";
import {getFileBytes} from "@/lib/storage/r2bucket";
import {CLOUD_DISABLED_ERROR, isCloudEnabled} from "@/lib/cloud/enabled";

function sanitizeProjectFileName(name: string): string {
    const trimmed = name.trim() || "project";
    const safe = trimmed.replace(/[^\w.\- ]+/g, "_").replace(/\s+/g, "_");
    return safe.endsWith(".mylo") ? safe : `${safe}.mylo`;
}

export async function GET(
    _request: NextRequest,
    context: {params: Promise<{id: string}>},
) {
    if (!isCloudEnabled()) {
        return NextResponse.json({error: CLOUD_DISABLED_ERROR}, {status: 403});
    }

    const session = await getServerSession(authOptions);
    // @ts-ignore
    const userId = session?.user?.id as string | undefined;
    if (!userId) {
        return NextResponse.json({error: "Unauthorized"}, {status: 401});
    }

    const {id} = await context.params;
    if (!id) {
        return NextResponse.json({error: "Missing project id"}, {status: 400});
    }

    try {
        const row = await getCloudProject(userId, id);
        if (!row?.cloudPath) {
            return NextResponse.json({error: "Cloud project not found"}, {status: 404});
        }

        const file = await getFileBytes(row.cloudPath);
        if (!file) {
            return NextResponse.json(
                { error: "File missing in storage" },
                { status: 404 },
            );
        }

        const fileName = sanitizeProjectFileName(row.name);
        const body = Uint8Array.from(file.bytes);

        return new NextResponse(body, {
            status: 200,
            headers: {
                "Content-Type": file.contentType || "application/octet-stream",
                "Content-Disposition": `attachment; filename="${fileName}"`,
                "Content-Length": String(body.byteLength),
                "X-File-Name": fileName,
                "Cache-Control": "no-store",
            },
        });
    } catch (e) {
        console.error("[api/storage/projects]", id, e);
        return NextResponse.json({ error: "Download failed" }, { status: 502 });
    }
}
