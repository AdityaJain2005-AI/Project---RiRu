import type { Metadata } from "next";
import { RoutinePage } from "@/components/RoutinePage";

export const metadata: Metadata = {
  title: "Routine",
  description: "AM/PM checklist, plus a list built from your latest scan.",
};

export default function RoutineRoute() {
  return <RoutinePage />;
}
