"use client";

import dynamic from "next/dynamic";

const ScanFlow = dynamic(() => import("./ScanFlow").then((m) => m.ScanFlow), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[280px] items-center justify-center rounded-2xl border border-zinc-200 bg-white text-sm text-zinc-500">
      Loading face scanner…
    </div>
  ),
});

export function ScanFlowClient() {
  return <ScanFlow />;
}
