"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { getProfile, upsertProfile, resetAllUserData } from "@/lib/settings/actions";
import {
  getTradingAccounts,
  createTradingAccount,
  deleteTradingAccount,
  updateTradingAccount,
} from "@/lib/accounts/actions";
import type { TradingAccount } from "@/lib/accounts/types";
import { getTradingConfig, saveTradingConfigSynced, type TradingConfig } from "@/lib/trading-config";
import {
  getCustomStrategies,
  addCustomStrategySynced,
  deleteCustomStrategySynced,
  subscribeStrategiesListener,
  DEFAULT_SETUPS,
} from "@/lib/journal/strategies";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import {
  Settings,
  User,
  Palette,
  LogOut,
  Save,
  Loader2,
  Shield,
  Wallet,
  Plus,
  Trash2,
  Check,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export function SettingsPage() {
  const [displayName, setDisplayName] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [accountType, setAccountType] = useState("personal");
  const [loading, setLoading] = useState(true);
  const [accountSwitching, setAccountSwitching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [tradingConfig, setTradingConfig] = useState<TradingConfig>(() => getTradingConfig());
  const [configSaved, setConfigSaved] = useState(false);

  // Trading Accounts state
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [accName, setAccName] = useState("");
  const [accBroker, setAccBroker] = useState("");
  const [accNumber, setAccNumber] = useState("");
  const [accBalance, setAccBalance] = useState("10000");
  const [accType, setAccType] = useState<"standard" | "cent" | "prop" | "funded">("prop");
  const [accColor, setAccColor] = useState("#1c1a15");
  const [showResetModal, setShowResetModal] = useState(false);
  const [creatingAcc, setCreatingAcc] = useState(false);

  const [strategies, setStrategies] = useState<string[]>(getCustomStrategies());
  const [newStrategyInput, setNewStrategyInput] = useState("");

  useEffect(() => {
    return subscribeStrategiesListener(() => {
      setStrategies(getCustomStrategies());
    });
  }, []);

  const handleAddStrategy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStrategyInput.trim()) return;
    const updated = await addCustomStrategySynced(newStrategyInput);
    setStrategies(updated);
    setNewStrategyInput("");
    toast.success("Strategy setup added", {
      description: `${newStrategyInput.trim()} is now active across Trade Log & Filters.`,
    });
  };

  const handleDeleteStrategy = async (name: string) => {
    const updated = await deleteCustomStrategySynced(name);
    setStrategies(updated);
    toast.success("Custom strategy removed");
  };

  const supabase = createClient();
  const router = useRouter();

  const loadAccounts = async () => {
    const res = await getTradingAccounts();
    setAccounts(res.data ?? []);
  };

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { data: profile } = await getProfile();

      if (profile) {
        setDisplayName(profile.display_name ?? "");
        setCurrency(profile.base_currency ?? "USD");
        setAccountType(profile.account_type ?? "personal");
      } else if (user?.email) {
        setDisplayName(user.email.split("@")[0]);
      }

      await loadAccounts();

      setTradingConfig(getTradingConfig());

      setLoading(false);
    };
    load();
    const handleAccountChange = async () => {
      setAccountSwitching(true);
      await load();
      setAccountSwitching(false);
    };
    window.addEventListener("active_account_changed", handleAccountChange);
    return () => window.removeEventListener("active_account_changed", handleAccountChange);
  }, [supabase]);

  const handleSaveProfile = async () => {
    setSaving(true);
    setSaved(false);

    const res = await upsertProfile({
      display_name: displayName || null,
      account_type: accountType,
      base_currency: currency,
    });

    setSaving(false);
    if (!res.error) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  const handleSaveTradingConfig = async () => {
    await saveTradingConfigSynced(tradingConfig);
    setConfigSaved(true);
    setTimeout(() => setConfigSaved(false), 2000);
  };

  const [accError, setAccError] = useState<string | null>(null);

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accName.trim()) return;

    setCreatingAcc(true);
    setAccError(null);

    const res = await createTradingAccount({
      name: accName.trim(),
      broker: accBroker.trim() || null,
      account_number: accNumber.trim() || null,
      currency,
      initial_balance: parseFloat(accBalance) || 10000,
      account_type: accType,
      color: accColor,
      is_default: accounts.length === 0,
    });

    setCreatingAcc(false);

    if (res.error) { setAccError(res.error); return; }

    setShowAddAccountModal(false);
    setAccName("");
    setAccBroker("");
    setAccNumber("");
    await loadAccounts();
    window.dispatchEvent(new Event("trading_accounts_changed"));
  };

  const handleDeleteAccount = async (id: string) => {
    await deleteTradingAccount(id);
    await loadAccounts();
    window.dispatchEvent(new Event("trading_accounts_changed"));
  };

  const handleSetDefault = async (id: string) => {
    for (const acc of accounts) {
      await updateTradingAccount(acc.id, { is_default: acc.id === id });
    }
    await loadAccounts();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl relative">
      {accountSwitching && <div className="absolute inset-0 z-10 bg-background/60 backdrop-blur-[1px] flex items-center justify-center rounded-xl"><Loader2 className="w-5 h-5 animate-spin text-brand" /></div>}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-md bg-brand/10 flex items-center justify-center">
          <Settings className="w-5 h-5 text-brand" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-sm text-foreground-muted">
            Manage your profile, trading accounts, and preferences.
          </p>
        </div>
      </div>

      {/* Trading Accounts Section */}
      <Card className="border-brand/30">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Wallet className="w-4 h-4 text-brand" />
              Trading Accounts Management
            </CardTitle>
            <CardDescription>
              Manage prop firm accounts (FTMO, Apex), personal accounts, or cent accounts.
            </CardDescription>
          </div>
          <Button size="sm" onClick={() => setShowAddAccountModal(true)}>
            <Plus className="w-4 h-4" />
            Add Account
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {accounts.length === 0 ? (
            <div className="py-6 text-center text-xs text-foreground-muted border border-dashed rounded-lg">
              No trading accounts created yet. Click &quot;Add Account&quot; to create your first account.
            </div>
          ) : (
            accounts.map((acc) => (
              <div
                key={acc.id}
                className="flex items-center justify-between p-3 rounded-lg border border-border bg-surface-2/40 hover:border-brand/40 transition-all"
              >
                <div className="flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: acc.color }} />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold">{acc.name}</p>
                      {acc.is_default && (
                        <Badge variant="brand" className="text-[9px]">
                          DEFAULT
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-[9px] uppercase">
                        {acc.account_type}
                      </Badge>
                    </div>
                    <p className="text-xs text-foreground-subtle mt-0.5">
                      {acc.broker ?? "MetaTrader"} {acc.account_number ? `· #${acc.account_number}` : ""} · Balance: ${acc.initial_balance.toLocaleString()} {acc.currency}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {!acc.is_default && (
                    <Button size="sm" variant="ghost" onClick={() => handleSetDefault(acc.id)}>
                      Make Default
                    </Button>
                  )}
                  <button
                    onClick={() => handleDeleteAccount(acc.id)}
                    className="p-1.5 rounded hover:bg-loss/10 text-foreground-subtle hover:text-loss"
                    title="Delete Account"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Trading configuration is intentionally kept in one shared client store.
          Dashboard and calculator listen for its update event. */}
      <Card className="border-brand/25 bg-gradient-to-br from-brand/5 via-surface to-surface-2">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="w-4 h-4 text-brand" />
            Trading Configuration
          </CardTitle>
          <CardDescription>
            The command-center defaults used by Dashboard and Risk Calculator.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Primary Default Strategy Model</Label>
              <select
                value={tradingConfig.topgPhase}
                onChange={(e) => setTradingConfig((c) => ({ ...c, topgPhase: e.target.value }))}
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand"
              >
                {strategies.map((phase) => (
                  <option key={phase}>{phase}</option>
                ))}
              </select>
            </div>

            {/* Strategy Management List & Form */}
            <div className="space-y-2 sm:col-span-2 rounded-lg border border-border bg-surface-2/40 p-3">
              <Label className="text-xs font-semibold">Active Strategies & Setups ({strategies.length})</Label>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {strategies.map((s) => {
                  const isDefault = DEFAULT_SETUPS.includes(s);
                  return (
                    <div
                      key={s}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border bg-surface text-xs font-medium text-foreground shadow-2xs"
                    >
                      <span>{s}</span>
                      {!isDefault && (
                        <button
                          type="button"
                          onClick={() => handleDeleteStrategy(s)}
                          className="hover:text-loss text-foreground-subtle transition-colors"
                          title="Remove custom strategy"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Add Strategy Form */}
              <form onSubmit={handleAddStrategy} className="flex gap-2 pt-2">
                <Input
                  placeholder="Add new strategy setup (e.g. FVG Invalidation)..."
                  value={newStrategyInput}
                  onChange={(e) => setNewStrategyInput(e.target.value)}
                  className="h-9 text-xs bg-surface"
                />
                <Button type="submit" size="sm" className="h-9 text-xs shrink-0 font-semibold">
                  <Plus className="w-3.5 h-3.5" />
                  Add Strategy
                </Button>
              </form>
            </div>
            <div className="space-y-1.5">
              <Label>Number Typography Standard</Label>
              <div className="w-full rounded-md border border-border/80 bg-surface-2/60 px-3 py-2 text-xs font-semibold text-foreground flex items-center justify-between">
                <span className="font-display font-medium text-sm text-brand">Fraunces Luxury Serif</span>
                <Badge variant="brand" className="text-[9px] uppercase tracking-wider">Studio Standard</Badge>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Monthly Profit Target ($)</Label>
              <Input
                type="number"
                min="0"
                step="50"
                value={tradingConfig.monthlyProfitTarget}
                onChange={(e) =>
                  setTradingConfig((c) => ({ ...c, monthlyProfitTarget: Number(e.target.value) || 0 }))
                }
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Default Risk per Trade (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.05"
                value={tradingConfig.phaseRiskPct}
                onChange={(e) =>
                  setTradingConfig((c) => ({ ...c, phaseRiskPct: Number(e.target.value) || 0 }))
                }
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Daily Risk Limit (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={tradingConfig.dailyRiskLimitPct}
                onChange={(e) =>
                  setTradingConfig((c) => ({ ...c, dailyRiskLimitPct: Number(e.target.value) || 0 }))
                }
                className="font-mono"
              />
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface/60 p-3">
            <p className="text-[11px] text-foreground-muted">
              Applies instantly across dashboard risk telemetry, calculator defaults, and number typography.
            </p>
            <Button size="sm" onClick={handleSaveTradingConfig} className="shrink-0">
              {configSaved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              {configSaved ? "Synced" : "Save Config"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Profile section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="w-4 h-4" />
            Profile
          </CardTitle>
          <CardDescription>
            Your display name and account information.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Display Name</Label>
            <Input
              placeholder="Your name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Account Type</Label>
            <select
              value={accountType}
              onChange={(e) => setAccountType(e.target.value)}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand/50"
            >
              <option value="personal">Personal</option>
              <option value="prop">Prop Firm</option>
              <option value="funded">Funded Account</option>
              <option value="live">Live Account</option>
            </select>
          </div>
          <Button onClick={handleSaveProfile} disabled={saving || loading} size="sm">
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : saved ? (
              "Saved ✓"
            ) : (
              <Save className="w-4 h-4" />
            )}
            {!saving && !saved && "Save Changes"}
          </Button>
        </CardContent>
      </Card>

      {/* Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Palette className="w-4 h-4" />
            Preferences
          </CardTitle>
          <CardDescription>Customize your experience.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Base Currency</Label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand/50"
            >
              {["USD", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "NZD", "PKR"].map(
                (c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ),
              )}
            </select>
          </div>
        </CardContent>
      </Card>`r`n`r`n      {/* Security */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Security
          </CardTitle>
          <CardDescription>
            Your data is protected by Supabase Row Level Security.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          <Button variant="danger" size="sm" onClick={handleLogout}>
            <LogOut className="w-4 h-4" />
            Sign Out
          </Button>
        </CardContent>
      </Card>

      {/* Danger Zone — Reset All Data */}
      <Card className="border-loss/30 bg-surface">
        <CardHeader>
          <CardTitle className="text-loss flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-loss" /> Danger Zone — Reset App Data
          </CardTitle>
          <CardDescription>
            Reset local account preferences, active filters, and cached browser state. This gives you a clean slate.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="danger" size="sm" onClick={() => setShowResetModal(true)}>
            <Trash2 className="w-4 h-4" />
            Reset All Local Data
          </Button>
        </CardContent>
      </Card>

      {/* Add Account Modal */}
      <Modal open={showAddAccountModal} onClose={() => setShowAddAccountModal(false)} title="Add Trading Account">
        <form onSubmit={handleCreateAccount} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Account Name *</Label>
            <Input
              placeholder="e.g. FTMO $100K Challenge, Personal Cent"
              value={accName}
              onChange={(e) => setAccName(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Broker / Platform</Label>
              <Input
                placeholder="e.g. MetaTrader 5, IC Markets"
                value={accBroker}
                onChange={(e) => setAccBroker(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Account Number (optional)</Label>
              <Input
                placeholder="e.g. 50123984"
                value={accNumber}
                onChange={(e) => setAccNumber(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Initial Balance ($)</Label>
              <Input
                type="number"
                step="100"
                placeholder="10000"
                value={accBalance}
                onChange={(e) => setAccBalance(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Account Type</Label>
              <select
                value={accType}
                onChange={(e) => setAccType(e.target.value as TradingAccount["account_type"])}
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-xs outline-none"
              >
                <option value="prop">Prop Firm Challenge</option>
                <option value="funded">Funded Account</option>
                <option value="standard">Standard Live</option>
                <option value="cent">Cent Account (USC)</option>
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Account Color Code</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={accColor}
                onChange={(e) => setAccColor(e.target.value)}
                className="w-10 h-8 rounded border border-border cursor-pointer bg-surface"
              />
              <Input value={accColor} onChange={(e) => setAccColor(e.target.value)} className="font-mono text-xs" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowAddAccountModal(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={creatingAcc || !accName.trim()}>
              {creatingAcc ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Account"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Reset Data Confirmation Modal */}
      <Modal open={showResetModal} onClose={() => setShowResetModal(false)} title="Reset All Local Data?">
        <div className="space-y-4">
          <p className="text-sm text-foreground-muted leading-relaxed">
            Are you sure you want to reset your local accounts, active filter selections, and browser storage? This will revert the workspace to default state.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setShowResetModal(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={async () => {
                try {
                  const res = await resetAllUserData();
                  if (res?.error) {
                    toast.error(`Reset error: ${res.error}`);
                    return;
                  }
                  localStorage.clear();
                  toast.success("All database records and local cache reset successfully.");
                  setShowResetModal(false);
                  window.dispatchEvent(new Event("trading_accounts_changed"));
                  window.dispatchEvent(new Event("active_account_changed"));
                  setTimeout(() => window.location.reload(), 600);
                } catch (err) {
                  localStorage.clear();
                  toast.success("Local browser cache reset successfully.");
                  setTimeout(() => window.location.reload(), 600);
                }
              }}
            >
              Yes, Reset Everything
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
