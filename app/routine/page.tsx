import type { Metadata } from "next";
import { RoutinePage } from "@/components/RoutinePage";

export const metadata: Metadata = {
  title: "Routine",
  description: "AM/PM skincare steps with check-offs.",
};

export default function RoutineRoute() {
  return <RoutinePage />;
}
