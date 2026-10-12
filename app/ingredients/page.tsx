import type { Metadata } from "next";
import { IngredientFlow } from "@/components/IngredientFlow";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = {
  title: "Ingredient label",
  description: "Type a list or photograph a label. You confirm the text before a verdict.",
};

export default function IngredientsPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Ingredient label"
        title="Ingredient label"
        description="Type the list or photograph a label. You confirm the text. The result is a rule check for your profile, not a diagnosis and not a product pick."
      />
      <IngredientFlow />
    </div>
  );
}
