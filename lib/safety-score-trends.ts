export type SafetyStatus = "good" | "needs_review" | "high_risk" | "missing_data";
export type SafetyTrend = "Improving" | "Declining" | "Stable" | "Missing history";

export type SafetyTrendInput = {
  safetyStatus: SafetyStatus;
  inspectionCount: number;
  violationCount: number;
  outOfServiceCount: number;
};

export function calculateSafetyTrend(latest: SafetyTrendInput | null, previous: SafetyTrendInput | null): SafetyTrend {
  if (!latest || !previous) return "Missing history";

  const latestRisk = safetyRiskValue(latest);
  const previousRisk = safetyRiskValue(previous);
  if (latestRisk < previousRisk) return "Improving";
  if (latestRisk > previousRisk) return "Declining";

  const latestEventScore = safetyEventScore(latest);
  const previousEventScore = safetyEventScore(previous);
  if (latestEventScore < previousEventScore) return "Improving";
  if (latestEventScore > previousEventScore) return "Declining";
  return "Stable";
}

function safetyRiskValue(score: SafetyTrendInput) {
  return {
    good: 0,
    needs_review: 1,
    high_risk: 2,
    missing_data: 3,
  }[score.safetyStatus];
}

function safetyEventScore(score: SafetyTrendInput) {
  return score.violationCount * 2 + score.outOfServiceCount * 4 + score.inspectionCount * 0.25;
}
