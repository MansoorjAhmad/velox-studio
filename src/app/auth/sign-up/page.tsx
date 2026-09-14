"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles, ArrowRight, AlertCircle, Check } from "lucide-react";
import { BrandSplash } from "@/components/ui/brand-splash";

export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const router = useRouter();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be 6+ characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const defaultName = cleanEmail.split("@")[0];

      const { error: signUpErr, data } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: { data: { display_name: defaultName } },
      });
      if (signUpErr) throw signUpErr;

      if (data?.user) {
        await supabase.from("profiles").upsert(
          {
            id: data.user.id,
            display_name: defaultName,
            account_type: "personal",
            base_currency: "USD",
          },
          { onConflict: "id" }
        );

        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });
        if (!signInErr) {
          setAuthenticated(true);
          // Navigation to /dashboard is handled by BrandSplash via redirectTo prop
        } else {
          router.push("/auth/login");
        }
      } else {
        router.push("/auth/login");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-up failed.");
    } finally {
      setLoading(false);
    }
  };

  if (authenticated) {
    return <BrandSplash message="Account provisioned. Initializing trading workspace…" redirectTo="/dashboard" />;
  }

  const perks = [
    "Full trading journal with analytics",
    "Risk calculator (Standard & Cent accounts)",
    "Daily routine & habit tracker",
    "Velox Zenith AI co-pilot",
    "100% free — no card required",
  ];

  return (
    <div className="flex min-h-svh w-full">
      {/* Left — brand panel (hidden on mobile) */}
      <div className="hidden lg:flex flex-1 flex-col items-center justify-center relative bg-surface border-r border-border overflow-hidden">


        <div className="relative z-10 max-w-xs text-center space-y-8">
          <div className="w-20 h-20 rounded-2xl bg-brand/15 border border-brand/25 flex items-center justify-center mx-auto">
            <Sparkles className="w-10 h-10 text-brand" />
          </div>
          <div>
            <h2 className="text-xl font-bold font-display tracking-tight">
              Start your trading<br />performance journey.
            </h2>
            <p className="text-sm text-foreground-muted mt-2 leading-relaxed">
              Everything you need to trade smarter, live better, and compound consistently.
            </p>
          </div>
          <ul className="space-y-2.5 text-left">
            {perks.map((perk) => (
              <li key={perk} className="flex items-center gap-2.5 text-sm text-foreground-muted">
                <span className="w-4 h-4 rounded-full bg-profit/15 border border-profit/25 flex items-center justify-center shrink-0">
                  <Check className="w-2.5 h-2.5 text-profit" />
                </span>
                {perk}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Right — form */}
      <div className="flex flex-1 flex-col items-center justify-center px-8 py-12 relative">
        <div className="fixed inset-0 bg-background pointer-events-none" />


        <div className="relative z-10 w-full max-w-[360px] animate-slide-up">
          <Link href="/" className="flex items-center gap-2.5 mb-10 group w-fit">
            <div className="w-9 h-9 rounded-xl bg-brand/15 border border-brand/25 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Sparkles className="w-4 h-4 text-brand" />
            </div>
            <span className="font-bold tracking-tight text-base">Velox Studio</span>
          </Link>

          <div className="mb-8">
            <h1 className="text-2xl font-bold font-display tracking-tight">Create your account</h1>
            <p className="text-sm text-foreground-muted mt-1.5">
              Free forever. No credit card. No limits.
            </p>
          </div>

          <form onSubmit={handleSignUp} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-semibold text-foreground-muted uppercase tracking-wide">
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="trader@example.com"
                required
                autoComplete="email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 bg-surface-2 border-border-strong focus:border-brand"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-semibold text-foreground-muted uppercase tracking-wide">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                placeholder="Min 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 bg-surface-2 border-border-strong focus:border-brand"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm" className="text-xs font-semibold text-foreground-muted uppercase tracking-wide">
                Confirm Password
              </Label>
              <Input
                id="confirm"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                placeholder="Repeat your password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="h-11 bg-surface-2 border-border-strong focus:border-brand"
              />
            </div>

            {error && (
              <div className="flex items-start gap-2.5 rounded-lg border border-danger/25 bg-danger/8 px-3 py-2.5 animate-fade-in">
                <AlertCircle className="w-4 h-4 text-danger shrink-0 mt-0.5" />
                <p className="text-sm text-danger leading-snug">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-11 bg-brand text-brand-foreground hover:bg-brand/90 font-semibold text-sm"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating account…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Create Free Account
                  <ArrowRight className="w-4 h-4" />
                </span>
              )}
            </Button>
          </form>

          <p className="mt-7 text-center text-sm text-foreground-subtle">
            Already have an account?{" "}
            <Link href="/auth/login" className="text-brand font-semibold hover:text-brand/80 transition-colors">
              Sign in →
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
