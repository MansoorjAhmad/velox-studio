"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Bell,
  Menu,
  ChevronDown,
  Wallet,
  Search,
  Check,
  Globe,
  Clock,
  ExternalLink,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { ThemeToggle } from "@/components/ui/theme-toggle";

import { getTradingAccounts } from "@/lib/accounts/actions";
import type { TradingAccount } from "@/lib/accounts/types";
import { getActiveAccountId, setActiveAccountIdSynced } from "@/lib/accounts/active-account";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/dashboard/journal": "Trade Log",
  "/dashboard/journal-review": "Journal Review",
  "/dashboard/trader-index": "Trader Index",
  "/dashboard/analytics": "Performance Analytics",
  "/dashboard/economic-calendar": "Economic Calendar",
  "/dashboard/backtest": "Backtest Replay",
  "/dashboard/calculator": "Risk Calculator",
  "/dashboard/finances": "Finances",
  "/dashboard/finances-analytics": "Finance Analytics",
  "/dashboard/debts": "Debt Analytics",
  "/dashboard/goals": "Goals",
  "/dashboard/goals-analytics": "Goals Analytics",
  "/dashboard/routine": "Daily Routine",
  "/dashboard/routine-analytics": "Routine Analytics",
  "/dashboard/tasks": "Tasks",
  "/dashboard/plan": "Master Plan",
  "/dashboard/zenith": "Zenith AI",
  "/dashboard/zenith-agent": "Zenith Agent",
  "/dashboard/settings": "Settings",
};

function useTime() {
  const [now, setNow] = useState<Date>(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function getGreeting(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 21) return "Good evening";
  return "Good night";
}

function getCurrentSession(utcHour: number): {
  name: string;
  icon: string;
  color: string;
  badge: string;
} {
  if (utcHour >= 13 && utcHour < 16) {
    return {
      name: "London / NY Overlap",
      icon: "⚡",
      color: "text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/10",
      badge: "High Liquidity",
    };
  } else if (utcHour >= 7 && utcHour < 16) {
    return {
      name: "London Session",
      icon: "🇬🇧",
      color: "text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
      badge: "Active",
    };
  } else if (utcHour >= 13 && utcHour < 22) {
    return {
      name: "New York Session",
      icon: "🇺🇸",
      color: "text-blue-600 dark:text-blue-400 border-blue-500/30 bg-blue-500/10",
      badge: "Active",
    };
  } else {
    return {
      name: "Asian Session",
      icon: "🇯🇵",
      color: "text-purple-600 dark:text-purple-400 border-purple-500/30 bg-purple-500/10",
      badge: "Active",
    };
  }
}

interface TopBarProps {
  username: string;
  onMenuClick?: () => void;
}

export function TopBar({ username, onMenuClick }: TopBarProps) {
  const pathname = usePathname();
  const now = useTime();

  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [selectedAccId, setSelectedAccId] = useState<string>("all");
  const [showDropdown, setShowDropdown] = useState(false);
  const [switching, setSwitching] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Click outside listener to safely close dropdown
  useEffect(() => {
    if (!showDropdown) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowDropdown(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showDropdown]);

  useEffect(() => {
    const load = async () => {
      const res = await getTradingAccounts();
      const list = res.data ?? [];
      setAccounts(list);

      const saved = getActiveAccountId();
      if (saved === "all") {
        setSelectedAccId("all");
      } else if (list.some((a) => a.id === saved)) {
        setSelectedAccId(saved);
      } else if (list.length > 0) {
        const defaultAcc = list.find((a) => a.is_default) ?? list[0];
        setSelectedAccId(defaultAcc.id);
        void setActiveAccountIdSynced(defaultAcc.id);
      } else {
        setSelectedAccId("all");
      }
    };
    load();

    const handleAccountsChanged = () => load();
    const handleActiveAccountChanged = () => {
      setSelectedAccId(getActiveAccountId());
    };
    window.addEventListener("trading_accounts_changed", handleAccountsChanged);
    window.addEventListener("active_account_changed", handleActiveAccountChanged);
    return () => {
      window.removeEventListener("trading_accounts_changed", handleAccountsChanged);
      window.removeEventListener("active_account_changed", handleActiveAccountChanged);
    };
  }, []);

  const handleSelectAccount = async (id: string) => {
    if (switching) return;
    setSwitching(true);
    setSelectedAccId(id);
    await setActiveAccountIdSynced(id);
    setShowDropdown(false);
    setSwitching(false);
  };

  const activeAcc = accounts.find((a) => a.id === selectedAccId);

  const totalAggregatedBalance = useMemo(() => {
    return accounts.reduce((acc, a) => acc + (a.initial_balance ?? 0), 0);
  }, [accounts]);

  const pageTitle = PAGE_TITLES[pathname] ?? "Dashboard";
  const greeting = getGreeting(now.getHours());

  // Clocks: Local and UTC
  const localTimeStr = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  const utcTimeStr = `${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")} UTC`;

  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  const sessionInfo = getCurrentSession(now.getUTCHours());

  return (
    <header className="sticky top-0 z-30 h-16 flex items-center justify-between px-4 sm:px-6 border-b border-border/80 bg-surface/90 backdrop-blur-xl shrink-0 transition-colors">
      {/* Left: Mobile Menu + Breadcrumb & Title */}
      <div className="flex items-center gap-3.5">
        <button
          onClick={onMenuClick}
          className="md:hidden p-2 rounded-xl hover:bg-surface-2 text-foreground-subtle hover:text-foreground transition-colors"
          aria-label="Open sidebar menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono uppercase tracking-widest text-foreground-subtle/80 hidden sm:inline-block">
              Velox OS
            </span>
            <span className="text-foreground-subtle/40 hidden sm:inline-block">/</span>
            <h1 className="text-sm sm:text-base font-bold text-foreground tracking-tight leading-none">
              {pageTitle}
            </h1>
          </div>
          <p className="text-[11px] text-foreground-subtle mt-1 leading-none">
            {greeting}{username ? `, ${username}` : ""} · <span className="font-mono text-[10px]">{dateStr}</span>
          </p>
        </div>
      </div>

      {/* Right: Account Switcher, Session Badge, Clocks & Quick Actions */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Account Switcher Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowDropdown((v) => !v)}
            disabled={switching}
            className={cn(
              "flex items-center gap-2 rounded-xl border border-border/80 bg-surface-2/80 hover:bg-surface-2 px-3 py-1.5 h-9 text-xs font-semibold hover:border-brand/40 transition-all shadow-2xs group",
              showDropdown && "border-brand ring-2 ring-brand/15 bg-surface-2"
            )}
            title="Switch Active Trading Account"
          >
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0 ring-2 ring-surface shadow-xs"
              style={{ backgroundColor: activeAcc ? activeAcc.color : "var(--brand)" }}
            />
            <div className="flex flex-col items-start text-left leading-none">
              <span className="truncate max-w-[85px] sm:max-w-[130px] md:max-w-[160px] text-foreground font-bold text-[12px]">
                {selectedAccId === "all" ? "All Accounts" : activeAcc ? activeAcc.name : "Select Account"}
              </span>
              <span className="text-[9px] font-mono text-foreground-subtle mt-0.5">
                {selectedAccId === "all"
                  ? formatCurrency(totalAggregatedBalance, { compact: true })
                  : activeAcc
                    ? formatCurrency(activeAcc.initial_balance, { compact: true })
                    : "No balance"}
              </span>
            </div>
            <ChevronDown
              className={cn(
                "w-3.5 h-3.5 text-foreground-subtle transition-transform duration-200 ml-0.5",
                showDropdown && "rotate-180 text-foreground"
              )}
            />
          </button>

          {/* Account Dropdown Menu */}
          {showDropdown && (
            <div className="absolute right-0 mt-2 w-72 rounded-2xl border border-border/90 bg-surface/98 backdrop-blur-2xl shadow-2xl p-2 z-50 animate-fade-in space-y-1.5">
              <div className="px-3 py-1.5 flex items-center justify-between border-b border-border/50">
                <span className="text-[10px] font-bold uppercase tracking-wider text-foreground-subtle">
                  Trading Accounts
                </span>
                <span className="text-[10px] font-mono text-foreground-subtle">
                  {accounts.length} Total
                </span>
              </div>

              {/* All Accounts Option */}
              <button
                onClick={() => handleSelectAccount("all")}
                disabled={switching}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all",
                  selectedAccId === "all"
                    ? "bg-brand/15 text-brand font-bold border border-brand/25"
                    : "hover:bg-surface-2 text-foreground-muted hover:text-foreground"
                )}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-brand/15 border border-brand/25 flex items-center justify-center shrink-0">
                    <Wallet className="w-3.5 h-3.5 text-brand" />
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-semibold leading-tight text-foreground">All Accounts</p>
                    <p className="text-[10px] text-foreground-subtle leading-tight mt-0.5">Aggregated Overview</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-right">
                  <span className="text-xs font-mono font-bold text-foreground">
                    {formatCurrency(totalAggregatedBalance, { compact: true })}
                  </span>
                  {selectedAccId === "all" && <Check className="w-3.5 h-3.5 text-brand shrink-0" />}
                </div>
              </button>

              {/* Individual Accounts List */}
              <div className="max-h-56 overflow-y-auto space-y-1 pr-0.5 scrollbar-thin">
                {accounts.map((acc) => (
                  <button
                    key={acc.id}
                    onClick={() => handleSelectAccount(acc.id)}
                    disabled={switching}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all",
                      selectedAccId === acc.id
                        ? "bg-brand/12 text-brand font-bold border border-brand/25"
                        : "hover:bg-surface-2 text-foreground-muted hover:text-foreground"
                    )}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0 ring-2 ring-surface shadow-xs"
                        style={{ backgroundColor: acc.color }}
                      />
                      <div className="text-left truncate">
                        <p className="text-xs font-semibold leading-tight text-foreground truncate">{acc.name}</p>
                        <p className="text-[10px] text-foreground-subtle leading-tight mt-0.5 uppercase font-mono">
                          {acc.currency} · {acc.account_type || "Standard"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-right shrink-0">
                      <span className="text-xs font-mono font-bold text-foreground">
                        {formatCurrency(acc.initial_balance, { compact: true })}
                      </span>
                      {selectedAccId === acc.id && <Check className="w-3.5 h-3.5 text-brand shrink-0" />}
                    </div>
                  </button>
                ))}
              </div>

              {/* Manage Accounts Footer */}
              <div className="pt-1.5 border-t border-border/50">
                <Link
                  href="/dashboard/settings"
                  onClick={() => setShowDropdown(false)}
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold text-brand hover:bg-brand/10 transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  Manage Accounts in Settings
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Active Market Session Badge */}
        <div
          className={cn(
            "hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all shadow-2xs",
            sessionInfo.color
          )}
          title={`Active Market Session: ${sessionInfo.name}`}
        >
          <span className="text-sm">{sessionInfo.icon}</span>
          <span className="font-medium text-xs text-foreground">{sessionInfo.name}</span>
          <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
        </div>

        {/* Divider */}
        <div className="hidden sm:block w-px h-6 bg-border/80" />

        {/* Clocks: Local & UTC */}
        <div className="hidden md:flex flex-col items-end leading-none">
          <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-foreground tabular">
            <Clock className="w-3 h-3 text-brand" />
            <span>{localTimeStr}</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-foreground-subtle font-mono mt-1">
            <Globe className="w-2.5 h-2.5" />
            <span>{utcTimeStr}</span>
          </div>
        </div>

        {/* Search Command Palette Trigger */}
        <button
          onClick={() => window.dispatchEvent(new Event("velox-open-command-palette"))}
          className="hidden sm:flex items-center gap-2 rounded-xl border border-border/80 bg-surface-2/60 px-3 h-9 text-foreground-subtle hover:text-foreground hover:border-brand/40 hover:bg-surface-2 transition-all cursor-pointer shadow-2xs"
          title="Search commands, tools, and pages (Ctrl+K)"
        >
          <Search className="w-3.5 h-3.5" />
          <span className="text-xs">Search…</span>
          <kbd className="inline-flex items-center rounded-md border border-border/80 bg-surface px-1.5 py-0.5 font-mono text-[9px] text-foreground-subtle font-bold shadow-2xs">
            Ctrl K
          </kbd>
        </button>

        {/* Theme Toggle */}
        <ThemeToggle />

        {/* Notification Bell → Trader Index discipline alerts */}
        <Link
          href="/dashboard/trader-index"
          className="relative w-9 h-9 rounded-xl border border-border/70 bg-surface-2/60 flex items-center justify-center text-foreground-subtle hover:text-foreground hover:border-brand/40 hover:bg-surface-2 transition-all shadow-2xs group"
          title="Trader Index discipline alerts"
        >
          <Bell className="w-4 h-4 group-hover:scale-105 transition-transform" />
          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-brand ring-2 ring-surface" />
        </Link>
      </div>
    </header>
  );
}
