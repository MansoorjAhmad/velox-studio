/**
 * Normalizes a day streak (open-ended) to a 0-100 scale.
 * 0 -> 0, 7 days -> 50, 21 days -> 80, 30+ days -> 100 (capped).
 */
function normalizeStreak(days: number): number {
  if (days <= 0) return 0;
  if (days <= 7) return (days / 7) * 50;
  if (days <= 21) return 50 + ((days - 7) / 14) * 30;
  if (days <= 30) return 80 + ((days - 21) / 9) * 20;
  return 100;
}

export interface DisciplineScore {
  score: number;
  grade: string;
  completionComponent: number;
  streakComponent: number;
}

export function calculateDisciplineScore(
  overallPct: number,
  streak: number,
): DisciplineScore {
  if (overallPct === 0 && streak === 0) {
    return { score: 0, grade: "—", completionComponent: 0, streakComponent: 0 };
  }
  const completionComponent = overallPct;
  const streakComponent = normalizeStreak(streak);
  const score = Math.round(completionComponent * 0.7 + streakComponent * 0.3);

  const grade =
    score >= 90 ? "A+ Apex" :
    score >= 75 ? "A Solid" :
    score >= 60 ? "B+ Building" :
    score >= 40 ? "C Needs Focus" : "D Critical";

  return { score, grade, completionComponent, streakComponent };
}
