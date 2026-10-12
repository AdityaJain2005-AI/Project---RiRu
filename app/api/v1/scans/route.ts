import { after } from "next/server";
import { DISCLAIMER } from "@riru/shared";
import { requireActorV1 } from "@/lib/actor";
import { MAX_IMAGE_BYTES, sniffImage } from "@/lib/image-bytes";
import { completeFaceScan, createFaceScan, listOwnedScans } from "@/lib/scan-job";

export const dynamic = "force-dynamic";

function v1Error(
  status: number,
  code: string,
  message: string,
  headers?: HeadersInit
) {
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
      return v1Error(400, "VALIDATION", "Send the photo as multipart form data.");
    }

    if (form.get("disclaimerAck") !== "true") {
      return v1Error(
        400,
        "VALIDATION",
        "Confirm that this is informational only, not a medical diagnosis."
      );
    }

    const image = form.get("image");
    if (!(image instanceof Blob)) {
      return v1Error(400, "VALIDATION", "Choose a JPEG, PNG, or WebP photo.");
    }
    if (image.size > MAX_IMAGE_BYTES) {
      return v1Error(413, "PAYLOAD_TOO_LARGE", "Image is larger than 8 MB.");
    }
    const bytes = new Uint8Array(await image.arrayBuffer());
    if (bytes.byteLength > MAX_IMAGE_BYTES) {
      return v1Error(413, "PAYLOAD_TOO_LARGE", "Image is larger than 8 MB.");
    }
    const contentType = sniffImage(bytes);
    if (!contentType) {
      return v1Error(415, "UNSUPPORTED_MEDIA", "Send a JPEG, PNG, or WebP image.");
    }

    const sourceField = form.get("source");
    const source = sourceField === "camera" || sourceField === "upload" ? sourceField : "upload";
    const created = await createFaceScan({
      userId: actor.userId,
      bytes,
      contentType,
      source,
      storeRequested: form.get("storeImage") === "true",
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
      after(() => completeFaceScan(work));
    }

    console.log(
      JSON.stringify({
        level: "info",
        route: "/api/v1/scans",
        code: created.fresh ? "scan_queued" : "scan_replayed",
      })
    );

    return Response.json(
      {
        scan: {
          id: created.scan.id,
          status: created.scan.status,
          imageStored: created.scan.imageStored,
        },
        disclaimer: DISCLAIMER,
      },
      { status: 202 }
    );
  } catch (err) {
    console.error(
      JSON.stringify({
        level: "error",
        route: "/api/v1/scans",
        code: "scan_post_failed",
        name: err instanceof Error ? err.name : "Error",
      })
    );
    return v1Error(500, "SCAN_FAILED", "Could not start the scan.");
  }
}

export async function GET(req: Request) {
  try {
    const actor = await requireActorV1();
    if (actor instanceof Response) return actor;
    const url = new URL(req.url);
    const limit = Number(url.searchParams.get("limit") ?? "20");
    if (!Number.isFinite(limit) || limit < 1) {
      return v1Error(400, "VALIDATION", "limit must be between 1 and 50.");
    }
    const listed = await listOwnedScans(actor.userId, url.searchParams.get("cursor"), limit);
    if (!listed.ok) return v1Error(400, "VALIDATION", listed.message);
    return Response.json({
      scans: listed.scans,
      nextCursor: listed.nextCursor,
      disclaimer: DISCLAIMER,
    });
  } catch (err) {
    console.error(
      JSON.stringify({
        level: "error",
        route: "/api/v1/scans",
        code: "scan_list_failed",
        name: err instanceof Error ? err.name : "Error",
      })
    );
    return v1Error(500, "SCAN_FAILED", "Could not list scans.");
  }
}
