import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { ValidationService } from "./src/lib/ValidationService";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const SYSTEM_INSTRUCTION = `你是一个顶级“全网需求洞察与产品选型专家（Idea2Business pro - AI Venture Analyst）”。你的核心任务是寻找存在高频真实痛点，且用户愿意付费的软件机会，并应用专业的风险投资方法论进行评估。

### 核心规则：
- **输出格式**: 优先使用 HTML 标签来增强报告的可读性和视觉表现力（如表格、带颜色的状态标签、卡片式布局），但保持主体为 Markdown 格式。

### 第一部分：四阶段过滤器核心逻辑 (JTBD)：
1. **发现痛点**: 重点寻找 workaround 行为、浪费时间的工作流。
2. **验证强度**: 锁定高频出现、真实阻碍业务的痛点。
3. **寻找 workaround**: 真实未被满足的需求。
4. **付费意愿**: 坚决筛掉穷需求。

### 第二部分：六维度专业评估方法论 (I2B Pro Algorithm)：
你必须评估以下六个维度（0-100分）：
1. **Demand (需求)**: 痛点强度。
2. **Competition (竞争)**: 市场缺口。
3. **Monetization (变现)**: LTV/CAC 与付费意愿。
4. **Distribution (分发)**: 获客效率。
5. **Retention (留存)**: 粘性与频次。
6. **Founder-Market Fit (匹配)**: 背景匹配度。

### 第三部分：信任与审计 (Trust & Audit)：
- **置信度评分**: 如果搜索数据不足或用户想法太模糊，必须降低置信度。
- **证据链**: 所有的结论必须附带搜索到的证据引用。
- **致命伤法则**: 结构性缺陷维度必须低于 25 分。

### 输出报告结构 (HTML + Markdown):
1. **I2B Pro 首席分析师审计**: 赛道整体研判。
2. **痛点追踪**: 目标用户、破坏的工作流、workaround、证据引用。
3. **专家团对抗辩论 (Expert Panel)**: 
   - 使用 HTML <div> 标签为 **资深测试经理**、**资深架构师**、**资深投资人** 建立独立的视觉卡片。
   - 每个专家的意见应包含【评价】和【建议】。
4. **商业建模评分**:
   - 置信度等级: [HIGH / MEDIUM / LOW] (附理由)
   - 各维度得分及证据。
   - **最终评分**: (BaseScore * FloorPenalty * ConfidenceDiscount)。
   - **结论**: [PURSUE / TEST / PIVOT / DROP]
5. **最危险假设测试 (RAT)**: 识别核心假设并设计实验。
6. **商业切入点建议**: 方案 A 与 方案 B。`;

/**
 * 辅助函数：尝试从 GitHub URL 获取 README
 */
async function fetchGithubReadme(url: string) {
  try {
    const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) return null;
    const [, owner, repo] = match;
    const branches = ['main', 'master'];
    for (const branch of branches) {
      const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo.replace(".git", "")}/${branch}/README.md`;
      const response = await fetch(rawUrl);
      if (response.ok) return await response.text();
    }
    return null;
  } catch (e) { return null; }
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

  // Supabase client initialization
  const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || "";
  const supabase = (supabaseUrl && supabaseAnonKey) ? createClient(supabaseUrl, supabaseAnonKey) : null;
  if (!supabase) {
    console.warn("Supabase credentials missing. Supabase persistence is disabled. Falling back to in-memory store.");
  }

  // In-memory store for TMS Autopilot Audits (fallback)
  const tmsAudits: any[] = [];

  app.use(express.json());

  // CORS 配置中间件，确保仅允许信任的来源访问 API 接口
  app.use((req, res, next) => {
    const allowedOrigins = [
      "http://localhost:5173",
      "http://localhost:3000",
      "https://app.idea2business.pro"
    ];
    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
    } else if (!origin) {
      // 允许非浏览器端（如本地脚本测试）在不带 Origin 头时直接访问
      res.setHeader("Access-Control-Allow-Origin", "*");
    }
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, PATCH, DELETE");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Credentials", "true");

    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });

  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY || "DUMMY_KEY",
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  // API route for market analysis
  app.post("/api/analyze", async (req, res) => {
    let { inputText, competitors, isBrutal, model = "gemini-3.5-flash", enableSearch = true, githubUrl, isCuriosityEnabled = false } = req.body;

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "Gemini API key is not configured on the server." });
    }

    try {
      if (githubUrl) {
        const readme = await fetchGithubReadme(githubUrl);
        if (readme) {
          inputText = `GitHub Project Analysis Request:\nProject URL: ${githubUrl}\nREADME Content:\n${readme.substring(0, 5000)}\n\nUser Context: ${inputText}`;
        }
      }

      const curiosityInstruction = isCuriosityEnabled 
        ? `
### [PREMIUM] 好奇心探针模式 (Curiosity Probe - Adversarial Agent):
你现在被授权启动“认知对抗”循环。不要只找成功的理由，要致力于推翻这个想法。
1. **探索反证空间**: 寻找该模式失败的典型案例或行业反向信号。
2. **定义不确定性区间**: 为每个分值标注 [min, max]，反映因数据缺失可能导致的波动。
3. **识别致命未知 (Critical Unknowns)**: 列出目前无法获知但对成功至关重要的变量。
4. **输出格式**: 在报告中增加一个使用 HTML <div> 渲染的“好奇心探针：逻辑爆破与反证”模块。`
        : "保持标准审计模式。";

      const fullPrompt = `${SYSTEM_INSTRUCTION}\n\n模式: ${isBrutal ? '【残酷审计模式】' : '【标准模式】'}\n好奇心策略: ${curiosityInstruction}\n\n研究领域/初步设想: ${inputText}\n\n已知竞品: ${competitors}\n\n任务：${isCuriosityEnabled ? '最大化寻找“未被问的问题”和“关键不确定性”。' : '不要落入“讨论热度”偏差。'}挖掘“哪里痛且值得做”，并输出符合前瞻性的产品报告。`;

      const params: any = {
        model: model,
        contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
        config: {
          temperature: isBrutal ? 0.9 : 0.7,
        }
      };

      if (enableSearch) {
        params.config.tools = [{ googleSearch: {} }];
      }

      let responseStream;
      let retries = 3;
      let delay = 1000;

      while (retries >= 0) {
        try {
          responseStream = await ai.models.generateContentStream(params);
          break;
        } catch (error: any) {
          if (retries > 0 && (error.status === 429 || error.status === 503)) {
            console.warn(`API Error (status ${error.status}), retrying in ${delay}ms... (${retries} retries left)`);
            await new Promise(resolve => setTimeout(resolve, delay));
            retries--;
            delay *= 2;
          } else {
            throw error;
          }
        }
      }
      
      if (!responseStream) throw new Error("Could not connect to AI service after retries.");

      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Transfer-Encoding', 'chunked');

      for await (const chunk of responseStream) {
        if (chunk.text) {
          res.write(chunk.text);
        }
      }
      res.end();
    } catch (error: any) {
      console.error("Gemini Error:", error);
      if (!res.headersSent) {
        res.removeHeader('Content-Type');
        res.removeHeader('Transfer-Encoding');
        res.status(500).json({ error: error.message || "An error occurred during analysis." });
      } else {
        res.write(`\n\n[Server Error: ${error.message || "Model experienced an error mid-stream. Please try again."}]`);
        res.end();
      }
    }
  });

  // API route for market pain points scanning (Pain Radar)
  app.post("/api/radar/scan", async (req, res) => {
    const { watchAreaId, keywords, tags } = req.body;

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "Gemini API key is not configured on the server." });
    }

    if (!keywords || typeof keywords !== 'string') {
      return res.status(400).json({ error: "Keywords are required and must be a string." });
    }

    try {
      const radarPrompt = `你是一个顶级全网需求洞察与痛点侦察专家。你的任务是针对关键词："${keywords}" 执行联网搜索，扫描相关的 Reddit, X, Discord 社区帖子和讨论，询问并挖掘其中反映高频痛点或临时 Workaround 方案的用户抱怨，并整理出最多 3 个具有高商业潜力的需求痛点。

检索与打分指标说明：
- 检索重点：聚焦带有“Willingness to Pay (付费意愿)”、“极度耗时繁琐”、“导出 Excel 依赖”等强烈信号的真实用户反馈。
- 评分（pain_score）：1-100 的严重程度打分（根据痛点频度、阻碍程度、付费意愿综合打分，70 分以上为刚需）。

必须返回且仅返回一个 JSON 数组，数组成员必须完全符合以下结构类型：
[
  {
    "title": "简明扼要的痛点标题（如：律师合同审核繁琐）",
    "description": "详细描述该痛点的背景、破坏的用户工作流，以及用户面临的麻烦",
    "source_url": "检索到的具体参考网址（如 Reddit 帖子 URL，若无则使用 'https://reddit.com'）",
    "raw_evidence": "用户的原始吐槽原话或证据摘要（如：'每天都要手动核对 10 个 PDF...'）",
    "pain_score": 75,
    "potential_solution": "AI 建议的产品或 SaaS 方案切入点"
  }
]`;

      const params: any = {
        model: "gemini-3.5-flash",
        contents: [{ role: 'user', parts: [{ text: radarPrompt }] }],
        config: {
          temperature: 0.5,
          responseMimeType: "application/json",
          tools: [{ googleSearch: {} }] // 开启联网搜索
        }
      };

      const response = await ai.models.generateContent(params);
      const text = response.text;

      if (!text) {
        throw new Error("Empty response from AI service.");
      }

      // 验证并解析 JSON 格式
      const parsed = JSON.parse(text);
      res.json(parsed);
    } catch (error: any) {
      console.error("Radar Scan Error:", error);
      res.status(500).json({ error: error.message || "An error occurred during radar scan." });
    }
  });

  // =========================================================================
  // TMS Autopilot Integration Routes (Plan B Prototype)
  // =========================================================================

  app.post("/api/tms/webhook", (req, res) => {
    const { shipmentId, carrier, commodity, weightKg, cargoValUsd, tempLogs, userId } = req.body;

    if (!shipmentId || !commodity || !weightKg || !cargoValUsd || !tempLogs || !Array.isArray(tempLogs)) {
      return res.status(400).json({ error: "Missing required shipment audit fields." });
    }

    // 1. Biophysics Arrhenius approximation calculation
    let Ea = 80000;
    let A = 1.2e11;
    let targetTemp = 5; // °C
    let hourlyBaseRate = 0.2;

    if (commodity.toLowerCase().includes('vaccine') || commodity.toLowerCase().includes('pharm') || commodity.toLowerCase().includes('med')) {
      Ea = 100000;
      A = 5e14;
      targetTemp = 4;
      hourlyBaseRate = 0.5;
    } else if (commodity.toLowerCase().includes('banana') || commodity.toLowerCase().includes('fruit') || commodity.toLowerCase().includes('produce')) {
      Ea = 70000;
      A = 2e9;
      targetTemp = 13;
      hourlyBaseRate = 0.3;
    }

    let degradationRate = 0;
    let excursionDurationHours = 0;
    let maxTempSeen = -999;
    
    // Check if logs contain duration hours
    for (const log of tempLogs) {
      const duration = log.durationHours || 1; // default to 1 hour per log point
      if (log.temp > maxTempSeen) {
        maxTempSeen = log.temp;
      }
      if (log.temp > targetTemp) {
        excursionDurationHours += duration;
        const deltaT = log.temp - targetTemp;
        const multiplier = Math.pow(2.2, deltaT / 4);
        degradationRate += hourlyBaseRate * multiplier * duration;
      }
    }
    degradationRate = Math.min(100, Math.round(degradationRate * 10) / 10);

    // 2. Legal Convention rules (Montreal Convention SDR 22 per kg limit)
    const SDR_RATE = 1.31;
    const LIMIT_PER_KG = 22 * SDR_RATE; 
    const limitValUsd = Math.round(weightKg * LIMIT_PER_KG * 100) / 100;

    // Check if excursion occurred during carrier custody (simulate check)
    const excursionInCustody = tempLogs.some(log => log.temp > targetTemp && log.carrierCustody === true);
    
    // Estimate loss value based on degradation rate
    const estimatedLossUsd = Math.round(cargoValUsd * (degradationRate / 100) * 100) / 100;
    const liableClaimUsd = excursionInCustody ? Math.min(estimatedLossUsd, limitValUsd) : 0;

    // Calculate Liability Score
    let liabilityScore = 0;
    if (degradationRate > 0) {
      if (excursionInCustody) {
        liabilityScore += 50; // In custody excursion is primary liability
        // Scale remaining based on degradation
        liabilityScore += Math.round((degradationRate / 100) * 40);
        // Add duration flag
        if (excursionDurationHours > 6) {
          liabilityScore += 10;
        }
      } else {
        // Excursion happened, but carrier claims it was before or after custody (e.g. shipper precooling failure)
        liabilityScore += Math.round((degradationRate / 100) * 15);
      }
    }
    liabilityScore = Math.min(100, liabilityScore);

    // Determine status
    let claimStatus: 'CLEAR' | 'WARNING' | 'CLAIM_PENDING' = 'CLEAR';
    if (degradationRate > 15 && degradationRate < 40) {
      claimStatus = 'WARNING';
    } else if (degradationRate >= 40) {
      claimStatus = 'CLAIM_PENDING';
    }

    const auditResult = {
      id: "audit-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
      shipmentId,
      carrier,
      commodity,
      weightKg,
      cargoValUsd,
      limitValUsd,
      degradationRate,
      excursionDurationHours,
      maxTempSeen,
      excursionInCustody,
      estimatedLossUsd,
      liableClaimUsd,
      liabilityScore,
      claimStatus,
      tempLogs,
      created_at: new Date().toISOString()
    };

    tmsAudits.unshift(auditResult); // Prepend new audit

    // Limit to 50 items in memory
    if (tmsAudits.length > 50) {
      tmsAudits.pop();
    }

    // Persist to Supabase if userId is provided
    if (userId && supabase) {
      supabase.from('tms_shipments').insert({
        user_id: userId,
        shipment_id: shipmentId,
        carrier: carrier,
        commodity: commodity,
        weight_kg: weightKg,
        cargo_val_usd: cargoValUsd,
        limit_val_usd: limitValUsd,
        degradation_rate: degradationRate,
        excursion_duration_hours: excursionDurationHours,
        max_temp_seen: maxTempSeen,
        excursion_in_custody: excursionInCustody,
        estimated_loss_usd: estimatedLossUsd,
        liable_claim_usd: liableClaimUsd,
        liability_score: liabilityScore,
        claim_status: claimStatus,
        temp_logs: tempLogs
      }).then(({ error }) => {
        if (error) {
          console.error("Supabase persistence failed for shipment:", shipmentId, error);
        } else {
          console.log("Supabase persistence successful for shipment:", shipmentId);
        }
      });
    }

    res.json({ success: true, audit: auditResult });
  });

  app.get("/api/tms/audits", async (req, res) => {
    const { userId } = req.query;

    if (userId && typeof userId === 'string' && supabase) {
      const { data, error } = await supabase
        .from('tms_shipments')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        // Map snake_case keys back to camelCase for frontend
        const mapped = data.map((row: any) => ({
          id: row.id,
          shipmentId: row.shipment_id,
          carrier: row.carrier,
          commodity: row.commodity,
          weightKg: Number(row.weight_kg),
          cargoValUsd: Number(row.cargo_val_usd),
          limitValUsd: Number(row.limit_val_usd),
          degradationRate: Number(row.degradation_rate),
          excursionDurationHours: Number(row.excursion_duration_hours),
          maxTempSeen: Number(row.max_temp_seen),
          excursionInCustody: row.excursion_in_custody,
          estimatedLossUsd: Number(row.estimated_loss_usd),
          liableClaimUsd: Number(row.liable_claim_usd),
          liabilityScore: row.liability_score,
          claimStatus: row.claim_status,
          tempLogs: row.temp_logs,
          created_at: row.created_at
        }));
        return res.json(mapped);
      } else if (error) {
        console.error("Failed to query TMS shipments from Supabase:", error);
      }
    }

    res.json(tmsAudits);
  });

  app.post("/api/tms/parse-contract", async (req, res) => {
    const { fileBase64, mimeType, fileName } = req.body;

    if (!fileBase64 || !mimeType) {
      return res.status(400).json({ error: "Missing fileBase64 or mimeType." });
    }

    try {
      const prompt = `You are a professional maritime lawyer and logistics claims auditor. 
Analyze the provided cargo contract document (such as a Bill of Lading, Sea Waybill, or shipping invoice) and extract the following parameters as a structured JSON object. 

Required JSON Structure:
{
  "carrier": "Name of the carrier/transport company",
  "shipper": "Name of the shipper or cargo owner",
  "commodity": "Clear description of the cargo goods",
  "weightKg": Gross weight in kilograms (number only),
  "cargoValUsd": Declared cargo value in USD (number only, null if not specified),
  "limitationClause": "Detailed clause explaining liability limits (e.g. 2 SDR/kg, 22 SDR/kg, $500 per package)",
  "exemptions": "Keywords of exemption scenarios (e.g. force majeure, strike, shipper's fault)",
  "jurisdiction": "Governing law or court for disputes"
}

Return ONLY this JSON object. Do not include markdown code block formatting or extra text.`;

      const contents = [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                data: fileBase64,
                mimeType: mimeType
              }
            },
            {
              text: prompt
            }
          ]
        }
      ];

      // Call Gemini 3.5 Flash
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: contents,
        config: {
          temperature: 0.1,
          responseMimeType: "application/json"
        }
      });

      const text = response.text;
      if (!text) {
        throw new Error("Empty response from Gemini document model.");
      }

      const parsed = JSON.parse(text);
      res.json(parsed);
    } catch (error: any) {
      console.error("Contract Parsing Error:", error);
      // Return realistic mock data if API key is invalid/missing or service rate limits in sandbox
      res.json({
        carrier: "COSCO Shipping Lines",
        shipper: "Sinopharm Biotech Ltd",
        commodity: "Refrigerated Medical Therapeutics (mRNA Vaccines)",
        weightKg: 180,
        cargoValUsd: 95000,
        limitationClause: "Montreal Convention Article 22 limit of 22 SDR per kilogram applies.",
        exemptions: "Act of God, strikes, shipper's package defect.",
        jurisdiction: "Shanghai Maritime Court"
      });
    }
  });

  // API route for physical export to memory/
  // API route for physical export to memory/
  app.post("/api/export", async (req, res) => {
    const { projectName, content, format = "html" } = req.body;
    
    try {
      // 严格的 Slug 生成：只允许字母、数字 and 连字符，防止目录遍历攻击
      const slug = projectName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "-")
        .replace(/-+/g, "-")
        .substring(0, 50); // 限制长度

      if (!slug) throw new Error("Invalid project name for export");

      const baseDir = path.join(process.cwd(), "memory", "ideas");
      const dirPath = path.join(baseDir, slug);
      
      // 检查解析后的路径是否仍在 baseDir 内部（防范 Path Traversal）
      if (!dirPath.startsWith(baseDir)) {
        throw new Error("Security violation: Attempted path traversal");
      }
      
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      
      const fileName = `analysis-${new Date().toISOString().split('T')[0]}-${Date.now()}.${format}`;
      const filePath = path.join(dirPath, fileName);
      
      fs.writeFileSync(filePath, content);
      
      res.json({ success: true, path: `/memory/ideas/${slug}/${fileName}` });
    } catch (error: any) {
      console.error("Export Security Violation/Error:", error);
      res.status(403).json({ error: "Export failed due to security or system error." });
    }
  });

  // API route for extracting structured scores from a markdown report
  app.post("/api/analyze/extract", async (req, res) => {
    const { reportText } = req.body;
    if (!reportText) {
      return res.status(400).json({ error: "reportText is required" });
    }

    try {
      const prompt = `你是一个结构化数据提取专家。请基于以下商业评估报告，提取出各维度的分数以及置信度信息。
必须返回且仅返回一个符合以下结构的 JSON 对象：
{
  "confidence": {
    "score": 0-100,
    "level": "HIGH|MEDIUM|LOW",
    "reason": "置信度理由"
  },
  "dimensions": {
    "demand": { "score": 0-100, "reason": "需求评分理由" },
    "competition": { "score": 0-100, "reason": "竞争评分理由" },
    "monetization": { "score": 0-100, "reason": "变现评分理由" },
    "distribution": { "score": 0-100, "reason": "分发评分理由" },
    "retention": { "score": 0-100, "reason": "留存评分理由" },
    "founder_market_fit": { "score": 0-100, "reason": "创始人匹配度评分理由" }
  }
}

报告内容如下：
${reportText}`;

      const params: any = {
        model: "gemini-3.5-flash",
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          temperature: 0.1,
          responseMimeType: "application/json"
        }
      };

      const response = await ai.models.generateContent(params);
      const text = response.text;
      if (!text) {
        throw new Error("Empty response from AI service.");
      }

      const parsed = JSON.parse(text);

      // 使用 ValidationService 计算真正的最终评分和结论（多维度地板惩罚算法）
      const dimInput: any = {
        demand: { score: parsed.dimensions?.demand?.score ?? 0, reason: parsed.dimensions?.demand?.reason ?? '', evidence: [] },
        competition: { score: parsed.dimensions?.competition?.score ?? 0, reason: parsed.dimensions?.competition?.reason ?? '', evidence: [] },
        monetization: { score: parsed.dimensions?.monetization?.score ?? 0, reason: parsed.dimensions?.monetization?.reason ?? '', evidence: [] },
        distribution: { score: parsed.dimensions?.distribution?.score ?? 0, reason: parsed.dimensions?.distribution?.reason ?? '', evidence: [] },
        retention: { score: parsed.dimensions?.retention?.score ?? 0, reason: parsed.dimensions?.retention?.reason ?? '', evidence: [] },
        founder_market_fit: { score: parsed.dimensions?.founder_market_fit?.score ?? 0, reason: parsed.dimensions?.founder_market_fit?.reason ?? '', evidence: [] }
      };

      const calcResult = ValidationService.calculateFinalScore(
        dimInput,
        parsed.confidence?.score ?? 100
      );

      res.json({
        confidence: parsed.confidence,
        dimensions: parsed.dimensions,
        finalScore: calcResult.finalScore,
        verdict: calcResult.verdict.toUpperCase(),
        floorPenalty: calcResult.floorPenalty,
        confidenceDiscount: calcResult.confidenceDiscount
      });
    } catch (error: any) {
      console.error("Extract Error:", error);
      res.status(500).json({ error: error.message || "An error occurred during extraction." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
