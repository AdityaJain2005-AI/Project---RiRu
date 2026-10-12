import { requireActorV1 } from "@/lib/actor";
import { deleteOwnedScan, getOwnedScan } from "@/lib/scan-job";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function v1Error(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireActorV1();
    if (actor instanceof Response) return actor;
    const { id } = await ctx.params;
    if (!UUID.test(id)) return v1Error(404, "NOT_FOUND", "Scan not found.");
    const scan = await getOwnedScan(actor.userId, id);
    if (!scan) return v1Error(404, "NOT_FOUND", "Scan not found.");
    return Response.json(scan);
  } catch (err) {
    console.error(
      JSON.stringify({
        level: "error",
        route: "/api/v1/scans/:id",
        code: "scan_get_failed",
        name: err instanceof Error ? err.name : "Error",
      })
    );
    return v1Error(500, "SCAN_FAILED", "Could not load the scan.");
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireActorV1();
    if (actor instanceof Response) return actor;
    const { id } = await ctx.params;
    if (!UUID.test(id)) return v1Error(404, "NOT_FOUND", "Scan not found.");
    const removed = await deleteOwnedScan(actor.userId, id);
    if (!removed) return v1Error(404, "NOT_FOUND", "Scan not found.");
    return new Response(null, { status: 204 });
  } catch (err) {
    console.error(
      JSON.stringify({
        level: "error",
        route: "/api/v1/scans/:id",
        code: "scan_delete_failed",
        name: err instanceof Error ? err.name : "Error",
      })
    );
    return v1Error(500, "SCAN_FAILED", "Could not delete the scan.");
  }
}
