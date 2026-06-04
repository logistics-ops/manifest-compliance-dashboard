import assert from "node:assert/strict";
import test from "node:test";
import { calculateSafetyTrend, type SafetyStatus, type SafetyTrendInput } from "../../lib/safety-score-trends";

test("manual safety score trends compare latest and previous posture", () => {
  assert.equal(calculateSafetyTrend(score("good", 2, 0, 0), score("needs_review", 2, 1, 0)), "Improving");
  assert.equal(calculateSafetyTrend(score("high_risk", 2, 3, 1), score("needs_review", 2, 1, 0)), "Declining");
  assert.equal(calculateSafetyTrend(score("good", 2, 0, 0), score("good", 2, 0, 0)), "Stable");
  assert.equal(calculateSafetyTrend(score("good", 2, 0, 0), null), "Missing history");
});

test("manual safety score trends use counts when status is unchanged", () => {
  assert.equal(calculateSafetyTrend(score("needs_review", 2, 1, 0), score("needs_review", 5, 3, 1)), "Improving");
  assert.equal(calculateSafetyTrend(score("needs_review", 5, 4, 1), score("needs_review", 2, 1, 0)), "Declining");
});

function score(status: SafetyStatus, inspectionCount: number, violationCount: number, outOfServiceCount: number): SafetyTrendInput {
  return {
    safetyStatus: status,
    inspectionCount,
    violationCount,
    outOfServiceCount,
  };
}
