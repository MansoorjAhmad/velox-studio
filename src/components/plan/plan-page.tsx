"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Compass,
  TrendingUp,
  ShieldAlert,
  Heart,
  Target,
  Brain,
  CheckCircle2,
  Plus,
  Trash2,
  Sparkles,
  Zap,
  BookOpen,
  Award,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

interface PlanItem {
  id: string;
  category: "trading" | "life" | "financial" | "mindset";
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  tags: string[];
}

const DEFAULT_PLAN_ITEMS: PlanItem[] = [
  {
    id: "1",
    category: "trading",
    title: "TJL 2 (A+) Setup Execution Rules",
    description:
      "1. Must occur after liquidity sweep of key Session High/Low.\n2. Entry in 61.8% - 78.6% Fib Golden Zone + FVG confirmation.\n3. Minimum Risk:Reward ratio must be 1:2.5.\n4. Max Risk per trade: 1.0% of account balance.",
    priority: "high",
    tags: ["A+ Setup", "TJL 2", "Risk Management"],
  },
  {
    id: "2",
    category: "trading",
    title: "Strict Capital Preservation Rules",
    description:
      "• Maximum 2 consecutive losses per day = Shut down terminal for the session.\n• Maximum 3.0% daily drawdown limit.\n• Never move stop loss into loss or revenge trade after news.",
    priority: "high",
    tags: ["Risk Limits", "Discipline"],
  },
  {
    id: "3",
    category: "life",
    title: "Deen & Daily Spiritual Discipline",
    description:
      "• Pray all 5 daily prayers on time with congregation when possible.\n• Morning & Evening Adhkar before session opening.\n• 15-20 minutes daily Quran reading & reflection.",
    priority: "high",
    tags: ["Deen", "Mindset"],
  },
  {
    id: "4",
    category: "financial",
    title: "Prop Firm & Account Scaling Roadmap",
    description:
      "• Target: Pass $100,000 Prop Firm Challenge with 1% risk per trade.\n• Maintain payout discipline: Withdraw 50% profits, keep 50% for buffer.",
    priority: "medium",
    tags: ["Funding", "Scaling"],
  },
  {
    id: "5",
    category: "mindset",
    title: "Trader Core Affirmations",
    description:
      "\"I am a risk manager first, a trader second. I do not predict the market; I execute my plan with zero emotion.\"",
    priority: "high",
    tags: ["Affirmation", "Psychology"],
  },
];

const PLAN_STORAGE_KEY = "velox_master_plan_v1";

export async function syncMasterPlanFromServer(): Promise<PlanItem[] | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase.from("user_master_plan").select("plan_data").eq("user_id", user.id).maybeSingle();
  if (error || !Array.isArray(data?.plan_data)) return null;
  const plan = data.plan_data as PlanItem[];
  localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(plan));
  return plan;
}

export async function saveMasterPlanSynced(planData: PlanItem[]): Promise<void> {
  localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(planData));
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) await supabase.from("user_master_plan").upsert({ user_id: user.id, plan_data: planData });
}

export function PlanPage() {
  const [items, setItems] = useState<PlanItem[]>([]);
  const [tab, setTab] = useState<"trading" | "life" | "financial" | "mindset">("trading");
  const [showAdd, setShowAdd] = useState(false);

  // New item form
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"high" | "medium" | "low">("high");
  const [tagInput, setTagInput] = useState("");

  useEffect(() => {
    const loadPlan = async () => {
      // 1. Try Supabase first (source of truth)
      const synced = await syncMasterPlanFromServer();
      if (synced) {
        setItems(synced);
        return;
      }
      // 2. Fall back to localStorage cache
      const saved = localStorage.getItem(PLAN_STORAGE_KEY);
      if (saved) {
        try {
          setItems(JSON.parse(saved));
          return;
        } catch {
          // corrupted cache — fall through to defaults
        }
      }
      // 3. Fresh device, no data anywhere — use defaults (don't save them yet)
      setItems(DEFAULT_PLAN_ITEMS);
    };
    loadPlan();
  }, []);

  const saveItems = (updated: PlanItem[]) => {
    setItems(updated);
    saveMasterPlanSynced(updated);
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const newItem: PlanItem = {
      id: Date.now().toString(),
      category: tab,
      title: title.trim(),
      description: description.trim(),
      priority,
      tags: tagInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    };

    saveItems([...items, newItem]);
    setTitle("");
    setDescription("");
    setTagInput("");
    setShowAdd(false);
  };

  const handleDeleteItem = (id: string) => {
    saveItems(items.filter((i) => i.id !== id));
  };

  const filteredItems = items.filter((i) => i.category === tab);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-brand/10 flex items-center justify-center">
            <Compass className="w-5 h-5 text-brand" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Master Plan</h1>
            <p className="text-sm text-foreground-muted">
              Your life & trading blueprint. Execute without hesitation.
            </p>
          </div>
        </div>
        <Button onClick={() => setShowAdd((v) => !v)}>
          <Plus className="w-4 h-4" />
          Add Rule / Plan
        </Button>
      </div>

      {/* Add Form Collapse */}
      {showAdd && (
        <Card className="border-brand/30 bg-brand/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-brand" />
              Add New {tab.toUpperCase()} Directive
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddItem} className="space-y-3">
              <Input
                placeholder="Title (e.g. Daily Max Loss Rule)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
              <Textarea
                placeholder="Detailed rules, conditions, or blueprint steps..."
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                  className="rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none"
                >
                  <option value="high">🔴 High Priority (Non-Negotiable)</option>
                  <option value="medium">🟡 Medium Priority</option>
                  <option value="low">🔵 Standard</option>
                </select>
                <Input
                  placeholder="Tags (comma separated e.g. TJL 2, Risk)"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowAdd(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm">
                  Save Directive
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList className="grid grid-cols-4 w-full md:w-auto">
          <TabsTrigger value="trading" className="gap-2">
            <TrendingUp className="w-4 h-4 text-brand" />
            Trading Rules
          </TabsTrigger>
          <TabsTrigger value="life" className="gap-2">
            <Heart className="w-4 h-4 text-rose-400" />
            Life Roadmap
          </TabsTrigger>
          <TabsTrigger value="financial" className="gap-2">
            <Target className="w-4 h-4 text-emerald-400" />
            Financial Targets
          </TabsTrigger>
          <TabsTrigger value="mindset" className="gap-2">
            <Brain className="w-4 h-4 text-warning" />
            Mindset & Affirmations
          </TabsTrigger>
        </TabsList>

        {(["trading", "life", "financial", "mindset"] as const).map((t) => (
          <TabsContent key={t} value={t} className="mt-4 space-y-4">
            {filteredItems.length === 0 ? (
              <Card className="py-12 text-center border-dashed">
                <CardContent className="space-y-2">
                  <BookOpen className="w-8 h-8 text-foreground-subtle mx-auto" />
                  <p className="text-sm font-medium text-foreground-muted">
                    No directives added for this category yet
                  </p>
                  <Button size="sm" variant="outline" onClick={() => setShowAdd(true)}>
                    <Plus className="w-4 h-4" /> Add First Rule
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {filteredItems.map((item) => (
                  <Card key={item.id} className="relative group hover:border-brand/40 transition-all">
                    <CardHeader className="pb-2 flex flex-row items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-base font-bold flex items-center gap-2">
                          {item.title}
                        </CardTitle>
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          <Badge
                            variant={
                              item.priority === "high"
                                ? "loss"
                                : item.priority === "medium"
                                ? "warning"
                                : "outline"
                            }
                            className="text-[10px]"
                          >
                            {item.priority.toUpperCase()}
                          </Badge>
                          {item.tags.map((tag) => (
                            <Badge key={tag} variant="outline" className="text-[10px] bg-surface-2">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-loss/10 text-foreground-subtle hover:text-loss transition-all"
                        title="Delete directive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </CardHeader>
                    <CardContent className="pt-2">
                      <p className="text-sm text-foreground-muted whitespace-pre-line leading-relaxed">
                        {item.description}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
