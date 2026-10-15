import { DISCLAIMER } from "@riru/shared";
import { query } from "./db.ts";
import {
  beforeAfter,
  buildConcernTrends,
  concernsFromLegacy,
  type ConcernPoint,
  type ScanPoint,
} from "./progress.ts";

export type CheckInRow = {
  id: string;
  day: string;
  routineId: string | null;
  completedStepIds: string[];
  note: string | null;
};

export async function loadProgress(userId: string) {
  const scans = await query<{
    id: string;
    created_at: Date;
    analysis_kind: string;
    overall_score: number | null;
    summary: string;
    concerns: unknown;
    findings: ConcernPoint[] | null;
  }>(
    `SELECT s.id, s.created_at, s.analysis_kind, s.overall_score, s.summary, s.concerns,
            COALESCE(
              json_agg(
                json_build_object(
                  'concern', f.concern,
                  'severity', f.severity,
                  'confidence', f.confidence
                )
              ) FILTER (WHERE f.id IS NOT NULL),
              '[]'::json
            ) AS findings
     FROM skin_scans s
     LEFT JOIN scan_findings f ON f.scan_id = s.id
     WHERE s.user_id = $1 AND s.status = 'succeeded'
     GROUP BY s.id
     ORDER BY s.created_at ASC
     LIMIT 100`,
    [userId]
  );

  const points: ScanPoint[] = scans.rows.map((row) => {
    const findings = Array.isArray(row.findings) ? row.findings : [];
    return {
      id: row.id,
      createdAt: row.created_at.toISOString(),
      analysisKind: row.analysis_kind,
      overallScore: row.overall_score,
      summary: row.summary,
      concerns: findings.length > 0 ? findings : concernsFromLegacy(row.concerns),
    };
  });

  const checkIns = await query<{
    id: string;
    day: Date | string;
    routine_id: string | null;
    completed_step_ids: string[];
    note: string | null;
  }>(
    `SELECT id, to_char(day, 'YYYY-MM-DD') AS day, routine_id, completed_step_ids, note
     FROM check_ins
     WHERE user_id = $1
     ORDER BY day DESC
     LIMIT 30`,
    [userId]
  );

  return {
    disclaimer: DISCLAIMER,
    timeline: points.map((point) => ({
      id: point.id,
      createdAt: point.createdAt,
      analysisKind: point.analysisKind,
      sampleScore: point.analysisKind === "heuristic_v0",
      overallScore: point.overallScore,
      summary: point.summary,
    })),
    beforeAfter: beforeAfter(points),
    concerns: buildConcernTrends(points),
    checkIns: checkIns.rows.map((row) => ({
      id: row.id,
      day: typeof row.day === "string" ? row.day.slice(0, 10) : row.day.toISOString().slice(0, 10),
      routineId: row.routine_id,
      completedStepIds: row.completed_step_ids ?? [],
      note: row.note,
    })),
  };
}

export async function saveCheckIn(input: {
  userId: string;
  routineId: string | null;
  completedStepIds: string[];
  note: string | null;
}): Promise<CheckInRow> {
  if (input.routineId) {
    const owned = await query(
      `SELECT id FROM routines WHERE id = $1 AND user_id = $2`,
      [input.routineId, input.userId]
    );
    if (!owned.rowCount) {
      throw new CheckInError("That routine is not on this account.");
    }
  }
  const saved = await query<{
    id: string;
    day: Date | string;
    routine_id: string | null;
    completed_step_ids: string[];
    note: string | null;
  }>(
    `INSERT INTO check_ins (user_id, routine_id, day, completed_step_ids, note)
     VALUES ($1, $2, CURRENT_DATE, $3::uuid[], $4)
     ON CONFLICT (user_id, day) DO UPDATE SET
       routine_id = EXCLUDED.routine_id,
       completed_step_ids = EXCLUDED.completed_step_ids,
       note = EXCLUDED.note
     RETURNING id, to_char(day, 'YYYY-MM-DD') AS day, routine_id, completed_step_ids, note`,
    [input.userId, input.routineId, input.completedStepIds, input.note]
  );
  const row = saved.rows[0];
  return {
    id: row.id,
    day: typeof row.day === "string" ? row.day.slice(0, 10) : row.day.toISOString().slice(0, 10),
    routineId: row.routine_id,
    completedStepIds: row.completed_step_ids ?? [],
    note: row.note,
  };
}

export class CheckInError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CheckInError";
  }
}
