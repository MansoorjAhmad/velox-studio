"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { EASE } from "@/components/ui/motion";

export interface BrandSplashProps {
  message?: string;
}

export function BrandSplash({ message = "Calibrating workspace and active accounts…" }: BrandSplashProps) {
  const reduce = useReducedMotion();

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background select-none">
      {/* Background ambient warmth */}
      <div className="absolute inset-0 bg-radial from-brand/4 via-transparent to-transparent pointer-events-none" />

      <motion.div
        initial={reduce ? { opacity: 1 } : { opacity: 0, y: 8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: EASE }}
        className="relative z-10 flex flex-col items-center text-center px-6 max-w-sm"
      >
        {/* Emblem */}
        <div className="relative mb-6">
          <div className="w-14 h-14 rounded-2xl bg-surface border border-border-strong shadow-md flex items-center justify-center p-2.5 overflow-hidden">
            <Image
              src="/logo.jpg"
              alt="Velox Studio"
              width={48}
              height={48}
              className="w-full h-full object-cover rounded-lg"
              priority
            />
          </div>
          {/* Subtle pulse ring */}
          {!reduce && (
            <motion.div
              animate={{ scale: [1, 1.25, 1], opacity: [0.35, 0, 0.35] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
              className="absolute inset-0 -m-1 rounded-2xl border border-brand/25 pointer-events-none"
            />
          )}
        </div>

        {/* Wordmark */}
        <div className="space-y-1 mb-6">
          <span className="font-display text-2xl font-medium tracking-tight text-foreground block leading-none">
            VELOX
          </span>
          <span className="text-[10px] text-foreground-subtle tracking-[0.24em] uppercase font-bold block">
            STUDIO
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-44 h-1 rounded-full bg-surface-2 overflow-hidden mb-3.5 border border-border/50">
          {!reduce ? (
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: "100%" }}
              transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
              className="h-full w-1/2 rounded-full bg-gradient-to-r from-transparent via-brand to-transparent"
            />
          ) : (
            <div className="h-full w-2/3 bg-brand rounded-full" />
          )}
        </div>

        {/* Message */}
        <p className="text-xs font-mono text-foreground-muted tracking-tight">
          {message}
        </p>
      </motion.div>
    </div>
  );
}
