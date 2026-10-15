import { requireActorV1 } from "@/lib/actor";
import { isConsentPurpose, recordConsent } from "@/lib/privacy";
import { v1Error } from "@/lib/v1";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const actor = await requireActorV1();
    if (actor instanceof Response) return actor;
    const body = (await req.json().catch(() => null)) as {
      purpose?: unknown;
      granted?: unknown;
      policyVersion?: unknown;
    } | null;
    const purpose = typeof body?.purpose === "string" ? body.purpose : "";
    if (!isConsentPurpose(purpose) || typeof body?.granted !== "boolean") {
      return v1Error(400, "VALIDATION", "purpose and granted are required.");
    }
    const policyVersion = typeof body.policyVersion === "string" ? body.policyVersion.trim() : "";
    if (!policyVersion || policyVersion.length > 40) {
      return v1Error(400, "VALIDATION", "policyVersion is required.");
    }
    const saved = await recordConsent({
      userId: actor.userId,
      purpose,
      granted: body.granted,
      policyVersion,
    });
    return Response.json(saved, { status: 201 });
  } catch (err) {
    console.error(JSON.stringify({ level: "error", route: "/api/v1/consent", name: err instanceof Error ? err.name : "Error" }));
    return v1Error(500, "CONSENT_FAILED", "Could not record consent.");
  }
}
