import { DEMO_USER_ID, query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request) {
  try {
    const body = (await req.json()) as {
      routinePhase?: "am" | "pm";
      skinType?: string;
      name?: string;
      favoriteIngredient?: { name: string; favorited: boolean };
      markNotificationsRead?: boolean;
      routineDone?: { phase: "am" | "pm"; steps: number[] };
    };

    if (body.routinePhase === "am" || body.routinePhase === "pm") {
      await query(
        `UPDATE user_prefs SET routine_phase = $2, updated_at = NOW() WHERE user_id = $1`,
        [DEMO_USER_ID, body.routinePhase]
      );
    }

    if (body.name || body.skinType) {
      await query(
        `UPDATE users SET
           name = COALESCE($2, name),
           skin_type = COALESCE($3, skin_type),
           initials = CASE WHEN $2 IS NULL THEN initials
             ELSE upper(left(split_part($2, ' ', 1), 1) || left(coalesce(nullif(split_part($2, ' ', 2), ''), split_part($2, ' ', 1)), 1))
           END,
           updated_at = NOW()
         WHERE id = $1`,
        [DEMO_USER_ID, body.name ?? null, body.skinType ?? null]
      );
    }

    if (body.favoriteIngredient) {
      const { name, favorited } = body.favoriteIngredient;
      const prefs = await query<{ favorite_ingredients: string[] }>(
        `SELECT favorite_ingredients FROM user_prefs WHERE user_id = $1`,
        [DEMO_USER_ID]
      );
      let list = Array.isArray(prefs.rows[0]?.favorite_ingredients)
        ? [...prefs.rows[0].favorite_ingredients]
        : [];
      if (favorited && !list.includes(name)) list.push(name);
      if (!favorited) list = list.filter((n) => n !== name);
      await query(
        `UPDATE user_prefs SET favorite_ingredients = $2::jsonb, updated_at = NOW() WHERE user_id = $1`,
        [DEMO_USER_ID, JSON.stringify(list)]
      );
    }

    if (body.markNotificationsRead) {
      await query(`UPDATE notifications SET read = TRUE WHERE user_id = $1`, [
        DEMO_USER_ID,
      ]);
    }

    if (body.routineDone) {
      const prefs = await query<{ settings: Record<string, unknown> }>(
        `SELECT settings FROM user_prefs WHERE user_id = $1`,
        [DEMO_USER_ID]
      );
      const settings = {
        ...(prefs.rows[0]?.settings ?? {}),
      } as { routineDone?: Record<string, number[]> };
      settings.routineDone = {
        ...(settings.routineDone ?? {}),
        [body.routineDone.phase]: body.routineDone.steps,
      };
      await query(
        `UPDATE user_prefs SET settings = $2::jsonb, updated_at = NOW() WHERE user_id = $1`,
        [DEMO_USER_ID, JSON.stringify(settings)]
      );
    }

    return Response.json({ ok: true });
  } catch (err) {
    console.error(err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Prefs update failed" },
      { status: 500 }
    );
  }
}
