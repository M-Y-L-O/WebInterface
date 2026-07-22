import {NextRequest, NextResponse} from "next/server";
import {getServerSession} from "next-auth";
import {authOptions} from "@/lib/auth-options";
import {getCatalogItem} from "@/lib/db/catalog";
import {getFileBytes} from "@/lib/storage/r2bucket";

/**
 * Stream a catalog item file to the browser (auth required).
 */
export async function GET(
    _request: NextRequest,
    context: {params: Promise<{id: string}>},
) {
    const session = await getServerSession(authOptions);
    // @ts-ignore
    const userId = session?.user?.id as string | undefined;
    if (!userId) {
        return NextResponse.json({error: "Unauthorized"}, {status: 401});
    }

    const {id} = await context.params;
    if (!id) {
        return NextResponse.json({error: "Missing id"}, {status: 400});
    }

    try {
        const row = await getCatalogItem(id);
        if (!row?.cloudPath) {
            return NextResponse.json({error: "Catalog item not found"}, {status: 404});
        }

        const file = await getFileBytes(row.cloudPath);
        if (!file) {
            return NextResponse.json(
                {error: `File missing in storage (key: ${row.cloudPath})`},
                {status: 404},
            );
        }

        const body = Uint8Array.from(file.bytes);
        return new NextResponse(body, {
            status: 200,
            headers: {
                "Content-Type": file.contentType || "application/octet-stream",
                "Content-Disposition": `attachment; filename="${row.fileName}"`,
                "Content-Length": String(body.byteLength),
                "X-File-Name": row.fileName,
                "X-Catalog-Kind": row.kind,
                "Cache-Control": "no-store",
            },
        });
    } catch (e) {
        const message = e instanceof Error ? e.message : "Download failed";
        console.error("[api/storage/catalog]", id, e);
        return NextResponse.json({error: message}, {status: 502});
    }
}
