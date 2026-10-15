import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import { DISCLAIMER } from "@riru/shared";
import { getPool, query } from "./db.ts";

const PROCEDURES = ["laser", "peel", "microneedling", "other"] as const;
export type ProcedureType = (typeof PROCEDURES)[number];

export type PublicRecovery = {
  active: boolean;
  procedureType: ProcedureType | null;
  procedureOn: string | null;
  removedActives: string[];
  disclaimer: typeof DISCLAIMER;
  clinicianOverridesApp: string | null;
};

function dateOnly(value: Date | string | null): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value.slice(0, 10);
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${value.getFullYear()}-${month}-${day}`;
}

type RecoveryRow = {
  procedure_type: ProcedureType;
  procedure_on: Date | string | null;
  active: boolean;
};

export function isProcedureType(value: string): value is ProcedureType {
  return (PROCEDURES as readonly string[]).includes(value);
}

export function publicRecovery(
  row: RecoveryRow | null,
  removedActives: string[],
  message: string
): PublicRecovery {
  if (!row || !row.active) {
    return {
      active: false,
      procedureType: null,
      procedureOn: null,
      removedActives: [],
      disclaimer: DISCLAIMER,
      clinicianOverridesApp: null,
    };
  }
  const procedureOn = dateOnly(row.procedure_on);
  return {
    active: true,
    procedureType: row.procedure_type,
    procedureOn,
    removedActives,
    disclaimer: DISCLAIMER,
    clinicianOverridesApp: message,
  };
}

function recoveryCopy(): { removedActives: string[]; message: string } {
  const candidates = [
    path.join(process.cwd(), "data", "routines", "v1", "pack.yaml"),
    path.join(process.cwd(), "..", "data", "routines", "v1", "pack.yaml"),
  ];
  const file = candidates.find((candidate) => existsSync(candidate));
  if (!file) {
    return {
      removedActives: [],
      message: "A recovery note is active. Follow your clinician.",
    };
  }
  const parsed = parse(readFileSync(file, "utf8")) as {
    recovery_avoid?: string[];
    recovery_message?: string;
  };
  return {
    removedActives: Array.isArray(parsed.recovery_avoid) ? parsed.recovery_avoid : [],
    message:
      typeof parsed.recovery_message === "string"
        ? parsed.recovery_message
        : "A recovery note is active. Follow your clinician.",
  };
}

export async function loadRecovery(userId: string): Promise<PublicRecovery> {
  const copy = recoveryCopy();
  const found = await query<RecoveryRow>(
    `SELECT procedure_type, procedure_on, active
     FROM procedure_recoveries
     WHERE user_id = $1 AND active = true
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId]
  );
  return publicRecovery(found.rows[0] ?? null, copy.removedActives, copy.message);
}

export async function setRecoveryMode(input: {
  userId: string;
  active: boolean;
  procedureType: ProcedureType | null;
  procedureOn: string | null;
  clinicianNote: string;
}): Promise<PublicRecovery> {
  const copy = recoveryCopy();
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE procedure_recoveries SET active = false WHERE user_id = $1 AND active = true`,
      [input.userId]
    );
    if (!input.active || !input.procedureType) {
      await client.query("COMMIT");
      return publicRecovery(null, copy.removedActives, copy.message);
    }
    const inserted = await client.query<RecoveryRow>(
      `INSERT INTO procedure_recoveries
         (user_id, procedure_type, procedure_on, active, clinician_note)
       VALUES ($1, $2, $3::date, true, $4)
       RETURNING procedure_type, procedure_on, active`,
      [input.userId, input.procedureType, input.procedureOn, input.clinicianNote]
    );
    await client.query("COMMIT");
    return publicRecovery(inserted.rows[0], copy.removedActives, copy.message);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
