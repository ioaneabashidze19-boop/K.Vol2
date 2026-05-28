jest.mock("../lib/supabaseClient", () => ({
  supabase: {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockImplementation(() => Promise.resolve({ data: null, error: null })),
    update: jest.fn().mockImplementation(() => Promise.resolve({ data: null, error: null })),
    delete: jest.fn().mockImplementation(() => Promise.resolve({ data: null, error: null })),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    limit: jest.fn().mockImplementation(() => Promise.resolve({ data: [], error: null })),
    order: jest.fn().mockReturnThis(),
    single: jest.fn().mockImplementation(() => Promise.resolve({ data: null, error: null })),
  },
}));

import { supabase } from "../lib/supabaseClient";
import { calculateTrustScore } from "../lib/trust-score";
import { generatePromoCode } from "../lib/affiliate/code-generator";

describe("Trust Score Calculation System", () => {
  test("calculates maximum trust score of 100 for perfect metrics", () => {
    const score = calculateTrustScore({
      status: "active",
      rating: 5,
      completion_rate: 100,
      avg_response_time_hours: 24,
    });
    expect(score.total).toBe(100);
    expect(score.verificationScore).toBe(25);
    expect(score.ratingScore).toBe(25);
    expect(score.completionScore).toBe(25);
    expect(score.responseScore).toBe(25);
  });

  test("calculates decayed trust score when response time is long", () => {
    const score = calculateTrustScore({
      status: "active",
      rating: 4.0,
      completion_rate: 80,
      avg_response_time_hours: 96, // Decayed response speed
    });
    expect(score.verificationScore).toBe(25);
    expect(score.ratingScore).toBe(20);
    expect(score.completionScore).toBe(20);
    expect(score.responseScore).toBeLessThan(25);
    expect(score.total).toBeLessThan(100);
  });

  test("returns zero scores for unverified or poor inputs", () => {
    const score = calculateTrustScore({
      status: "pending",
      rating: 0,
      completion_rate: 0,
      avg_response_time_hours: 200,
    });
    expect(score.total).toBe(0);
    expect(score.verificationScore).toBe(0);
    expect(score.ratingScore).toBe(0);
    expect(score.completionScore).toBe(0);
    expect(score.responseScore).toBe(0);
  });
});

describe("Affiliate Promo Code Generator", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("generates correct code format KAVSH-XXXX and inserts in DB", async () => {
    ((supabase as any).limit as jest.Mock).mockResolvedValueOnce({ data: [], error: null });
    ((supabase as any).insert as jest.Mock).mockResolvedValueOnce({ error: null });

    const code = await generatePromoCode("company-id-123", "KAVSH", "percentage", 15);
    expect(code).toMatch(/^KAVSH-[A-Z0-9]{4}$/);
    expect((supabase as any).from).toHaveBeenCalledWith("special_offers");
  });

  test("throws error if discount value is negative", async () => {
    await expect(
      generatePromoCode("company-id-123", "KAVSH", "percentage", -5)
    ).rejects.toThrow("Discount value cannot be negative");
  });
});

describe("Commission Calculator", () => {
  // Verifying monthly contract value * commission rate calculations
  const calculateCommission = (monthlyValue: number, commissionRate: number): number => {
    if (monthlyValue < 0 || commissionRate < 0) {
      throw new Error("Invalid negative values");
    }
    return Number(((monthlyValue * commissionRate) / 100).toFixed(2));
  };

  test("calculates flat percentage-based commission correctly", () => {
    const result = calculateCommission(5000, 10); // $5000 project, 10% rate
    expect(result).toBe(500);
  });

  test("returns zero when rate is 0%", () => {
    const result = calculateCommission(1000, 0);
    expect(result).toBe(0);
  });

  test("throws error for negative arguments", () => {
    expect(() => calculateCommission(-1000, 5)).toThrow();
  });
});

describe("Matchmaking Algorithm Scoring helper", () => {
  // Helper to evaluate matchmaking parameters locally (e.g. category alignment & tools match)
  const scoreCategoryMatch = (reqCategory: string, provCategory: string): number => {
    return reqCategory.toLowerCase() === provCategory.toLowerCase() ? 20 : 0;
  };

  const scoreToolsMatch = (reqTools: string[], provTools: string[]): number => {
    const overlaps = reqTools.filter((tool) =>
      provTools.some((pt) => pt.toLowerCase() === tool.toLowerCase())
    );
    return Math.min(overlaps.length * 2, 10);
  };

  test("gives max points for direct category match", () => {
    expect(scoreCategoryMatch("Software Development", "Software Development")).toBe(20);
    expect(scoreCategoryMatch("Software Development", "Design")).toBe(0);
  });

  test("scores tools overlaps correctly up to a cap of 10 points", () => {
    const req = ["React", "TypeScript", "Node.js", "Docker", "AWS", "GraphQL"];
    const prov = ["React", "TypeScript", "Node.js", "Docker", "AWS"]; // 5 matches * 2 = 10 pts
    expect(scoreToolsMatch(req, prov)).toBe(10);

    const provFewer = ["React", "TypeScript"]; // 2 matches * 2 = 4 pts
    expect(scoreToolsMatch(req, provFewer)).toBe(4);
  });
});
