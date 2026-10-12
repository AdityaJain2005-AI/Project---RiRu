import type { PoolClient } from "pg";
import type { ProductRecord } from "@riru/shared";
import { loadIngredientData } from "./ingredient-catalog";

/** Insert the YAML rows a foreign key needs. The conflict check still reads YAML, not these rows. */
export async function upsertCatalogProduct(client: PoolClient, product: ProductRecord): Promise<void> {
  const { catalog } = loadIngredientData();
  const ingredientIds: string[] = [];
  for (const key of product.inci) {
    const entry = catalog.byKey.get(key);
    if (!entry) throw new Error("missing_inci");
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO ingredients (
         inci, functions, irritancy, comedogenicity, pregnancy_note, avoid_if,
         typical_range, plain_description, source
       ) VALUES ($1, $2::jsonb, $3, $4, $5, $6::jsonb, $7, $8, $9)
       ON CONFLICT (inci) DO UPDATE SET
         functions = EXCLUDED.functions,
         irritancy = EXCLUDED.irritancy,
         comedogenicity = EXCLUDED.comedogenicity,
         pregnancy_note = EXCLUDED.pregnancy_note,
         avoid_if = EXCLUDED.avoid_if,
         typical_range = EXCLUDED.typical_range,
         plain_description = EXCLUDED.plain_description,
         source = EXCLUDED.source,
         updated_at = NOW()
       RETURNING id`,
      [
        entry.inci,
        JSON.stringify(entry.functions),
        entry.irritancy,
        entry.comedogenicity,
        entry.pregnancyNote,
        JSON.stringify(entry.avoidIf),
        entry.typicalRange,
        entry.plainDescription,
        entry.source,
      ]
    );
    const id = inserted.rows[0]?.id;
    if (!id) throw new Error("ingredient_upsert");
    ingredientIds.push(id);
  }

  await client.query(
    `INSERT INTO products (
       id, slug, name, brand, step_kind, budget, fragrance_free, minimal_ingredient, description
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (id) DO UPDATE SET
       slug = EXCLUDED.slug,
       name = EXCLUDED.name,
       brand = EXCLUDED.brand,
       step_kind = EXCLUDED.step_kind,
       budget = EXCLUDED.budget,
       fragrance_free = EXCLUDED.fragrance_free,
       minimal_ingredient = EXCLUDED.minimal_ingredient,
       description = EXCLUDED.description`,
    [
      product.id,
      product.slug,
      product.name,
      product.brand,
      product.stepKind,
      product.budget,
      product.fragranceFree,
      product.minimalIngredient,
      product.description,
    ]
  );

  await client.query(`DELETE FROM product_ingredients WHERE product_id = $1`, [product.id]);
  for (let index = 0; index < ingredientIds.length; index += 1) {
    await client.query(
      `INSERT INTO product_ingredients (product_id, ingredient_id, position) VALUES ($1, $2, $3)`,
      [product.id, ingredientIds[index], index + 1]
    );
  }
}
