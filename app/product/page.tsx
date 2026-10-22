import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { ProductScan } from "@/components/ProductScan";

export const metadata: Metadata = {
  title: "Product OCR",
  description: "Read a skincare ingredient label with Tesseract.",
};

export default function ProductPage() {
  return (
    <div>
      <PageHeader
        eyebrow="OCR"
        title="Product scanner"
        description="Photograph an INCI list or paste the text. We clean the names and flag actives, irritants, and barrier helpers."
      />
      <ProductScan />
    </div>
  );
}
