import fs from 'fs';
import path from 'path';
import { ValidationService } from '../src/lib/ValidationService';

async function main() {
  console.log('Evaluating ChainGuard AI Professional Logic...');

  const dimensions = {
    thermal_integrity: {
      score: 80,
      reason: 'Stable temperature control across most segments.',
      evidence: []
    },
    physical_stability: {
      score: 75,
      reason: 'Low G-force shocks recorded.',
      evidence: []
    },
    transit_velocity: {
      score: 55,
      reason: 'Slight delay at customs.',
      evidence: []
    },
    sla_compliance: {
      score: 78,
      reason: 'Most contract terms met.',
      evidence: []
    },
    exemption_risk: {
      score: 65,
      reason: 'Customs delay is a valid legal exemption.',
      evidence: []
    },
    loss_mitigation: {
      score: 60,
      reason: 'Minimal biological spoilage predicted.',
      evidence: []
    }
  };

  const confidenceScore = 90;
  const result = ValidationService.calculateFinalScore(dimensions, confidenceScore);

  console.log('\n--- Audit Valuation Results ---');
  console.log(`Final Compliance Score: ${result.finalScore} / 100`);
  console.log(`Verdict: ${result.verdict.toUpperCase()}`);
  console.log('-------------------------\n');

  const baseDir = path.join(process.cwd(), 'memory', 'ideas', 'chainguard-ai-audit-check');
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }

  const reportMd = `# ChainGuard Audit Validation Report\n\nResult: ${result.verdict.toUpperCase()}\nScore: ${result.finalScore}`;
  fs.writeFileSync(path.join(baseDir, 'audit_validation.md'), reportMd);
}

main().catch(err => {
  console.error('Execution failed:', err);
  process.exit(1);
});
