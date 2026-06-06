import { describe, test, expect } from 'vitest';
import { ValidationService, DimensionScore } from './ValidationService';

describe('ValidationService Scoring Logic', () => {
  const defaultDimensions = {
    demand: { score: 80, reason: 'High demand', evidence: [] },
    competition: { score: 70, reason: 'Low competition', evidence: [] },
    monetization: { score: 60, reason: 'Good monetization', evidence: [] },
    distribution: { score: 75, reason: 'Viral potential', evidence: [] },
    retention: { score: 85, reason: 'Sticky product', evidence: [] },
    founder_market_fit: { score: 50, reason: 'Neutral fit', evidence: [] },
  };

  test('should calculate a normal score correctly without penalties', () => {
    const { finalScore, verdict } = ValidationService.calculateFinalScore(defaultDimensions);
    // Weighted sum: 80*0.2 + 70*0.1 + 60*0.2 + 75*0.2 + 85*0.15 + 50*0.15
    // 16 + 7 + 12 + 15 + 12.75 + 7.5 = 70.25
    expect(finalScore).toBe(70);
    expect(verdict).toBe('test');
  });

  test('should apply heavy penalty if a dimension is below 25 (Killer Dimension)', () => {
    const fatalDimensions = {
      ...defaultDimensions,
      monetization: { score: 10, reason: 'No one will pay', evidence: [] },
    };
    
    const { finalScore, floorPenalty, verdict } = ValidationService.calculateFinalScore(fatalDimensions);
    
    // Base score would be around 60.25 (16+7+2+15+12.75+7.5)
    // Penalty: 10/25 = 0.4
    // Final score: 60.25 * 0.4 = 24.1
    expect(finalScore).toBeLessThan(30);
    expect(floorPenalty).toBe(0.4);
    expect(verdict).toBe('drop');
  });

  test('should apply multiple penalties for multiple weak dimensions', () => {
    const multiWeakDimensions = {
      ...defaultDimensions,
      monetization: { score: 20, reason: 'Low price', evidence: [] }, // 20/25 = 0.8
      distribution: { score: 15, reason: 'No channels', evidence: [] }, // 15/25 = 0.6
    };

    const { finalScore, floorPenalty } = ValidationService.calculateFinalScore(multiWeakDimensions);
    // Combined penalty: 0.8 * 0.6 = 0.48
    expect(floorPenalty).toBeCloseTo(0.48);
    expect(finalScore).toBeLessThan(30);
  });

  test('should clamp score between 0 and 100', () => {
    const perfectDimensions = Object.fromEntries(
      Object.keys(defaultDimensions).map(k => [k, { score: 100, reason: 'Perfect', evidence: [] }])
    ) as any;
    
    const { finalScore, verdict } = ValidationService.calculateFinalScore(perfectDimensions);
    expect(finalScore).toBe(100);
    expect(verdict).toBe('pursue');
  });
});
