import { requireActorV1 } from "@/lib/actor";
import { imageRetention, setImageRetention } from "@/lib/privacy";
import { v1Error } from "@/lib/v1";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const actor = await requireActorV1();
    if (actor instanceof Response) return actor;
    return Response.json({ deleteAfterAnalysis: await imageRetention(actor.userId) });
  } catch (err) {
    console.error(JSON.stringify({ level: "error", route: "/api/v1/privacy/image-retention", name: err instanceof Error ? err.name : "Error" }));
    return v1Error(500, "PRIVACY_FAILED", "Could not load the image setting.");
  }
}

export async function PUT(req: Request) {
  try {
    const actor = await requireActorV1();
    if (actor instanceof Response) return actor;
    const body = (await req.json().catch(() => null)) as { deleteAfterAnalysis?: unknown } | null;
    if (typeof body?.deleteAfterAnalysis !== "boolean") {
      return v1Error(400, "VALIDATION", "deleteAfterAnalysis must be true or false.");
    }
    const deleteAfterAnalysis = await setImageRetention(actor.userId, body.deleteAfterAnalysis);
    return Response.json({ deleteAfterAnalysis });
  } catch (err) {
    console.error(JSON.stringify({ level: "error", route: "/api/v1/privacy/image-retention", name: err instanceof Error ? err.name : "Error" }));
    return v1Error(500, "PRIVACY_FAILED", "Could not save the image setting.");
  }
}
