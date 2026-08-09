"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Camera,
  Home,
  LayoutDashboard,
  Leaf,
  ListChecks,
  MessageCircle,
  History,
} from "lucide-react";
import { cn } from "./ui";

const NAV = [
  { href: "/", label: "Home", icon: Home },
  { href: "/scan", label: "Scan", icon: Camera },
  { href: "/dashboard", label: "Lab", icon: LayoutDashboard },
  { href: "/routine", label: "Routine", icon: ListChecks },
  { href: "/history", label: "History", icon: History },
  { href: "/chat", label: "Chat", icon: MessageCircle },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[var(--fl-bg)] text-zinc-900">
      {/* ambient */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-24 top-0 h-80 w-80 rounded-full bg-emerald-200/25 blur-3xl" />
        <div className="absolute -right-16 top-48 h-72 w-72 rounded-full bg-teal-100/35 blur-3xl" />
      </div>

      <header className="sticky top-0 z-40 border-b border-zinc-200/60 bg-white/75 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:h-16 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/20">
              <Leaf className="h-4 w-4" />
            </span>
            <span className="leading-tight">
              <span className="block text-[15px] font-semibold tracking-tight">Facelab</span>
              <span className="hidden text-[10px] font-medium uppercase tracking-wider text-zinc-400 sm:block">
                Skin OS
              </span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-medium transition-colors",
                    active
                      ? "bg-zinc-900 text-white"
                      : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
                  )}
                >
                  <item.icon className="h-3.5 w-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <Link
            href="/scan"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-sm font-medium text-white shadow-sm shadow-emerald-600/20 transition hover:bg-emerald-500 md:hidden"
          >
            <Camera className="h-3.5 w-3.5" />
            Scan
          </Link>
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl px-4 pb-28 pt-6 sm:px-6 sm:pb-16 sm:pt-8">
        {children}
      </main>

      {/* mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200/70 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
        <ul className="mx-auto grid max-w-xl grid-cols-6 px-0.5 py-1.5">
          {NAV.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex flex-col items-center gap-0.5 rounded-xl px-1 py-2 text-[10px] font-medium transition",
                    active ? "text-emerald-700" : "text-zinc-400"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-xl transition",
                      active ? "bg-emerald-50" : ""
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                  </span>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
