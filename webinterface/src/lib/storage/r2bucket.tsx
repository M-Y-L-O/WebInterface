import {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand,
} from "@aws-sdk/client-s3";

const DEFAULT_BUCKET = process.env.R2_BUCKET_NAME || "mylo";

const client = new S3Client({
    region: "auto",
    endpoint: process.env.R2_BUCKET_ENDPOINT,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
    },
});

/**
 * Upload a file under `path/file.name`.
 * @returns the object key written to R2
 */
export async function uploadFile(file: File, path: string, bucketName = DEFAULT_BUCKET) {
    const key = `${path.replace(/\/+$/, "")}/${file.name}`;
    const body = Buffer.from(await file.arrayBuffer());

    const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: body,
        ContentType: file.type || "application/octet-stream",
    });

    try {
        await client.send(command);
        return key;
    } catch (e) {
        console.error("[r2] uploadFile", e);
        throw e;
    }
}

export async function deleteFile(path: string, bucketName = DEFAULT_BUCKET) {
    const command = new DeleteObjectCommand({
        Bucket: bucketName,
        Key: path,
    });

    try {
        await client.send(command);
    } catch (error) {
        console.error("[r2] deleteFile", error);
        throw error;
    }
}

/** @deprecated Prefer getFileBytes — base64 through server actions blows past body limits. */
export type R2FilePayload = {
    data: string; // base64
    contentType: string;
};

export async function getFileBytes(
    path: string,
    bucketName = DEFAULT_BUCKET,
): Promise<{bytes: Uint8Array; contentType: string} | null> {
    const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: path,
    });

    try {
        const response = await client.send(command);
        if (!response.Body) return null;

        // AWS SDK v3: Body is an SdkStream — use transformToByteArray, not Node Readable casting.
        const bytes = await response.Body.transformToByteArray();
        return {
            bytes,
            contentType: response.ContentType || "application/octet-stream",
        };
    } catch (error) {
        console.error("[r2] getFileBytes", path, error);
        throw error;
    }
}

export async function getFile(path: string, bucketName = DEFAULT_BUCKET): Promise<R2FilePayload | null> {
    const result = await getFileBytes(path, bucketName);
    if (!result) return null;
    return {
        data: Buffer.from(result.bytes).toString("base64"),
        contentType: result.contentType,
    };
}
