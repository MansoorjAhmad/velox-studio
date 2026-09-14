"use client";

/**
 * AnimatedCounter — smoothly counts up to a numeric value when it mounts or
 * changes. Uses framer-motion's spring animation for a natural deceleration.
 *
 * Usage:
 *   <AnimatedCounter value={1234.56} format="currency" />
 *   <AnimatedCounter value={0.642} format="percent" />
 *   <AnimatedCounter value={42} />  // plain integer
 *
 * Honors prefers-reduced-motion (renders the final value immediately).
 */

import { useEffect, useRef, useState } from "react";
import {
  useMotionValue,
  useSpring,
  useReducedMotion,
} from "framer-motion";
import { cn, formatCurrency } from "@/lib/utils";

type Format = "number" | "currency" | "percent" | "decimal";

export interface AnimatedCounterProps {
  value: number;
  format?: Format;
  /** Decimals for plain number/decimal format. */
  decimals?: number;
  /** Show a +/- sign (currency only). */
  signed?: boolean;
  /** Compact currency notation ($1.2k). */
  compact?: boolean;
  className?: string;
}

export function AnimatedCounter({
  value,
  format = "number",
  decimals,
  signed = false,
  compact = false,
  className,
}: AnimatedCounterProps) {
  const reduce = useReducedMotion();
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, {
    stiffness: 90,
    damping: 22,
    restDelta: 0.001,
  });
  const [display, setDisplay] = useState("0");
  const started = useRef(false);

  useEffect(() => {
    if (reduce) return;
    motionValue.set(value);
  }, [value, reduce, motionValue]);

  useEffect(() => {
    if (reduce) return;
    const unsub = spring.on("change", (latest) => {
      setDisplay(formatValue(latest));
    });
    // Trigger the spring on first mount.
    if (!started.current) {
      started.current = true;
      motionValue.set(value);
    }
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spring]);

  function formatValue(v: number): string {
    switch (format) {
      case "currency":
        return formatCurrency(v, { sign: signed, compact });
      case "percent": {
        const d = decimals ?? 1;
        return `${(v * 100).toFixed(d)}%`;
      }
      case "decimal": {
        const d = decimals ?? 2;
        return v.toFixed(d);
      }
      case "number":
      default: {
        const d = decimals ?? 0;
        return new Intl.NumberFormat("en-US", {
          minimumFractionDigits: d,
          maximumFractionDigits: d,
        }).format(v);
      }
    }
  }

  return (
    <span className={cn("tabular", className)}>
      {reduce ? formatValue(value) : display}
    </span>
  );
}
