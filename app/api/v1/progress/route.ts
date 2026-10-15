import { requireActorV1 } from "@/lib/actor";
import { loadProgress } from "@/lib/progress-store";
import { v1Error } from "@/lib/v1";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const actor = await requireActorV1();
    if (actor instanceof Response) return actor;
    const progress = await loadProgress(actor.userId);
    return Response.json(progress);
  } catch (err) {
    console.error(JSON.stringify({ level: "error", route: "/api/v1/progress", name: err instanceof Error ? err.name : "Error" }));
    return v1Error(500, "PROGRESS_FAILED", "Could not load progress.");
  }
}
