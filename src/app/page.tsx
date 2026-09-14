"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { FadeIn, Stagger, StaggerItem } from "@/components/ui/motion";
import {
  Sparkles,
  ArrowRight,
  Shield,
  BarChart3,
  Brain,
  Terminal,
  Layers,
  ChevronRight,
  LineChart,
  ArrowUpRight,
  Check,
} from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export default function LandingPage() {
  const [terminalTab, setTerminalTab] = useState<"tape" | "curve" | "discipline">("tape");

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden selection:bg-brand/20">
      {/* Navigation Header */}
      <header className="sticky top-0 z-50 border-b border-border/70 bg-background/85 backdrop-blur-xl transition-all">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="h-10 w-10 rounded-lg overflow-hidden border border-border/80 bg-surface-2 flex items-center justify-center shrink-0 shadow-sm transition-transform group-hover:scale-105">
              <Image
                src="/logo.jpg"
                alt="Velox Studio"
                width={40}
                height={40}
                className="w-full h-full object-cover"
                priority
              />
            </div>
            <div>
              <span className="font-display text-lg font-semibold tracking-tight leading-none block text-foreground">
                VELOX
              </span>
              <span className="text-[10px] text-foreground-subtle tracking-[0.2em] uppercase font-bold leading-none block mt-0.5">
                STUDIO
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-xs font-semibold uppercase tracking-wider text-foreground-muted">
            <a href="#terminal-preview" className="hover:text-foreground transition-colors">Terminal</a>
            <a href="#pillars" className="hover:text-foreground transition-colors">Architecture</a>
            <a href="#discipline" className="hover:text-foreground transition-colors">Trader Index</a>
            <a href="#zenith" className="hover:text-foreground transition-colors">Zenith AI</a>
          </nav>

          <div className="flex items-center gap-3">
            <ThemeToggle size="sm" />
            <Link href="/auth/login">
              <Button variant="ghost" size="sm" className="font-medium text-xs tracking-wide">
                Sign In
              </Button>
            </Link>
            <Link href="/auth/sign-up">
              <Button size="sm" className="font-semibold text-xs tracking-wide bg-foreground text-background hover:bg-foreground/90 shadow-sm">
                Launch Workspace
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-20 md:pt-28 pb-24 overflow-hidden">
        <div className="max-w-5xl mx-auto px-6 text-center">
          {/* Status Pill */}
          <FadeIn delay={0.05}>
            <div className="inline-flex items-center gap-2.5 rounded-full border border-border bg-surface px-4 py-1.5 text-xs font-mono font-medium text-foreground-muted mb-8 shadow-xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-profit opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-profit" />
              </span>
              <span className="tracking-wider uppercase text-[11px] font-bold text-foreground">Velox Terminal v2.4</span>
              <span className="text-border">|</span>
              <span className="text-foreground-subtle">Institutional Trading Environment</span>
            </div>
          </FadeIn>

          {/* Headline */}
          <FadeIn delay={0.12}>
            <h1 className="font-display font-light text-4xl sm:text-6xl md:text-7xl lg:text-[5rem] tracking-tight leading-[1.05] text-foreground mb-7 max-w-4xl mx-auto">
              Trade with the discipline of an institution.
            </h1>
          </FadeIn>

          {/* Subtitle */}
          <FadeIn delay={0.2}>
            <p className="text-base sm:text-lg md:text-xl text-foreground-muted max-w-2xl mx-auto mb-10 leading-relaxed font-sans">
              The unified operating system for elite discretionary and quantitative traders. High-resolution trade journaling, behavioral tilt forensics, and autonomous edge analytics — engineered without noise.
            </p>
          </FadeIn>

          {/* Dual CTAs */}
          <FadeIn delay={0.28}>
            <div className="flex flex-col sm:flex-row gap-3.5 justify-center items-center mb-16">
              <Link href="/auth/sign-up" className="w-full sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto font-semibold px-8 h-12 text-sm bg-foreground text-background hover:bg-foreground/90 shadow-sm gap-2">
                  Launch Institutional Workspace
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Link href="/dashboard" className="w-full sm:w-auto">
                <Button size="lg" variant="outline" className="w-full sm:w-auto font-medium px-7 h-12 text-sm border-border-strong hover:bg-surface">
                  Explore Sandbox
                  <ArrowUpRight className="w-4 h-4 ml-1 opacity-70" />
                </Button>
              </Link>
            </div>
          </FadeIn>

          {/* Institutional Metric Ribbon */}
          <FadeIn delay={0.34} whenInView>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto pt-4 pb-2 border-y border-border/60 text-left">
              <div className="p-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-foreground-subtle">P&L Attribution</div>
                <div className="font-mono font-bold text-lg text-foreground mt-0.5">Multi-Asset Engine</div>
                <div className="text-xs text-foreground-muted mt-0.5">FX, Indices, Metals, Crypto</div>
              </div>
              <div className="p-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-foreground-subtle">Discipline Score</div>
                <div className="font-mono font-bold text-lg text-profit mt-0.5">Trader Index 2.0</div>
                <div className="text-xs text-foreground-muted mt-0.5">Real-time tilt detection</div>
              </div>
              <div className="p-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-foreground-subtle">Edge Forensics</div>
                <div className="font-mono font-bold text-lg text-foreground mt-0.5">Zenith AI Copilot</div>
                <div className="text-xs text-foreground-muted mt-0.5">Cross-trade pattern mining</div>
              </div>
              <div className="p-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-foreground-subtle">Privacy & Sovereignty</div>
                <div className="font-mono font-bold text-lg text-foreground mt-0.5">100% Encrypted</div>
                <div className="text-xs text-foreground-muted mt-0.5">Supabase RLS database</div>
              </div>
            </div>
          </FadeIn>
        </div>

        {/* Interactive Live Parchment Terminal Preview Widget */}
        <div id="terminal-preview" className="max-w-6xl mx-auto px-6 mt-16">
          <FadeIn delay={0.4} whenInView>
            <div className="rounded-2xl border border-border bg-surface shadow-xl overflow-hidden transition-all">
              {/* Terminal Window Header Bar */}
              <div className="bg-surface-2/90 border-b border-border px-5 py-3.5 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-border-strong/70" />
                    <div className="w-2.5 h-2.5 rounded-full bg-border-strong/70" />
                    <div className="w-2.5 h-2.5 rounded-full bg-border-strong/70" />
                  </div>
                  <span className="font-mono text-xs font-semibold text-foreground tracking-tight flex items-center gap-2">
                    <span>velox-os // alpha-macro-env</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-profit/15 text-profit font-mono font-bold">
                      LIVE 32ms
                    </span>
                  </span>
                </div>

                {/* Segmented View Switcher */}
                <div className="flex items-center bg-surface rounded-lg p-1 border border-border">
                  <button
                    onClick={() => setTerminalTab("tape")}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                      terminalTab === "tape"
                        ? "bg-surface-2 text-foreground font-semibold shadow-xs"
                        : "text-foreground-muted hover:text-foreground"
                    }`}
                  >
                    <Terminal className="w-3.5 h-3.5" />
                    <span>Live Tape</span>
                  </button>
                  <button
                    onClick={() => setTerminalTab("curve")}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                      terminalTab === "curve"
                        ? "bg-surface-2 text-foreground font-semibold shadow-xs"
                        : "text-foreground-muted hover:text-foreground"
                    }`}
                  >
                    <LineChart className="w-3.5 h-3.5" />
                    <span>Composite Equity</span>
                  </button>
                  <button
                    onClick={() => setTerminalTab("discipline")}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                      terminalTab === "discipline"
                        ? "bg-surface-2 text-foreground font-semibold shadow-xs"
                        : "text-foreground-muted hover:text-foreground"
                    }`}
                  >
                    <Shield className="w-3.5 h-3.5" />
                    <span>Discipline Matrix</span>
                  </button>
                </div>
              </div>

              {/* Terminal Body */}
              <div className="p-6 md:p-8 bg-surface">
                {terminalTab === "tape" && (
                  <div className="space-y-4 animate-fade-in">
                    <div className="flex items-center justify-between border-b border-border/60 pb-3">
                      <div className="flex items-center gap-4 text-xs font-mono text-foreground-muted">
                        <span>SESSION: LONDON / NY OVERLAP</span>
                        <span>ACCOUNT: APEX_FUNDED_150K</span>
                        <span className="text-profit font-bold">DAY NET: +$4,520.00 (+3.01%)</span>
                      </div>
                      <span className="text-[11px] font-mono text-foreground-subtle hidden sm:inline-block">
                        4 EXECUTIONS LOGGED
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs font-mono">
                        <thead>
                          <tr className="border-b border-border text-foreground-subtle text-[11px] uppercase tracking-wider">
                            <th className="py-2 font-semibold">Time</th>
                            <th className="py-2 font-semibold">Asset</th>
                            <th className="py-2 font-semibold">Direction</th>
                            <th className="py-2 font-semibold">Model / Setup</th>
                            <th className="py-2 font-semibold">Risk (R)</th>
                            <th className="py-2 font-semibold">Realized P&L</th>
                            <th className="py-2 font-semibold text-right">Adherence</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40">
                          <tr className="hover:bg-surface-2/40 transition-colors">
                            <td className="py-3 text-foreground-muted">14:22:10</td>
                            <td className="py-3 font-bold text-foreground">XAUUSD</td>
                            <td className="py-3"><span className="px-1.5 py-0.5 rounded bg-profit/15 text-profit font-bold text-[10px]">LONG</span></td>
                            <td className="py-3 text-foreground-muted">Asia Low Sweep</td>
                            <td className="py-3 font-bold text-profit">+3.42 R</td>
                            <td className="py-3 font-bold text-profit">+$3,420.00</td>
                            <td className="py-3 text-right"><span className="px-1.5 py-0.5 rounded bg-profit/10 text-profit text-[10px] font-bold">100% DISCIPLINE</span></td>
                          </tr>
                          <tr className="hover:bg-surface-2/40 transition-colors">
                            <td className="py-3 text-foreground-muted">13:45:04</td>
                            <td className="py-3 font-bold text-foreground">NQ (NAS100)</td>
                            <td className="py-3"><span className="px-1.5 py-0.5 rounded bg-profit/15 text-profit font-bold text-[10px]">LONG</span></td>
                            <td className="py-3 text-foreground-muted">Opening Reclaim</td>
                            <td className="py-3 font-bold text-profit">+2.10 R</td>
                            <td className="py-3 font-bold text-profit">+$2,100.00</td>
                            <td className="py-3 text-right"><span className="px-1.5 py-0.5 rounded bg-profit/10 text-profit text-[10px] font-bold">100% DISCIPLINE</span></td>
                          </tr>
                          <tr className="hover:bg-surface-2/40 transition-colors">
                            <td className="py-3 text-foreground-muted">10:15:33</td>
                            <td className="py-3 font-bold text-foreground">EURUSD</td>
                            <td className="py-3"><span className="px-1.5 py-0.5 rounded bg-loss/15 text-loss font-bold text-[10px]">SHORT</span></td>
                            <td className="py-3 text-foreground-muted">London Continuation</td>
                            <td className="py-3 font-bold text-loss">-1.00 R</td>
                            <td className="py-3 font-bold text-loss">-$1,000.00</td>
                            <td className="py-3 text-right"><span className="px-1.5 py-0.5 rounded bg-profit/10 text-profit text-[10px] font-bold">100% STOP HIT</span></td>
                          </tr>
                          <tr className="hover:bg-surface-2/40 transition-colors">
                            <td className="py-3 text-foreground-muted">09:02:18</td>
                            <td className="py-3 font-bold text-foreground">US500</td>
                            <td className="py-3"><span className="px-1.5 py-0.5 rounded bg-profit/15 text-profit font-bold text-[10px]">SHORT</span></td>
                            <td className="py-3 text-foreground-muted">Fair Value Gap</td>
                            <td className="py-3 font-bold text-profit">+1.80 R</td>
                            <td className="py-3 font-bold text-profit">+$1,800.00</td>
                            <td className="py-3 text-right"><span className="px-1.5 py-0.5 rounded bg-profit/10 text-profit text-[10px] font-bold">100% DISCIPLINE</span></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {terminalTab === "curve" && (
                  <div className="space-y-6 animate-fade-in">
                    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-3">
                      <div>
                        <div className="text-[11px] font-mono text-foreground-subtle uppercase">Composite Net Realized Equity</div>
                        <div className="font-display text-3xl font-bold text-foreground mt-0.5">$154,520.00</div>
                      </div>
                      <div className="flex items-center gap-6 font-mono text-xs">
                        <div>
                          <span className="text-foreground-subtle block text-[10px]">WIN RATE</span>
                          <span className="font-bold text-profit text-sm">68.4%</span>
                        </div>
                        <div>
                          <span className="text-foreground-subtle block text-[10px]">PROFIT FACTOR</span>
                          <span className="font-bold text-foreground text-sm">2.84</span>
                        </div>
                        <div>
                          <span className="text-foreground-subtle block text-[10px]">MAX DRAWDOWN</span>
                          <span className="font-bold text-loss text-sm">-2.4%</span>
                        </div>
                        <div>
                          <span className="text-foreground-subtle block text-[10px]">SHARPE RATIO</span>
                          <span className="font-bold text-foreground text-sm">2.41</span>
                        </div>
                      </div>
                    </div>

                    {/* High-Res Vector Equity Curve */}
                    <div className="relative w-full h-48 bg-surface-2/30 rounded-xl p-4 border border-border/50 flex flex-col justify-end overflow-hidden">
                      <svg className="w-full h-36 overflow-visible" viewBox="0 0 800 160" fill="none" preserveAspectRatio="none">
                        <defs>
                          <linearGradient id="curveGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="#3f6b46" stopOpacity="0.25" />
                            <stop offset="100%" stopColor="#3f6b46" stopOpacity="0.0" />
                          </linearGradient>
                        </defs>
                        <line x1="0" y1="30" x2="800" y2="30" stroke="currentColor" className="text-border/40" strokeDasharray="4 4" />
                        <line x1="0" y1="70" x2="800" y2="70" stroke="currentColor" className="text-border/40" strokeDasharray="4 4" />
                        <line x1="0" y1="110" x2="800" y2="110" stroke="currentColor" className="text-border/40" strokeDasharray="4 4" />
                        <line x1="0" y1="150" x2="800" y2="150" stroke="currentColor" className="text-border/40" />

                        <path
                          d="M 0 140 Q 80 135, 140 120 T 260 100 T 380 90 T 480 65 T 580 50 T 680 35 T 800 15 L 800 160 L 0 160 Z"
                          fill="url(#curveGrad)"
                        />
                        <path
                          d="M 0 140 Q 80 135, 140 120 T 260 100 T 380 90 T 480 65 T 580 50 T 680 35 T 800 15"
                          stroke="#3f6b46"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          fill="none"
                        />
                      </svg>
                      <div className="flex justify-between text-[10px] font-mono text-foreground-subtle pt-2">
                        <span>30 DAYS AGO</span>
                        <span>DAY 15</span>
                        <span>ACTIVE SESSION (ATH)</span>
                      </div>
                    </div>
                  </div>
                )}

                {terminalTab === "discipline" && (
                  <div className="space-y-6 animate-fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                      <div className="md:col-span-4 flex flex-col items-center justify-center p-5 bg-surface-2/40 rounded-xl border border-border/60 text-center">
                        <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-foreground-subtle">Discipline Index</span>
                        <div className="relative w-28 h-28 my-3 flex items-center justify-center">
                          <div className="text-center">
                            <span className="font-mono font-bold text-4xl text-profit">86</span>
                            <span className="text-[10px] text-foreground-subtle block font-semibold">GRADE A+</span>
                          </div>
                        </div>
                        <span className="text-xs font-semibold text-profit bg-profit/10 px-2.5 py-1 rounded-full">
                          Institutional Standard
                        </span>
                      </div>

                      <div className="md:col-span-8 space-y-3.5">
                        <div>
                          <div className="flex justify-between text-xs font-mono mb-1">
                            <span className="font-medium text-foreground">Risk Parameter Discipline</span>
                            <span className="font-bold text-profit">94%</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-surface-3 overflow-hidden">
                            <div className="h-full bg-profit rounded-full" style={{ width: "94%" }} />
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between text-xs font-mono mb-1">
                            <span className="font-medium text-foreground">Revenge Trade Defense (0 Violations)</span>
                            <span className="font-bold text-profit">100%</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-surface-3 overflow-hidden">
                            <div className="h-full bg-profit rounded-full" style={{ width: "100%" }} />
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between text-xs font-mono mb-1">
                            <span className="font-medium text-foreground">Plan & Execution Adherence</span>
                            <span className="font-bold text-foreground">88%</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-surface-3 overflow-hidden">
                            <div className="h-full bg-foreground rounded-full" style={{ width: "88%" }} />
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between text-xs font-mono mb-1">
                            <span className="font-medium text-foreground">Emotional State Stability</span>
                            <span className="font-bold text-profit">82%</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-surface-3 overflow-hidden">
                            <div className="h-full bg-profit rounded-full" style={{ width: "82%" }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Terminal Window Status Bar */}
              <div className="bg-surface-2/60 border-t border-border px-5 py-2.5 flex flex-wrap items-center justify-between text-[11px] font-mono text-foreground-subtle">
                <div className="flex items-center gap-4">
                  <span>SYSTEM: NOMINAL</span>
                  <span>ENCRYPTION: AES-256</span>
                  <span>ENGINE: NEXT.JS TURBOPACK + SUPABASE</span>
                </div>
                <div>
                  <span>ZERO THIRD-PARTY TRACKERS</span>
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* The 3 Core Institutional Pillars */}
      <section id="pillars" className="py-24 border-t border-border/50 bg-surface/30">
        <div className="max-w-6xl mx-auto px-6">
          <FadeIn whenInView>
            <div className="text-center max-w-3xl mx-auto mb-16">
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-mono text-foreground-muted mb-4">
                <Layers className="w-3.5 h-3.5" />
                Three Institutional Pillars
              </div>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-display font-medium text-foreground mb-4">
                Built for the craft of profitable execution.
              </h2>
              <p className="text-foreground-muted text-base leading-relaxed">
                Every serious trading desk operates around three non-negotiables: absolute data capture, strict behavioral boundaries, and statistical edge refinement.
              </p>
            </div>
          </FadeIn>

          <Stagger className="grid md:grid-cols-3 gap-6" whenInView stagger={0.08}>
            {/* Pillar 1 */}
            <StaggerItem className="h-full">
              <div className="h-full rounded-2xl border border-border bg-surface p-7 flex flex-col justify-between hover:border-border-strong transition-all shadow-xs">
                <div>
                  <div className="w-11 h-11 rounded-xl bg-surface-2 border border-border flex items-center justify-center mb-5">
                    <BarChart3 className="w-5 h-5 text-foreground" />
                  </div>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-foreground-subtle block mb-1">
                    PILLAR 01
                  </span>
                  <h3 className="text-xl font-display font-bold text-foreground mb-3">
                    High-Resolution Execution Log
                  </h3>
                  <p className="text-sm text-foreground-muted leading-relaxed mb-6">
                    Ditch cumbersome spreadsheets. Capture entry, stop, take profit, contract lot size, setup confluences, commissions, and multi-currency conversions with instant zero-lag responsiveness.
                  </p>
                </div>
                <ul className="space-y-2.5 text-xs text-foreground-muted border-t border-border/60 pt-5">
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-profit shrink-0" />
                    <span>Exact R-multiple & P&L calculation</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-profit shrink-0" />
                    <span>Multi-broker & prop firm account filtering</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-profit shrink-0" />
                    <span>Screenshot lightbox with pre & post review</span>
                  </li>
                </ul>
              </div>
            </StaggerItem>

            {/* Pillar 2 */}
            <StaggerItem className="h-full">
              <div className="h-full rounded-2xl border border-border bg-surface p-7 flex flex-col justify-between hover:border-border-strong transition-all shadow-xs">
                <div>
                  <div className="w-11 h-11 rounded-xl bg-surface-2 border border-border flex items-center justify-center mb-5">
                    <Shield className="w-5 h-5 text-profit" />
                  </div>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-foreground-subtle block mb-1">
                    PILLAR 02
                  </span>
                  <h3 className="text-xl font-display font-bold text-foreground mb-3">
                    Trader Index & Tilt Defense
                  </h3>
                  <p className="text-sm text-foreground-muted leading-relaxed mb-6">
                    Unchecked emotional spirals destroy otherwise profitable edges. The Trader Index calculates real-time discipline metrics, tracking position size inflation after losses and stop-loss removals.
                  </p>
                </div>
                <ul className="space-y-2.5 text-xs text-foreground-muted border-t border-border/60 pt-5">
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-profit shrink-0" />
                    <span>Algorithmic revenge-trade detection</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-profit shrink-0" />
                    <span>Emotional mindset correlation matrix</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-profit shrink-0" />
                    <span>Daily risk cap & draw-down guardrails</span>
                  </li>
                </ul>
              </div>
            </StaggerItem>

            {/* Pillar 3 */}
            <StaggerItem className="h-full">
              <div className="h-full rounded-2xl border border-border bg-surface p-7 flex flex-col justify-between hover:border-border-strong transition-all shadow-xs">
                <div>
                  <div className="w-11 h-11 rounded-xl bg-surface-2 border border-border flex items-center justify-center mb-5">
                    <Brain className="w-5 h-5 text-brand" />
                  </div>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-foreground-subtle block mb-1">
                    PILLAR 03
                  </span>
                  <h3 className="text-xl font-display font-bold text-foreground mb-3">
                    Zenith AI Copilot & Forensics
                  </h3>
                  <p className="text-sm text-foreground-muted leading-relaxed mb-6">
                    An objective institutional partner that inspects your actual logs. Zenith highlights blindspots, analyzes timing tendencies, drafts executive weekly reviews, and answers natural language inquiries.
                  </p>
                </div>
                <ul className="space-y-2.5 text-xs text-foreground-muted border-t border-border/60 pt-5">
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-profit shrink-0" />
                    <span>Cross-trade leak identification</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-profit shrink-0" />
                    <span>Conversational trade database search</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-profit shrink-0" />
                    <span>Personalized executive debriefs</span>
                  </li>
                </ul>
              </div>
            </StaggerItem>
          </Stagger>
        </div>
      </section>

      {/* Interactive Zenith Forensics Showcase */}
      <section id="zenith" className="py-24 border-t border-border/50">
        <div className="max-w-5xl mx-auto px-6">
          <div className="rounded-2xl border border-border bg-surface p-8 md:p-12">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <FadeIn direction="right" className="lg:col-span-6 space-y-4" whenInView>
                <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-2 px-3 py-1 text-xs font-mono text-foreground-muted">
                  <Brain className="w-3.5 h-3.5 text-brand" />
                  Zenith Intelligence
                </div>
                <h2 className="text-3xl font-display font-semibold text-foreground leading-tight">
                  Ask your own journal anything. Get raw statistical truth.
                </h2>
                <p className="text-sm text-foreground-muted leading-relaxed">
                  Instead of guessing whether Friday afternoon trades are profitable or if your stop-loss on Gold is too tight, ask Zenith. It processes your trades without sending proprietary data to public models.
                </p>
                <div className="pt-2">
                  <Link href="/dashboard/zenith">
                    <Button variant="outline" size="sm" className="text-xs font-semibold gap-1.5 border-border-strong">
                      Explore Zenith Copilot
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Button>
                  </Link>
                </div>
              </FadeIn>

              <FadeIn direction="left" className="lg:col-span-6" whenInView>
                <div className="rounded-xl border border-border bg-surface-2 p-5 font-mono text-xs space-y-4 shadow-sm">
                  <div className="flex items-center justify-between border-b border-border/70 pb-2.5 text-[11px] text-foreground-subtle">
                    <span>ZENITH QUERY CONSOLE</span>
                    <span className="text-profit font-bold">CONNECTED</span>
                  </div>

                  <div className="bg-surface p-3.5 rounded-lg border border-border/80">
                    <span className="text-foreground-subtle text-[10px] block mb-1">INPUT PROMPT</span>
                    <p className="text-foreground font-medium">
                      &quot;Compare my win-rate and average R on XAUUSD when entered during London Session vs New York Session over the last 90 days.&quot;
                    </p>
                  </div>

                  <div className="bg-surface p-3.5 rounded-lg border border-border/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-foreground-subtle text-[10px]">ZENITH FORENSIC SYNTHESIS</span>
                      <span className="text-[10px] text-profit font-bold">SAMPLE N=54</span>
                    </div>
                    <p className="text-foreground-muted text-[11px] leading-relaxed">
                      • <strong className="text-foreground">London Session (N=32):</strong> Win Rate 71.8% | Avg R: +2.85R | Profit Factor: 3.14<br />
                      • <strong className="text-foreground">New York Session (N=22):</strong> Win Rate 45.4% | Avg R: +1.10R | Profit Factor: 1.05
                    </p>
                    <div className="text-[11px] text-brand bg-brand/10 p-2 rounded border border-brand/20">
                      💡 <strong>Actionable takeaway:</strong> You are overtrading the NY session after hitting targets in London. Ceasing NY XAUUSD entries increases overall expectancy by +38%.
                    </div>
                  </div>
                </div>
              </FadeIn>
            </div>
          </div>
        </div>
      </section>

      {/* Sovereign Commitment CTA */}
      <section className="py-24 border-t border-border/50 bg-surface/20">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <FadeIn whenInView>
            <div className="w-12 h-12 rounded-2xl bg-surface-2 border border-border flex items-center justify-center mx-auto mb-6">
              <Shield className="w-6 h-6 text-foreground" />
            </div>
            <h2 className="text-3xl sm:text-4xl font-display font-medium text-foreground mb-4">
              Engineered for discretion and mastery.
            </h2>
            <p className="text-foreground-muted text-sm sm:text-base mb-8 max-w-lg mx-auto leading-relaxed">
              No intrusive subscriptions, no advertisements, and no selling your trade logs to market makers. A sovereign environment for serious operators.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
              <Link href="/auth/sign-up" className="w-full sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto font-semibold px-9 h-12 text-sm bg-foreground text-background hover:bg-foreground/90 shadow-sm gap-2">
                  Launch Your Workspace Free
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
            <p className="text-xs text-foreground-subtle mt-4 font-mono">
              Unlimited Trades · Supabase Row-Level Security · Instant Setup
            </p>
          </FadeIn>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-surface-2/40">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
            <div className="space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-surface border border-border flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-foreground" />
                </div>
                <span className="font-bold text-foreground text-sm tracking-tight">VELOX STUDIO</span>
              </div>
              <p className="text-xs text-foreground-subtle leading-relaxed max-w-xs">
                The institutional trading operating system. Journaling, analytics, and behavioral forensics.
              </p>
            </div>

            <div className="space-y-2.5 text-xs">
              <p className="font-mono font-bold uppercase tracking-wider text-foreground-subtle">Core Modules</p>
              <ul className="space-y-2 text-foreground-muted">
                <li><Link href="/dashboard/journal" className="hover:text-foreground transition-colors">Trade Journal</Link></li>
                <li><Link href="/dashboard/analytics" className="hover:text-foreground transition-colors">Analytics Engine</Link></li>
                <li><Link href="/dashboard/zenith" className="hover:text-foreground transition-colors">Zenith AI</Link></li>
                <li><Link href="/dashboard/backtest" className="hover:text-foreground transition-colors">Backtest Replay</Link></li>
              </ul>
            </div>

            <div className="space-y-2.5 text-xs">
              <p className="font-mono font-bold uppercase tracking-wider text-foreground-subtle">Calculators & Risk</p>
              <ul className="space-y-2 text-foreground-muted">
                <li><Link href="/dashboard/calculator" className="hover:text-foreground transition-colors">Risk Calculator</Link></li>
                <li><Link href="/dashboard/finance" className="hover:text-foreground transition-colors">Finance & Net Worth</Link></li>
                <li><Link href="/dashboard/routines" className="hover:text-foreground transition-colors">Daily Routines</Link></li>
                <li><Link href="/dashboard/accounts" className="hover:text-foreground transition-colors">Account Registry</Link></li>
              </ul>
            </div>

            <div className="space-y-2.5 text-xs">
              <p className="font-mono font-bold uppercase tracking-wider text-foreground-subtle">Sovereignty & Security</p>
              <p className="text-foreground-subtle text-xs leading-relaxed">
                Every data point is stored in an encrypted database isolated by tenant ID and Row-Level Security policies.
              </p>
              <div className="pt-2">
                <Link href="/auth/sign-up">
                  <Button size="sm" variant="outline" className="w-full text-xs font-semibold border-border-strong">
                    Open Free Account
                  </Button>
                </Link>
              </div>
            </div>
          </div>

          <div className="border-t border-border/60 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-foreground-subtle font-mono">
            <span>© {new Date().getFullYear()} VELOX STUDIO. INSTITUTIONAL GRADE TRADING ENVIRONMENT.</span>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-profit" />
              <span>ALL SYSTEMS ACTIVE</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
