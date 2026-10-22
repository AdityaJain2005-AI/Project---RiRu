import { DEMO_USER_ID, query } from "@/lib/db";
import { cleanIngredients, explainIngredients } from "@/lib/ocr";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { text?: string; save?: boolean };
    const text = (body.text ?? "").trim();
    if (!text) {
      return Response.json({ error: "Paste text or run OCR first." }, { status: 400 });
    }

    const ingredients = cleanIngredients(text);
    if (!ingredients.length) {
      return Response.json(
        {
          error: "Couldn't find ingredients. Try a clearer photo or paste the list.",
          raw: text,
        },
        { status: 422 }
      );
    }

    const details = explainIngredients(ingredients);

    if (body.save !== false) {
      await query(
        `INSERT INTO product_scans (user_id, raw, ingredients, details) VALUES ($1, $2, $3::jsonb, $4::jsonb)`,
        [DEMO_USER_ID, text, JSON.stringify(ingredients), JSON.stringify(details)]
      ).catch(() => undefined);

      await query(
        `INSERT INTO notifications (user_id, title, body) VALUES ($1, $2, $3)`,
        [
          DEMO_USER_ID,
          "Product label scanned",
          `${ingredients.length} ingredients parsed. Top: ${ingredients.slice(0, 4).join(", ")}.`,
        ]
      ).catch(() => undefined);
    }

    return Response.json({ ok: true, raw: text, ingredients, details });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "OCR parse failed" },
      { status: 500 }
    );
  }
}
