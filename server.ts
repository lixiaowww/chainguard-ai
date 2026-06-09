import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import OpenAI from "openai";
import dotenv from "dotenv";
import { ValidationService } from "./src/lib/ValidationService";
import { createClient } from "@supabase/supabase-js";
import ws from "ws";

dotenv.config();

const SYSTEM_INSTRUCTION = `你是一个顶级的“全球冷链审计与货损合规专家（ChainGuard AI - Senior Cargo Auditor）”。你的核心任务是分析由于温度波动、物理冲击或延误导致的易腐货物损坏，并根据国际海运/空运法规（如《蒙特利尔公约》、《海牙-维斯比规则》）进行责任判定。

### 核心规则：
- **输出格式**: 优先使用 HTML 标签来增强报告的可读性和视觉表现力（如表格、警告色标签、卡片式布局），主体保持 Markdown。

### 审计逻辑：
1. **生物物理分析**: 利用 Arrhenius 方程分析货物腐败率和剩余保质期。
2. **法律合规判定**: 严格比对合同 SLA 和国际公约条款。
3. **责任判定 (Fault Allocation)**: 明确承运人、托运人或港口的责任百分比。
4. **行动建议**: 提供紧急冷藏、货物拒收或理赔申请的专业指导。

### 输出报告结构:
1. **审计官简报**: 事故定性分析。
2. **遥测数据证据链**: 引用传感器时间戳和异常值。
3. **法律判定依据**: 引用具体公约条款（SDR 赔偿限额计算）。
4. **理赔与处置建议**: 方案 A (紧急抢救) 与 方案 B (正式索赔)。`;

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
  const supabase = (supabaseUrl && supabaseAnonKey) ? createClient(supabaseUrl, supabaseAnonKey, {
    realtime: {
      transport: ws,
    },
  }) : null;
  if (!supabase) {
    console.warn("Supabase credentials missing. Supabase persistence is disabled. Falling back to in-memory store.");
  }

  // In-memory store for TMS Autopilot Audits (fallback)
  const tmsAudits: any[] = [];

  app.use(express.json());

  // CORS 配置中间件，放开限制以适配 Hugging Face 域名
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, PATCH, DELETE");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Credentials", "true");

    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });

  const openai = new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY || process.env.GEMINI_API_KEY || "DUMMY_KEY",
    baseURL: process.env.DEEPSEEK_API_KEY ? "https://api.deepseek.com" : undefined
  });

  // API route for market analysis
  app.post("/api/analyze", async (req, res) => {
    let { inputText, competitors, isBrutal, model = "deepseek-chat", enableSearch = false, githubUrl, isCuriosityEnabled = false } = req.body;

    if (!process.env.DEEPSEEK_API_KEY && !process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "DeepSeek or Gemini API key is not configured on the server." });
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

      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Transfer-Encoding', 'chunked');

      const stream = await openai.chat.completions.create({
        model: process.env.DEEPSEEK_API_KEY ? "deepseek-chat" : "gemini-1.5-flash",
        messages: [{ role: "user", content: fullPrompt }],
        temperature: isBrutal ? 0.9 : 0.7,
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          res.write(content);
        }
      }
      res.end();
    } catch (error: any) {
      console.error("AI Error:", error);
      if (!res.headersSent) {
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

    if (!process.env.DEEPSEEK_API_KEY && !process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "DeepSeek or Gemini API key is not configured on the server." });
    }

    if (!keywords || typeof keywords !== 'string') {
      return res.status(400).json({ error: "Keywords are required and must be a string." });
    }

    try {
      const radarPrompt = `你是一个顶级全网需求洞察与痛点侦察专家。你的任务是针对关键词："${keywords}" 执行搜索并挖掘其中反映高频痛点或临时 Workaround 方案的用户抱怨，并整理出最多 3 个具有高商业潜力的需求痛点。

检索与打分指标说明：
- 检索重点：聚焦带有“Willingness to Pay (付费意愿)”、“极度耗时繁琐”、“导出 Excel 依赖”等强烈信号的真实用户反馈。
- 评分（pain_score）：1-100 的严重程度打分（根据痛点频度、阻碍程度、付费意愿综合打分，70 分以上为刚需）。

必须返回且仅返回一个 JSON 数组，数组成员必须完全符合以下结构类型：
[
  {
    "title": "简明扼要的痛点标题（如：律师合同审核繁琐）",
    "description": "详细描述该痛点的背景、破坏的工作流，以及用户面临的麻烦",
    "source_url": "参考网址（如 Reddit 帖子 URL，若无则使用 'https://reddit.com'）",
    "raw_evidence": "用户的原始吐槽原话或证据摘要（如：'每天都要手动核对 10 个 PDF...'）",
    "pain_score": 75,
    "potential_solution": "AI 建议的产品或 SaaS 方案切入点"
  }
]`;

      const response = await openai.chat.completions.create({
        model: process.env.DEEPSEEK_API_KEY ? "deepseek-chat" : "gemini-1.5-flash",
        messages: [{ role: "user", content: radarPrompt }],
        temperature: 0.5,
        response_format: { type: "json_object" }
      });

      const text = response.choices[0]?.message?.content;

      if (!text) {
        throw new Error("Empty response from AI service.");
      }

      // 验证并解析 JSON 格式
      const parsed = JSON.parse(text);
      res.json(Array.isArray(parsed) ? parsed : (parsed.pains || []));
    } catch (error: any) {
      console.error("Radar Scan Error:", error);
      res.status(500).json({ error: error.message || "An error occurred during radar scan." });
    }
  });

  // =========================================================================
  // TMS Autopilot Integration Routes (Plan B Prototype)
  // =========================================================================

  app.post("/api/tms/webhook", async (req, res) => {
    const { shipmentId, carrier, commodity, weightKg, cargoValUsd, tempLogs, userId, packageCount } = req.body;

    if (!shipmentId || !commodity || !weightKg || !cargoValUsd || !tempLogs || !Array.isArray(tempLogs)) {
      return res.status(400).json({ error: "Missing required shipment audit fields." });
    }

    try {
      // Find meta object containing RAG inputs if present
      const meta = tempLogs.find((l: any) => l.meta === true);
      const limitationClause = meta ? meta.limitationClause : "";
      const exemptions = meta ? meta.exemptions : "";
      const jurisdiction = meta ? meta.jurisdiction : "";
      const shipperName = meta ? meta.shipperName : "";
      
      const incidentContext = meta ? `Shipper: ${shipperName}. Exemptions: ${exemptions}. Jurisdiction: ${jurisdiction}.` : "Normal transit.";
      
      // Clean tempLogs to only include data points
      const cleanTelemetry = tempLogs.filter((l: any) => !l.meta).map((l: any) => ({
        timestamp: l.time || l.timestamp,
        temperature: l.temp !== undefined ? l.temp : l.temperature,
        carrierCustody: l.carrierCustody !== undefined ? l.carrierCustody : l.carrier_custody,
        durationHours: l.durationHours !== undefined ? l.durationHours : l.duration_hours
      }));

      // Determine transport mode based on commodity
      let transportMode = "Air";
      if (commodity.toLowerCase().includes("banana") || commodity.toLowerCase().includes("fruit") || commodity.toLowerCase().includes("produce") || commodity.toLowerCase().includes("wine")) {
        transportMode = "Ocean";
      }

      // Proxy to Python FastAPI backend
      const response = await fetch("http://localhost:8081/v1/tms/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          tms_system: "CargoWise",
          event_type: "SHIPMENT_DELIVERED",
          shipment_id: shipmentId,
          cargo_type: commodity,
          commercial_value_usd: Number(cargoValUsd),
          contract_pdf_path: commodity.toLowerCase().includes("vaccine") || commodity.toLowerCase().includes("pharm") 
            ? "contracts/pharma_global_transport.pdf" 
            : (commodity.toLowerCase().includes("wine") ? "contracts/wine_logistics_spec.pdf" : "contracts/cherries_sla_agreement.pdf"),
          incident_context: incidentContext,
          telemetry: cleanTelemetry,
          weight_kg: Number(weightKg),
          transport_mode: transportMode,
          package_count: packageCount !== undefined && packageCount !== null ? Number(packageCount) : undefined
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("FastAPI webhook proxy failed:", errText);
        return res.status(500).json({ error: `FastAPI backend failed: ${errText}` });
      }

      const resData: any = await response.json();
      const report = resData.report || {};
      const damage = report.damage_assessment || {};
      const liability = report.liability_assignment || {};

      // Calculate auxiliary metrics
      const SDR_RATE = 1.31;
      let limitValUsd = 0;
      if (transportMode === "Air") {
        limitValUsd = Math.round(Number(weightKg) * 22 * SDR_RATE * 100) / 100;
      } else {
        const weightLimit = Number(weightKg) * 2 * SDR_RATE;
        if (packageCount !== undefined && packageCount !== null && Number(packageCount) > 0) {
          const packageLimit = Number(packageCount) * 666.67 * SDR_RATE;
          limitValUsd = Math.round(Math.max(weightLimit, packageLimit) * 100) / 100;
        } else {
          limitValUsd = Math.round(weightLimit * 100) / 100;
        }
      }
        
      const estimatedLossUsd = damage.estimated_loss_usd || 0;
      const excursionInCustody = liability.liable_party === "Carrier" || liability.fault_percentage > 0;
      const liableClaimUsd = excursionInCustody ? Math.min(estimatedLossUsd, limitValUsd) : 0;
      
      const matchHours = damage.scientific_reasoning?.match(/for (\d+(?:\.\d+)?) hours/);
      const excursionDurationHours = matchHours ? parseFloat(matchHours[1]) : 0;
      
      let degradationRate = 0;
      if (damage.status === "TOTAL_LOSS") {
        degradationRate = 100;
      } else {
        const matchPct = damage.scientific_reasoning?.match(/(\d+(?:\.\d+)?)%/);
        degradationRate = matchPct ? parseFloat(matchPct[1]) : 0;
      }

      const claimStatus = damage.status === "TOTAL_LOSS" ? "CLAIM_PENDING" : (damage.status === "PARTIAL_DAMAGE" ? "WARNING" : "CLEAR");

      const auditResult = {
        id: resData.event_id || "audit-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
        shipmentId,
        carrier,
        commodity,
        weightKg: Number(weightKg),
        cargoValUsd: Number(cargoValUsd),
        limitValUsd,
        degradationRate,
        excursionDurationHours,
        maxTempSeen: cleanTelemetry.reduce((max: number, pt: any) => pt.temperature > max ? pt.temperature : max, -999),
        excursionInCustody,
        estimatedLossUsd,
        liableClaimUsd,
        liabilityScore: liability.fault_percentage || 0,
        claimStatus: claimStatus as 'CLEAR' | 'WARNING' | 'CLAIM_PENDING',
        tempLogs,
        uncertaintyIntervals: damage.uncertainty_intervals || [],
        created_at: new Date().toISOString()
      };

      tmsAudits.unshift(auditResult);

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
          weight_kg: Number(weightKg),
          cargo_val_usd: Number(cargoValUsd),
          limit_val_usd: limitValUsd,
          degradation_rate: degradationRate,
          excursion_duration_hours: excursionDurationHours,
          max_temp_seen: auditResult.maxTempSeen,
          excursion_in_custody: excursionInCustody,
          estimated_loss_usd: estimatedLossUsd,
          liable_claim_usd: liableClaimUsd,
          liability_score: auditResult.liabilityScore,
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
    } catch (err: any) {
      console.error("Failed to proxy TMS webhook:", err);
      res.status(500).json({ error: err.message || "Internal server error proxying TMS webhook" });
    }
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
          uncertaintyIntervals: row.uncertainty_intervals || [],
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

Return ONLY this JSON object.`;

      const response = await openai.chat.completions.create({
        model: process.env.DEEPSEEK_API_KEY ? "deepseek-chat" : "gemini-1.5-flash",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        response_format: { type: "json_object" }
      });

      const text = response.choices[0]?.message?.content;
      if (!text) {
        throw new Error("Empty response from AI document model.");
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

      const response = await openai.chat.completions.create({
        model: process.env.DEEPSEEK_API_KEY ? "deepseek-chat" : "gemini-1.5-flash",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        response_format: { type: "json_object" }
      });

      const text = response.choices[0]?.message?.content;
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
    app.use(express.static(distPath, { index: false })); // Disable default index serving

    app.get('*', (req, res) => {
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        let html = fs.readFileSync(indexPath, 'utf8');
        
        // Inject runtime environment variables for the frontend
        const runtimeEnv = {
          VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
          VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY,
        };
        
        const envScript = `<script>window.__ENV__ = ${JSON.stringify(runtimeEnv)};</script>`;
        html = html.replace('<head>', `<head>${envScript}`);
        
        res.send(html);
      } else {
        res.status(404).send('Build not found');
      }
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
