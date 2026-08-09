"use client";

import * as React from "react";

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "secondary" | "outline" | "ghost" | "soft" | "danger";
  size?: "default" | "sm" | "lg" | "icon";
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
        variant === "default" &&
          "bg-emerald-600 text-white shadow-sm shadow-emerald-600/25 hover:bg-emerald-500",
        variant === "secondary" && "bg-zinc-900 text-white hover:bg-zinc-800",
        variant === "outline" &&
          "border border-zinc-200/90 bg-white text-zinc-900 shadow-sm hover:bg-zinc-50",
        variant === "ghost" && "text-zinc-600 hover:bg-zinc-100/80 hover:text-zinc-900",
        variant === "soft" && "bg-emerald-50 text-emerald-800 hover:bg-emerald-100",
        variant === "danger" && "bg-rose-50 text-rose-700 hover:bg-rose-100",
        size === "default" && "h-10 px-4 py-2",
        size === "sm" && "h-8 rounded-lg px-3 text-xs",
        size === "lg" && "h-12 rounded-2xl px-6 text-[15px]",
        size === "icon" && "h-10 w-10",
        className
      )}
      {...props}
    />
  );
}

export function Badge({
  className,
  tone = "zinc",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  tone?: "zinc" | "emerald" | "teal" | "amber" | "rose" | "white";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium tracking-wide",
        tone === "zinc" && "bg-zinc-100 text-zinc-600",
        tone === "emerald" &&
          "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-100",
        tone === "teal" && "bg-teal-50 text-teal-700 ring-1 ring-inset ring-teal-100",
        tone === "amber" && "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-100",
        tone === "rose" && "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-100",
        tone === "white" && "bg-white/90 text-zinc-700 shadow-sm ring-1 ring-zinc-200/60",
        className
      )}
      {...props}
    />
  );
}

export function Card({
  className,
  elevated,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { elevated?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-zinc-200/70 bg-white",
        elevated
          ? "shadow-[0_8px_30px_rgba(24,24,27,0.06)]"
          : "shadow-sm shadow-zinc-900/[0.03]",
        className
      )}
      {...props}
    />
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="max-w-xl space-y-1.5">
        {eyebrow && (
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700/80">
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-[1.75rem]">
          {title}
        </h1>
        {description && (
          <p className="text-sm leading-relaxed text-zinc-500">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-xl bg-zinc-200/70",
        className
      )}
    />
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
        <span className="text-lg">◇</span>
      </div>
      <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-zinc-500">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </Card>
  );
}

export function ScoreRing({
  score,
  size = 132,
  stroke = 9,
  label = "Score",
}: {
  score: number;
  size?: number;
  stroke?: number;
  label?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, Math.max(0, score)) / 100) * c;
  const id = React.useId();
  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-zinc-100"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${id})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
        />
        <defs>
          <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#14b8a6" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-semibold tracking-tight tabular-nums text-zinc-900 sm:text-4xl">
          {score}
        </span>
        <span className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-zinc-400">
          {label}
        </span>
      </div>
    </div>
  );
}
