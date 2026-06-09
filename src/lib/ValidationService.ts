
/**
 * ValidationService.ts - ChainGuard AI Professional Edition
 * 核心功能：基于生物物理退化速率、国际公约合规性、以及多维度责任判定的审计算法。
 */

export interface DimensionScore {
  score: number; // 0-100, 代表合规度/稳定性（分数越低，损坏/过失越严重）
  reason: string;
  uncertaintyRange?: [number, number]; 
  evidence: { text: string; source?: string }[];
}

export interface ValidationContext {
  shipmentId: string;
  commodity: string;
  confidence: {
    score: number;
    level: 'high' | 'medium' | 'low';
    reason: string;
  };
  dimensions: {
    thermal_integrity: DimensionScore;   // 温控完整性（是否维持在 SLA 范围内）
    physical_stability: DimensionScore;  // 物理稳定性（震动、冲击、倾斜）
    transit_velocity: DimensionScore;    // 运输时效（是否在生命周期内到达）
    sla_compliance: DimensionScore;      // 合同合规（是否满足特定 SLA 条款）
    exemption_risk: DimensionScore;      // 法律免责风险（是否存在海关、不可抗力等）
    loss_mitigation: DimensionScore;     // 损毁程度评估
  };
}

export class ValidationService {
  /**
   * 货损定责核心算法：多维度加权地板惩罚
   * 如果温控或物理冲击出现灾难性偏差（低于 25 分），将直接判定为重大过失。
   */
  static calculateFinalScore(dimensions: ValidationContext['dimensions'], confidenceScore: number = 100) {
    const weights = {
      thermal_integrity: 0.30,
      physical_stability: 0.15,
      transit_velocity: 0.15,
      sla_compliance: 0.20,
      exemption_risk: 0.10,
      loss_mitigation: 0.10
    };

    let baseComplianceScore = 0;
    let faultMultiplier = 1.0;

    for (const [key, dim] of Object.entries(dimensions)) {
      const weight = (weights as any)[key];
      baseComplianceScore += dim.score * weight;

      // 重大事故惩罚逻辑
      if (dim.score < 25) {
        faultMultiplier *= (dim.score / 25);
      }
    }

    const confidenceDiscount = confidenceScore / 100;
    const finalScore = Math.round(Math.min(100, Math.max(0, baseComplianceScore * faultMultiplier * confidenceDiscount)));
    
    // 判定结论：CLEAR (正常) | WARNING (异常) | CLAIM_PENDING (建议理赔) | TOTAL_LOSS (推定全损)
    let verdict: 'clear' | 'warning' | 'claim_pending' | 'total_loss' = 'total_loss';
    if (finalScore >= 85) verdict = 'clear';
    else if (finalScore >= 65) verdict = 'warning';
    else if (finalScore >= 40) verdict = 'claim_pending';

    return { finalScore, faultMultiplier, verdict, confidenceDiscount };
  }

  static getExtractionPrompt(shipmentData: string, contractTerms: string) {
    return `
你是一个顶级的全球冷链审计专家，正在使用 ChainGuard AI 系统进行货损判定。
请基于遥测数据和合同条款，输出结构化的 JSON 评估报告。

遥测数据: ${shipmentData}
合同条款: ${contractTerms}

### 评估要求：
1. **置信度评分**: 基于传感器数据的完整性（如有无断流）。
2. **六维度评分 (0-100, 越高代表越合规/健康)**:
   - Thermal Integrity: 温控是否严格执行。
   - Physical Stability: 冲击/G值是否在范围内。
   - Transit Velocity: 是否延误。
   - SLA Compliance: 是否违反了特定的保质期承诺。
   - Exemption Risk: 是否存在合法的免责（如海关查验）。
   - Loss Mitigation: 货物腐败率预测。

### 输出格式 (严格 JSON):
{
  "confidence": { "score": 0-100, "level": "high|medium|low", "reason": "..." },
  "dimensions": {
    "thermal_integrity": {"score": number, "reason": "...", "evidence": []},
    "physical_stability": { ... },
    ...
  },
  "verdict_summary": "一句话定责结论",
  "audit_chain_seal": "基于数据生成的防篡改校验码建议"
}
`;
  }
}
