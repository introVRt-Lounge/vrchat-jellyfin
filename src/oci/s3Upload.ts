import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { readFile } from "fs/promises";
import type { OciHlsPublishConfig } from "./config";

export function createOciS3Client(cfg: OciHlsPublishConfig): S3Client {
    return new S3Client({
        region: cfg.region,
        endpoint: cfg.endpoint,
        forcePathStyle: true,
        credentials: {
            accessKeyId: cfg.accessKey,
            secretAccessKey: cfg.secretKey,
        },
    });
}

function contentTypeForKey(key: string): string {
    if (key.endsWith(".m3u8")) return "application/vnd.apple.mpegurl";
    if (key.endsWith(".ts")) return "video/mp2t";
    if (key.endsWith(".m4s")) return "video/iso.segment";
    if (key.endsWith(".mp4")) return "video/mp4";
    return "application/octet-stream";
}

export async function putObjectFile(
    client: S3Client,
    cfg: OciHlsPublishConfig,
    objectKey: string,
    localPath: string,
    contentType?: string,
): Promise<void> {
    const body = await readFile(localPath);
    await client.send(
        new PutObjectCommand({
            Bucket: cfg.bucket,
            Key: objectKey,
            Body: body,
            ContentType: contentType || contentTypeForKey(objectKey),
            CacheControl: objectKey.endsWith(".m3u8")
                ? "public, max-age=60"
                : "public, max-age=86400",
        }),
    );
}

export async function putObjectBuffer(
    client: S3Client,
    cfg: OciHlsPublishConfig,
    objectKey: string,
    body: Buffer | string,
    contentType: string,
): Promise<void> {
    await client.send(
        new PutObjectCommand({
            Bucket: cfg.bucket,
            Key: objectKey,
            Body: typeof body === "string" ? Buffer.from(body, "utf8") : body,
            ContentType: contentType,
            CacheControl: objectKey.endsWith(".m3u8")
                ? "public, max-age=60"
                : "public, max-age=86400",
        }),
    );
}
