export type StorageName = "none" | "supabase" | "s3";

export type PutResult =
  | { ok: true; ref: string }
  | { ok: false; code: "STORAGE_DISABLED" | "STORAGE_MISCONFIGURED" | "STORAGE_PROVIDER_UNSUPPORTED" | "STORAGE_FAILED" };

export interface StorageProvider {
  readonly name: StorageName;
  putObject(input: {
    userId: string;
    objectId: string;
    bytes: Uint8Array;
    contentType: string;
  }): Promise<PutResult>;
  signedUrl(ref: string): Promise<string | null>;
  deleteObject(ref: string): Promise<void>;
}

class DiscardStorage implements StorageProvider {
  readonly name = "none" as const;

  async putObject(): Promise<PutResult> {
    return { ok: false, code: "STORAGE_DISABLED" };
  }

  async signedUrl(): Promise<null> {
    return null;
  }

  async deleteObject(): Promise<void> {}
}

class UnsupportedS3Storage implements StorageProvider {
  readonly name = "s3" as const;

  async putObject(): Promise<PutResult> {
    return { ok: false, code: "STORAGE_PROVIDER_UNSUPPORTED" };
  }

  async signedUrl(): Promise<null> {
    return null;
  }

  async deleteObject(): Promise<void> {}
}

type SupabaseConfig = { url: string; serviceKey: string; bucket: string; signTtl: number };

class SupabaseStorage implements StorageProvider {
  readonly name = "supabase" as const;
  private readonly config: SupabaseConfig | null;

  constructor(config: SupabaseConfig | null) {
    this.config = config;
  }

  async putObject(input: {
    userId: string;
    objectId: string;
    bytes: Uint8Array;
    contentType: string;
  }): Promise<PutResult> {
    if (!this.config) return { ok: false, code: "STORAGE_MISCONFIGURED" };
    const ref = `${input.userId}/${input.objectId}`;
    const endpoint = `${this.config.url}/storage/v1/object/${this.config.bucket}/${ref}`;
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.serviceKey}`,
          apikey: this.config.serviceKey,
          "Content-Type": input.contentType,
          "x-upsert": "true",
        },
        body: Buffer.from(input.bytes),
      });
      if (!res.ok) return { ok: false, code: "STORAGE_FAILED" };
      return { ok: true, ref };
    } catch {
      return { ok: false, code: "STORAGE_FAILED" };
    }
  }

  async signedUrl(ref: string): Promise<string | null> {
    if (!this.config) return null;
    const endpoint = `${this.config.url}/storage/v1/object/sign/${this.config.bucket}/${ref}`;
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.serviceKey}`,
          apikey: this.config.serviceKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ expiresIn: this.config.signTtl }),
      });
      if (!res.ok) return null;
      const body = (await res.json()) as { signedURL?: string };
      if (!body.signedURL) return null;
      return `${this.config.url}/storage/v1${body.signedURL}`;
    } catch {
      return null;
    }
  }

  async deleteObject(ref: string): Promise<void> {
    if (!this.config) return;
    const endpoint = `${this.config.url}/storage/v1/object/${this.config.bucket}`;
    await fetch(endpoint, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${this.config.serviceKey}`,
        apikey: this.config.serviceKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prefixes: [ref] }),
    }).catch(() => undefined);
  }
}

function supabaseConfig(): SupabaseConfig | null {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.STORAGE_BUCKET;
  if (!url || !serviceKey || !bucket) return null;
  const ttl = Number(process.env.STORAGE_SIGN_TTL_SECONDS ?? "600");
  return {
    url,
    serviceKey,
    bucket,
    signTtl: Number.isFinite(ttl) && ttl > 0 ? ttl : 600,
  };
}

export function getStorage(): StorageProvider {
  const name = (process.env.STORAGE_PROVIDER ?? "none").toLowerCase();
  if (name === "supabase") return new SupabaseStorage(supabaseConfig());
  if (name === "s3") return new UnsupportedS3Storage();
  return new DiscardStorage();
}
