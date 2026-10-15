import { requireActorV1 } from "@/lib/actor";
import { isProcedureType, loadRecovery, setRecoveryMode } from "@/lib/recovery";
import { v1Error } from "@/lib/v1";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const actor = await requireActorV1();
    if (actor instanceof Response) return actor;
    return Response.json(await loadRecovery(actor.userId));
  } catch (err) {
    console.error(JSON.stringify({ level: "error", route: "/api/v1/profile/recovery-mode", name: err instanceof Error ? err.name : "Error" }));
    return v1Error(500, "RECOVERY_FAILED", "Could not load recovery mode.");
  }
}

export async function POST(req: Request) {
  try {
    const actor = await requireActorV1();
    if (actor instanceof Response) return actor;
    const body = (await req.json().catch(() => null)) as {
      active?: unknown;
      procedureType?: unknown;
      procedureOn?: unknown;
      clinicianNote?: unknown;
    } | null;
    if (typeof body?.active !== "boolean") {
      return v1Error(400, "VALIDATION", "active must be true or false.");
    }
    const procedureType = typeof body.procedureType === "string" ? body.procedureType : "";
    if (body.active && !isProcedureType(procedureType)) {
      return v1Error(400, "VALIDATION", "procedureType must be laser, peel, microneedling, or other.");
    }
    const procedureOn = typeof body.procedureOn === "string" ? body.procedureOn : null;
    if (procedureOn && !/^\d{4}-\d{2}-\d{2}$/.test(procedureOn)) {
      return v1Error(400, "VALIDATION", "procedureOn must be a date.");
    }
    const clinicianNote = typeof body.clinicianNote === "string" ? body.clinicianNote.trim() : "";
    if (clinicianNote.length > 500) {
      return v1Error(400, "VALIDATION", "The clinician note is too long.");
    }
    const saved = await setRecoveryMode({
      userId: actor.userId,
      active: body.active,
      procedureType: body.active && isProcedureType(procedureType) ? procedureType : null,
      procedureOn: body.active ? procedureOn : null,
      clinicianNote,
    });
    return Response.json(saved);
  } catch (err) {
    console.error(JSON.stringify({ level: "error", route: "/api/v1/profile/recovery-mode", name: err instanceof Error ? err.name : "Error" }));
    return v1Error(500, "RECOVERY_FAILED", "Could not save recovery mode.");
  }
}
