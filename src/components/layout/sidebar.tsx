"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import {
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
  Settings,
  LogOut,
  Sparkles,
  Shield,
  Calendar,
  NotebookPen,
  X,
  Bot,
  User,
} from "lucide-react";
import { type LucideIcon } from "lucide-react";

type NavItem = {
  name: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
  isNew?: boolean;
};

type NavGroup = {
  title: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    title: "OVERVIEW",
    items: [
      { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { name: "Performance Analytics", href: "/dashboard/analytics", icon: BarChart3 },
      { name: "Trader Index", href: "/dashboard/trader-index", icon: Shield, badge: "Score" },
      { name: "Economic Calendar", href: "/dashboard/economic-calendar", icon: Calendar },
    ],
  },
  {
    title: "INTELLIGENCE & AI",
    items: [
      { name: "Zenith AI", href: "/dashboard/zenith", icon: Sparkles, badge: "OS" },
      { name: "Zenith Agent", href: "/dashboard/zenith-agent", icon: Bot, badge: "2.0", isNew: true },
    ],
  },
  {
    title: "JOURNAL & PRACTICE",
    items: [
      { name: "Trade Log", href: "/dashboard/journal", icon: BookOpen },
      { name: "Journal Review", href: "/dashboard/journal-review", icon: NotebookPen },
      { name: "Backtest Replay", href: "/dashboard/backtest", icon: Activity },
      { name: "Master Plan", href: "/dashboard/plan", icon: Compass },
    ],
  },
  {
    title: "ROUTINE & GOALS",
    items: [
      { name: "Daily Routine", href: "/dashboard/routine", icon: CalendarCheck },
      { name: "Routine Analytics", href: "/dashboard/routine-analytics", icon: Activity },
      { name: "Goals", href: "/dashboard/goals", icon: Target },
      { name: "Goals Analytics", href: "/dashboard/goals-analytics", icon: PieChart },
      { name: "Tasks", href: "/dashboard/tasks", icon: CheckSquare },
    ],
  },
  {
    title: "FINANCES & UTILITIES",
    items: [
      { name: "Finances", href: "/dashboard/finances", icon: DollarSign },
      { name: "Finance Analytics", href: "/dashboard/finances-analytics", icon: TrendingUp },
      { name: "Debt Analytics", href: "/dashboard/debts", icon: CreditCard },
      { name: "Risk Calculator", href: "/dashboard/calculator", icon: Calculator },
      { name: "Settings", href: "/dashboard/settings", icon: Settings },
    ],
  },
];

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  username?: string;
}

export function Sidebar({ mobileOpen = false, onMobileClose, username }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {mobileOpen && (
        <div
          onClick={onMobileClose}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden animate-fade-in"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-50 h-screen w-64 flex flex-col border-r border-border/80 bg-surface/95 backdrop-blur-xl overflow-hidden transition-transform duration-300 ease-out shadow-lg",
          "md:translate-x-0",
          mobileOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full md:translate-x-0"
        )}
      >
        {/* Brand header with Official Logo */}
        <div className="relative h-16 flex items-center justify-between px-4 border-b border-border/70 shrink-0 bg-surface-2/40">
          <Link href="/dashboard" className="flex items-center gap-3 group">
            <div className="relative w-9 h-9 rounded-xl overflow-hidden border border-border/90 bg-surface flex items-center justify-center shrink-0 shadow-xs transition-transform duration-200 group-hover:scale-105 group-hover:border-brand/40">
              <Image
                src="/logo.jpg"
                alt="Velox Studio"
                width={36}
                height={36}
                className="w-full h-full object-cover"
                priority
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-display text-sm font-bold tracking-tight leading-none text-foreground">
                  VELOX
                </span>
                <span className="text-[10px] text-foreground-subtle tracking-[0.16em] uppercase font-bold leading-none">
                  STUDIO
                </span>
              </div>
              <p className="text-[9px] text-foreground-subtle font-mono mt-1 tracking-wider uppercase">
                Institutional OS
              </p>
            </div>
          </Link>

          <button
            onClick={onMobileClose}
            className="md:hidden p-1.5 rounded-lg hover:bg-surface-2 text-foreground-subtle hover:text-foreground transition-colors"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav groups */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4.5 scrollbar-thin">
          {NAV_GROUPS.map((group) => (
            <div key={group.title} className="space-y-1">
              <p className="px-2.5 text-[9px] font-bold uppercase tracking-[0.16em] text-foreground-subtle/70 mb-1.5">
                {group.title}
              </p>
              {group.items.map((item) => (
                <NavLinkRow
                  key={item.href}
                  item={item}
                  active={
                    item.href === "/dashboard"
                      ? pathname === "/dashboard"
                      : pathname.startsWith(item.href)
                  }
                  onClick={onMobileClose}
                />
              ))}
            </div>
          ))}
        </nav>

        {/* Footer section: Institutional User Profile Card */}
        <div className="border-t border-border/70 p-3 bg-surface-2/40 shrink-0 space-y-2">
          {/* User profile row */}
          <div className="flex items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative w-8 h-8 rounded-lg bg-brand/15 border border-brand/30 flex items-center justify-center shrink-0">
                <User className="w-4 h-4 text-brand" />
                <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-profit ring-2 ring-surface" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-foreground leading-tight">
                  {username || "Trader"}
                </p>
                <p className="text-[10px] text-foreground-subtle leading-tight font-medium">
                  Pro Trader Plan
                </p>
              </div>
            </div>

            <div className="flex items-center gap-0.5">
              <Link
                href="/dashboard/settings"
                className="p-1.5 rounded-lg text-foreground-subtle hover:text-foreground hover:bg-surface-3 transition-colors"
                title="Settings"
              >
                <Settings className="w-3.5 h-3.5" />
              </Link>
              <button
                onClick={handleLogout}
                className="p-1.5 rounded-lg text-foreground-subtle hover:text-loss hover:bg-loss/10 transition-colors"
                title="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Institutional Version & Health Badge */}
          <div className="rounded-lg bg-surface border border-border/60 px-2.5 py-1.5 flex items-center justify-between shadow-2xs">
            <span className="text-[10px] font-mono text-foreground-subtle">Velox v2.0</span>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-profit animate-pulse" />
              <span className="text-[10px] font-semibold text-profit">System Active</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

function NavLinkRow({
  item,
  active,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  onClick?: () => void;
}) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        "group relative flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-medium transition-all duration-150",
        active
          ? "bg-brand/12 text-brand font-semibold shadow-2xs"
          : "text-foreground-muted hover:text-foreground hover:bg-surface-2/80",
      )}
    >
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-brand shadow-xs" />
      )}
      <Icon
        className={cn(
          "w-4 h-4 shrink-0 transition-transform duration-150",
          active ? "text-brand scale-105" : "text-foreground-subtle group-hover:text-foreground",
        )}
      />
      <span className="truncate flex-1">{item.name}</span>

      {/* Optional Badge */}
      {item.badge && (
        <span
          className={cn(
            "text-[9px] font-mono font-bold px-1.5 py-0.2 rounded tracking-wider uppercase shrink-0 transition-colors",
            active
              ? "bg-brand/20 text-brand border border-brand/30"
              : "bg-surface-3 text-foreground-subtle group-hover:bg-surface group-hover:text-foreground",
            item.isNew && "bg-brand/20 text-brand border border-brand/30"
          )}
        >
          {item.badge}
        </span>
      )}
    </Link>
  );
}
