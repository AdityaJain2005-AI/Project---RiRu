import { DISCLAIMER } from "@riru/shared";
import { requireActorV1 } from "@/lib/actor";
import { CheckInError, saveCheckIn } from "@/lib/progress-store";
import { isUuid, v1Error } from "@/lib/v1";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const actor = await requireActorV1();
    if (actor instanceof Response) return actor;
    const body = (await req.json().catch(() => null)) as {
      routineId?: unknown;
      completedStepIds?: unknown;
      note?: unknown;
    } | null;
    const routineId = typeof body?.routineId === "string" ? body.routineId : null;
    if (routineId && !isUuid(routineId)) {
      return v1Error(400, "VALIDATION", "routineId must be a uuid.");
    }
    const rawIds = Array.isArray(body?.completedStepIds) ? body.completedStepIds : [];
    if (rawIds.length > 40 || rawIds.some((id) => typeof id !== "string" || !isUuid(id))) {
      return v1Error(400, "VALIDATION", "completedStepIds must be at most 40 uuids.");
    }
    const note = typeof body?.note === "string" ? body.note.trim() : "";
    if (note.length > 500) return v1Error(400, "VALIDATION", "The note is too long.");
    const saved = await saveCheckIn({
      userId: actor.userId,
      routineId,
      completedStepIds: [...new Set(rawIds as string[])],
      note: note || null,
    });
    return Response.json({ ...saved, disclaimer: DISCLAIMER }, { status: 201 });
  } catch (err) {
    if (err instanceof CheckInError) return v1Error(404, "NOT_FOUND", err.message);
    console.error(JSON.stringify({ level: "error", route: "/api/v1/check-ins", name: err instanceof Error ? err.name : "Error" }));
    return v1Error(500, "CHECKIN_FAILED", "Could not save the check-in.");
  }
}
