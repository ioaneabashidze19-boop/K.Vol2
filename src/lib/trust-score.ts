/**
 * KavShare Trust Score Scoring Engine
 * Evaluates service provider trust metrics out of 100 points:
 * 1. Verification status (KYC/active account): Max 25 points
 * 2. Average rating score: Max 25 points
 * 3. Project completion rate: Max 25 points
 * 4. Average response time: Max 25 points
 */

export interface TrustMetrics {
  status: string; // 'active', 'pending', 'suspended'
  rating: number; // 0.00 to 5.00
  completion_rate: number; // 0 to 100
  avg_response_time_hours: number; // hours
}

export interface TrustScoreBreakdown {
  total: number;
  verificationScore: number;
  ratingScore: number;
  completionScore: number;
  responseScore: number;
}

export function calculateTrustScore(metrics: Partial<TrustMetrics>): TrustScoreBreakdown {
  const status = metrics.status || "pending";
  const rating = typeof metrics.rating === "number" ? metrics.rating : 0;
  const completionRate = typeof metrics.completion_rate === "number" ? metrics.completion_rate : 100;
  const responseHours = typeof metrics.avg_response_time_hours === "number" ? metrics.avg_response_time_hours : 24;

  // 1. Verification status (active = verified KYC): +25 points
  const verificationScore = status === "active" ? 25 : 0;

  // 2. Average rating: 0-25 points (rating / 5 * 25)
  const ratingScore = Number(((Math.min(5, Math.max(0, rating)) / 5) * 25).toFixed(2));

  // 3. Project completion rate: 0-25 points (completionRate / 100 * 25)
  const completionScore = Number(((Math.min(100, Math.max(0, completionRate)) / 100) * 25).toFixed(2));

  // 4. Response time: 0-25 points (<=24h = 25 points; decays down to 0 points at 168h / 7 days)
  let responseScore = 0;
  if (responseHours <= 24) {
    responseScore = 25;
  } else if (responseHours >= 168) {
    responseScore = 0;
  } else {
    // Linear decay between 24 and 168 hours
    const decayFraction = (responseHours - 24) / (168 - 24);
    responseScore = Number((25 * (1 - decayFraction)).toFixed(2));
  }

  const rawTotal = verificationScore + ratingScore + completionScore + responseScore;
  const total = Math.round(Math.min(100, Math.max(0, rawTotal)));

  return {
    total,
    verificationScore,
    ratingScore,
    completionScore,
    responseScore
  };
}
