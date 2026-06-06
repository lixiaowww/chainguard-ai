
/**
 * ValidationService.ts
 * 融合了 JTBD 联网搜索能力与 Idea-Validation-Agents 专业评分方法论的核心服务。
 */

export interface DimensionScore {
  score: number;
  reason: string;
  uncertaintyRange?: [number, number]; // [min, max] 代表由于信息缺口导致的分值波动
  evidence: { text: string; source?: string }[];
}

export interface ValidationContext {
  idea: string;
  competitors: string;
  searchData?: any;
  isCuriosityEnabled?: boolean;
  confidence: {
    score: number;
    level: 'high' | 'medium' | 'low';
    reason: string;
  };
  curiosityFindings?: {
    criticalUnknowns: string[];
    failureModes: string[];
    contradictorySignals: string[];
  };
  dimensions: {
    demand: DimensionScore;
    competition: DimensionScore;
    monetization: DimensionScore;
    distribution: DimensionScore;
    retention: DimensionScore;
    founder_market_fit: DimensionScore;
  };
}

export interface RAT {
  assumption: string;
  category: string;
  criticality: number;
  uncertainty: number;
  experiment: {
    type: string;
    description: string;
    pass_threshold: string;
  };
}

export class ValidationService {
  /**
   * 核心算法：乘法地板逻辑 (Multiplicative Floor Algorithm)
   * 任何一个维度低于 25 分都会产生指数级的惩罚。
   */
  static calculateFinalScore(dimensions: ValidationContext['dimensions'], confidenceScore: number = 100) {
    const weights = {
      demand: 0.20,
      competition: 0.10,
      monetization: 0.20,
      distribution: 0.20,
      retention: 0.15,
      founder_market_fit: 0.15
    };

    let baseScore = 0;
    let floorPenalty = 1.0;

    for (const [key, dim] of Object.entries(dimensions)) {
      const weight = (weights as any)[key];
      baseScore += dim.score * weight;

      if (dim.score < 25) {
        floorPenalty *= (dim.score / 25);
      }
    }

    // 置信度对总分的影响：如果置信度极低，最终得分应当被“打折”，以反映数据的不确定性
    const confidenceDiscount = confidenceScore / 100;
    const finalScore = Math.round(Math.min(100, Math.max(0, baseScore * floorPenalty * confidenceDiscount)));
    
    let verdict: 'pursue' | 'test' | 'pivot' | 'drop' = 'drop';
    if (finalScore >= 75) verdict = 'pursue';
    else if (finalScore >= 55) verdict = 'test';
    else if (finalScore >= 35) verdict = 'pivot';

    return { finalScore, floorPenalty, verdict, confidenceDiscount };
  }

  /**
   * 生成系统指令，指导 Gemini 如何从搜索结果中提取这些维度的数据
   */
  static getExtractionPrompt(idea: string, competitors: string) {
    return `
你是一个顶级的风险投资分析师，正在使用 Idea2Business pro 系统进行商业审计。
请基于以下想法和搜索到的信号，输出结构化的 JSON 评估报告。

想法: ${idea}
竞品: ${competitors}

### 评估要求：
1. **置信度评分 (Confidence Score)**: 评估你掌握的信息量。如果搜索结果贫乏或想法太模糊，必须给低分并说明原因。
2. **六维度评分**: Demand, Competition, Monetization, Distribution, Retention, Founder-Market Fit。
3. **证据链 (Evidence Chain)**: 每个维度必须附带具体的证据（用户原话、具体的竞品功能、或搜索到的市场数据）。

### 输出格式 (严格 JSON):
{
  "confidence": {
    "score": 0-100,
    "level": "high|medium|low",
    "reason": "为什么给出这个置信度"
  },
  "dimensions": {
    "demand": {"score": number, "reason": "...", "evidence": [{"text": "...", "source": "..."}]},
    "monetization": { ... },
    ...
  },
  "riskiest_assumption": {
    "assumption": "...",
    "category": "...",
    "criticality": 1-5,
    "uncertainty": 1-5,
    "experiment": { ... }
  }
}
`;
  }
}
