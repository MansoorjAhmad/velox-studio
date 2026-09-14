"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Sparkles, ArrowRight, AlertCircle } from "lucide-react";

import { BrandSplash } from "@/components/ui/brand-splash";

function authMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message.toLowerCase() : "";
  if (msg.includes("rate limit") || msg.includes("429") || msg.includes("too many"))
    return "Too many attempts. Wait 60s and try again.";
  if (msg.includes("network") || msg.includes("fetch"))
    return "Network error. Check your connection.";
  if (msg.includes("invalid") || msg.includes("credentials"))
    return "Email or password is incorrect.";
  return err instanceof Error ? err.message : "Login failed. Try again.";
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
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

    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });
      if (signInErr) throw signInErr;
      setAuthenticated(true);
      router.push("/dashboard");
    } catch (err) {
      setError(authMessage(err));
      setLoading(false);
    }
  };

  if (authenticated) {
    return <BrandSplash message="Access verified. Entering trading environment…" />;
  }

  return (
    <div className="flex min-h-svh w-full">
      {/* Left panel — form */}
      <div className="flex flex-1 flex-col items-center justify-center px-8 py-12 relative">
        {/* Background effects */}
        <div className="fixed inset-0 bg-background pointer-events-none" />


        <div className="relative z-10 w-full max-w-[360px] animate-slide-up">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 mb-10 group w-fit">
            <div className="w-9 h-9 rounded-xl bg-brand/15 border border-brand/25 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Sparkles className="w-4.5 h-4.5 text-brand" />
            </div>
            <span className="font-bold tracking-tight text-base">Velox Studio</span>
          </Link>

          {/* Heading */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
            <p className="text-sm text-foreground-muted mt-1.5">
              Sign in to your trading performance OS.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-5">
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
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-semibold text-foreground-muted uppercase tracking-wide">
                  Password
                </Label>
              </div>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
                  Signing in…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Sign In
                  <ArrowRight className="w-4 h-4" />
                </span>
              )}
            </Button>
          </form>

          <p className="mt-7 text-center text-sm text-foreground-subtle">
            Don&apos;t have an account?{" "}
            <Link href="/auth/sign-up" className="text-brand font-semibold hover:text-brand/80 transition-colors">
              Create one free →
            </Link>
          </p>
        </div>
      </div>

      {/* Right panel — brand visual (hidden on mobile) */}
      <div className="hidden lg:flex flex-1 flex-col items-center justify-center relative bg-surface border-l border-border overflow-hidden">
        <div className="relative z-10 max-w-xs text-center space-y-6">
          <div className="w-20 h-20 rounded-2xl overflow-hidden border border-border/80 bg-surface-2 flex items-center justify-center mx-auto shadow-md">
            <Image
              src="/logo.jpg"
              alt="Velox Studio"
              width={80}
              height={80}
              className="w-full h-full object-cover"
              priority
            />
          </div>
          <div>
            <h2 className="text-xl font-bold font-display tracking-tight">
              The OS built for<br />serious traders.
            </h2>
            <p className="text-sm text-foreground-muted mt-3 leading-relaxed">
              Journal your trades, master your risk, track your habits, and execute with AI by your side.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-left">
            {[
              { stat: "100%", label: "Parchment design" },
              { stat: "5-in-1", label: "All-in-one workspace" },
              { stat: "AI", label: "Zenith co-pilot" },
              { stat: "∞", label: "Trade logging" },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-lg border border-border bg-surface-2/50 px-3 py-2.5"
              >
                <p className="text-base font-bold text-brand tabular">{item.stat}</p>
                <p className="text-xs text-foreground-muted mt-0.5">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
