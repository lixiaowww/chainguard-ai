import { describe, test, expect } from 'vitest';
import { ValidationService } from './ValidationService';

describe('ValidationService Scoring Logic', () => {
  const defaultDimensions = {
    thermal_integrity: { score: 80, reason: 'Stable temp', evidence: [] },
    physical_stability: { score: 70, reason: 'Few shocks', evidence: [] },
    transit_velocity: { score: 60, reason: 'Normal duration', evidence: [] },
    sla_compliance: { score: 75, reason: 'Met terms', evidence: [] },
    exemption_risk: { score: 85, reason: 'No exemptions', evidence: [] },
    loss_mitigation: { score: 50, reason: 'Small spoilage', evidence: [] },
  };

  test('should calculate a normal score correctly without penalties', () => {
    const { finalScore, verdict } = ValidationService.calculateFinalScore(defaultDimensions);
    expect(finalScore).toBeGreaterThan(50);
    expect(verdict).not.toBe('total_loss');
  });

  test('should apply heavy penalty if a dimension is below 25 (Killer Dimension)', () => {
    const fatalDimensions = {
      ...defaultDimensions,
      thermal_integrity: { score: 10, reason: 'Frozen solid', evidence: [] },
    };
    
    const { finalScore, verdict } = ValidationService.calculateFinalScore(fatalDimensions);
    
    expect(finalScore).toBeLessThan(30);
    expect(verdict).toBe('total_loss');
  });

  test('should apply multiple penalties for multiple weak dimensions', () => {
    const multiWeakDimensions = {
      ...defaultDimensions,
      thermal_integrity: { score: 20, reason: 'Hot', evidence: [] }, 
      physical_stability: { score: 15, reason: 'Dropped', evidence: [] },
    };

    const { finalScore } = ValidationService.calculateFinalScore(multiWeakDimensions);
    expect(finalScore).toBeLessThan(30);
  });

  test('should clamp score between 0 and 100', () => {
    const perfectDimensions = Object.fromEntries(
      Object.keys(defaultDimensions).map(k => [k, { score: 100, reason: 'Perfect', evidence: [] }])
    ) as any;
    
    const { finalScore, verdict } = ValidationService.calculateFinalScore(perfectDimensions);
    expect(finalScore).toBe(100);
    expect(verdict).toBe('clear');
  });
});
