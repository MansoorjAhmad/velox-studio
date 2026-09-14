"use client";

/**
 * Velox Studio — Command Palette (⌘K / Ctrl+K).
 *
 * Powered by cmdk. Feeds from the sidebar NAV so it stays in sync.
 * Includes quick actions: log a trade, open calculator, ask Zenith.
 */

import { useState, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "cmdk";
import {
  Search,
  LayoutDashboard,
  BookOpen,
  BarChart3,
  Calculator,
  DollarSign,
  TrendingUp,
  CreditCard,
  Target,
  PieChart,
  CalendarCheck,
  Activity,
  CheckSquare,
  Compass,
  Sparkles,
  Settings,
  Shield,
  Bot,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
}

const NAV: NavItem[] = [
  { name: "Dashboard",              href: "/dashboard",                   icon: LayoutDashboard },
  { name: "Trade Log",              href: "/dashboard/journal",           icon: BookOpen },
  { name: "Trader Index",           href: "/dashboard/trader-index",      icon: Shield },
  { name: "Performance Analytics",   href: "/dashboard/analytics",         icon: BarChart3 },
  { name: "Backtest Replay",        href: "/dashboard/backtest",          icon: Activity },
  { name: "Master Plan",            href: "/dashboard/plan",              icon: Compass },
  { name: "Risk Calculator",        href: "/dashboard/calculator",       icon: Calculator },
  { name: "Finances",               href: "/dashboard/finances",          icon: DollarSign },
  { name: "Finance Analytics",      href: "/dashboard/finances-analytics",icon: TrendingUp },
  { name: "Debt Analytics",         href: "/dashboard/debts",            icon: CreditCard },
  { name: "Goals",                 href: "/dashboard/goals",            icon: Target },
  { name: "Goals Analytics",         href: "/dashboard/goals-analytics",  icon: PieChart },
  { name: "Daily Routine",          href: "/dashboard/routine",          icon: CalendarCheck },
  { name: "Routine Analytics",      href: "/dashboard/routine-analytics",icon: Activity },
  { name: "Tasks",                  href: "/dashboard/tasks",            icon: CheckSquare },
];

const BOTTOM_NAV: NavItem[] = [
  { name: "Velox Zenith", href: "/dashboard/zenith",       icon: Sparkles },
  { name: "Zenith Agent", href: "/dashboard/zenith-agent", icon: Bot },
  { name: "Settings",     href: "/dashboard/settings",     icon: Settings },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  // Toggle on ⌘K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    // Custom event so the topbar search button can open the palette reliably.
    const openHandler = () => setOpen(true);
    document.addEventListener("keydown", handler);
    window.addEventListener("velox-open-command-palette", openHandler as EventListener);
    return () => {
      document.removeEventListener("keydown", handler);
      window.removeEventListener("velox-open-command-palette", openHandler as EventListener);
    };
  }, []);

  const navigate = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router],
  );


  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={() => setOpen(false)}
      />

      {/* Dialog */}
      <div className="relative flex items-start justify-center pt-[15vh] px-4">
        <Command
          className="relative w-full max-w-lg rounded-xl border border-border bg-surface shadow-2xl shadow-black/60 overflow-hidden animate-scale-in"
          label="Velox Studio Command Palette"
        >
          <div className="flex items-center border-b border-border px-3">
            <Search className="w-4 h-4 text-foreground-subtle shrink-0" />
            <CommandInput
              placeholder="Search pages, actions, or type a question…"
              className="flex-1 border-0 bg-transparent px-2 py-3 text-sm text-foreground placeholder:text-foreground-subtle outline-none font-medium"
            />
          </div>

          <CommandList className="max-h-[340px] overflow-y-auto">
            <CommandEmpty className="px-4 py-8 text-center text-sm text-foreground-subtle">
              No results found.
            </CommandEmpty>

            <CommandGroup heading="Navigation" className="px-2 py-1.5">
              {NAV.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <CommandItem
                    key={item.href}
                    onSelect={() => navigate(item.href)}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm cursor-pointer transition-colors",
                      "data-[selected=true]:bg-brand/10 data-[selected=true]:text-brand",
                      isActive && "text-brand font-medium",
                    )}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.name}</span>
                    {isActive && (
                      <span className="ml-auto text-[10px] text-foreground-subtle">Current</span>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>

            <CommandSeparator />

            <CommandGroup heading="System" className="px-2 py-1.5">
              {BOTTOM_NAV.map((item) => {
                const Icon = item.icon;
                const isActive = pathname.startsWith(item.href);
                return (
                  <CommandItem
                    key={item.href}
                    onSelect={() => navigate(item.href)}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm cursor-pointer transition-colors",
                      "data-[selected=true]:bg-brand/10 data-[selected=true]:text-brand",
                      isActive && "text-brand font-medium",
                    )}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.name}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>

            <CommandSeparator />

            <CommandGroup heading="Quick Actions" className="px-2 py-1.5">
              <CommandItem
                onSelect={() => navigate("/dashboard/journal")}
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm cursor-pointer data-[selected=true]:bg-brand/10 data-[selected=true]:text-brand"
              >
                <BookOpen className="w-4 h-4 shrink-0" />
                <span>Log a new trade</span>
              </CommandItem>
              <CommandItem
                onSelect={() => navigate("/dashboard/calculator")}
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm cursor-pointer data-[selected=true]:bg-brand/10 data-[selected=true]:text-brand"
              >
                <Calculator className="w-4 h-4 shrink-0" />
                <span>Open risk calculator</span>
              </CommandItem>
              <CommandItem
                onSelect={() => navigate("/dashboard/zenith")}
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm cursor-pointer data-[selected=true]:bg-brand/10 data-[selected=true]:text-brand"
              >
                <Sparkles className="w-4 h-4 shrink-0" />
                <span>Ask Velox Zenith AI</span>
              </CommandItem>

            </CommandGroup>
          </CommandList>

          {/* Footer hint */}
          <div className="border-t border-border px-3 py-2 flex items-center justify-between text-[10px] text-foreground-subtle">
            <span className="flex items-center gap-1">
              <kbd className="inline-flex items-center rounded border border-border bg-surface-2 px-1 py-0.5 font-mono text-[9px]">↵</kbd>
              Open
            </span>
            <span className="flex items-center gap-1">
              <kbd className="inline-flex items-center rounded border border-border bg-surface-2 px-1 py-0.5 font-mono text-[9px]">esc</kbd>
              Close
            </span>
          </div>
        </Command>
      </div>
    </div>
  );
}
