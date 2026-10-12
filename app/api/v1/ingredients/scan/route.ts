import { after } from "next/server";
import { requireActorV1 } from "@/lib/actor";
import { MAX_IMAGE_BYTES, sniffImage } from "@/lib/image-bytes";
import {
  MAX_LABEL_CHARS,
  completeIngredientScan,
  createIngredientScan,
} from "@/lib/ingredient-job";

export const dynamic = "force-dynamic";

function v1Error(status: number, code: string, message: string, headers?: HeadersInit) {
  return Response.json({ error: { code, message } }, { status, headers });
}

export async function POST(req: Request) {
  try {
    const actor = await requireActorV1();
    if (actor instanceof Response) return actor;

    const rawKey = req.headers.get("idempotency-key")?.trim() ?? "";
    if (rawKey.length > 80) {
      return v1Error(400, "VALIDATION", "Idempotency-Key is too long.");
    }

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return v1Error(400, "VALIDATION", "Send the label as multipart form data.");
    }

    if (form.get("disclaimerAck") !== "true") {
      return v1Error(
        400,
        "VALIDATION",
        "Confirm that this is informational only, not a medical diagnosis."
      );
    }

    const textField = form.get("text");
    if (textField instanceof Blob) {
      return v1Error(400, "VALIDATION", "Send the ingredient list as text.");
    }
    const text = typeof textField === "string" ? textField.trim() : "";
    if (text.length > MAX_LABEL_CHARS) {
      return v1Error(400, "VALIDATION", "The ingredient list is too long.");
    }

    let bytes: Uint8Array | null = null;
    let contentType: string | null = null;
    if (!text) {
      const image = form.get("image");
      if (!(image instanceof Blob)) {
        return v1Error(400, "VALIDATION", "Type an ingredient list or choose a JPEG, PNG, or WebP photo.");
      }
      if (image.size > MAX_IMAGE_BYTES) {
        return v1Error(413, "PAYLOAD_TOO_LARGE", "Image is larger than 8 MB.");
      }
      bytes = new Uint8Array(await image.arrayBuffer());
      if (bytes.byteLength > MAX_IMAGE_BYTES) {
        return v1Error(413, "PAYLOAD_TOO_LARGE", "Image is larger than 8 MB.");
      }
      contentType = sniffImage(bytes);
      if (!contentType) {
        return v1Error(415, "UNSUPPORTED_MEDIA", "Send a JPEG, PNG, or WebP image.");
      }
    }

    const created = await createIngredientScan({
      userId: actor.userId,
      text: text || null,
      bytes,
      contentType,
      storeRequested: !text && form.get("storeImage") === "true",
      idempotencyKey: rawKey.length > 0 ? rawKey : null,
    });
    if (!created.ok) {
      const headers = created.limit
        ? {
            "Retry-After": String(created.limit.retryAfter),
            "X-RateLimit-Limit": String(created.limit.limit),
            "X-RateLimit-Remaining": String(created.limit.remaining),
          }
        : undefined;
      return v1Error(created.status, created.code, created.message, headers);
    }

    if (created.fresh && created.work) {
      const work = created.work;
      after(() => completeIngredientScan(work));
    }

    console.log(
      JSON.stringify({
        level: "info",
        route: "/api/v1/ingredients/scan",
        code: created.fresh ? "ingredient_queued" : "ingredient_replayed",
      })
    );

    return Response.json(created.scan, { status: 202 });
  } catch (err) {
    console.error(
      JSON.stringify({
        level: "error",
        route: "/api/v1/ingredients/scan",
        code: "ingredient_post_failed",
        name: err instanceof Error ? err.name : "Error",
      })
    );
    return v1Error(500, "SCAN_FAILED", "Could not start the ingredient check.");
  }
}
