export const R2_MEDIA_CACHE_CONTROL = "public, max-age=31536000, immutable";

/** Native R2 adapter for the media library's existing storage operations. */
export class R2Client {
  constructor(private readonly bucket: R2Bucket) {}

  buildKey(filename: string, path?: string): string {
    const directory = path?.replace(/^\/+|\/+$/g, "");
    return ["media", directory, filename].filter(Boolean).join("/");
  }

  async testConnection(): Promise<{ ok: boolean; message: string }> {
    try {
      await this.bucket.list({ limit: 1 });
      return { ok: true, message: "Cloudflare R2 连接成功。" };
    } catch {
      return { ok: false, message: "Cloudflare R2 连接失败，请检查存储桶绑定。" };
    }
  }

  async putObject(key: string, body: ArrayBuffer | Uint8Array | string, contentType: string): Promise<Response> {
    const object = await this.bucket.put(key, body, {
      httpMetadata: { contentType, cacheControl: R2_MEDIA_CACHE_CONTROL },
    });
    if (!object) throw new Error("R2 文件上传失败");
    return new Response(null, { status: 200, headers: { ETag: object.httpEtag } });
  }

  async getObject(key: string): Promise<Response> {
    const object = await this.bucket.get(key);
    if (!object) return new Response(null, { status: 404 });
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("ETag", object.httpEtag);
    headers.set("Content-Length", String(object.size));
    return new Response(object.body, { headers });
  }

  async deleteObject(key: string): Promise<void> {
    await this.bucket.delete(key);
  }

  async headObject(key: string): Promise<{ exists: boolean; contentType?: string; contentLength?: number }> {
    const object = await this.bucket.head(key);
    return object
      ? { exists: true, contentType: object.httpMetadata?.contentType, contentLength: object.size }
      : { exists: false };
  }
}
