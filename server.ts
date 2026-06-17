import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import OpenAI from "openai";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import ws from "ws";
import { checkIntegrationQuota } from "./src/lib/IntegrationQuota";

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 7860;

// Body parser
app.use(express.json({ limit: "10mb" }));

// Supabase client initialization
const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || "";
const supabase = (supabaseUrl && supabaseAnonKey) ? createClient(supabaseUrl, supabaseAnonKey, {
  realtime: { transport: ws },
}) : null;

// OpenAI / DeepSeek client
const openai = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY || process.env.GEMINI_API_KEY || "DUMMY_KEY",
  baseURL: process.env.DEEPSEEK_API_KEY ? "https://api.deepseek.com" : undefined
});

// CORS Middleware
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, PATCH, DELETE");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-ChainGuard-Api-Key");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") { res.sendStatus(200); return; }
  next();
});

function requireApiKey(req: express.Request, res: express.Response, next: express.NextFunction) {
  const expected = process.env.CHAINGUARD_API_KEY;
  if (!expected) { next(); return; }
  const provided = req.headers["x-chainguard-api-key"];
  if (provided !== expected) {
    res.status(401).json({ error: "Invalid or missing X-ChainGuard-Api-Key." });
    return;
  }
  next();
}

// --- ChainGuard AI 2.0 API Endpoints ---

const webhookTelemetryCache = new Map<string, any[]>();

function sanitizeTelemetry(points: any[]): any[] {
  if (!Array.isArray(points)) return [];
  return points.map((pt, idx) => {
    const sanitized = { ...pt };
    if (sanitized.temperature === undefined || sanitized.temperature === null || isNaN(Number(sanitized.temperature))) {
      sanitized.temperature = 4.0;
    } else {
      const temp = Number(sanitized.temperature);
      if (temp > 80) sanitized.temperature = 80;
      else if (temp < -100) sanitized.temperature = -100;
      else sanitized.temperature = temp;
    }
    if (sanitized.humidity === undefined || sanitized.humidity === null || isNaN(Number(sanitized.humidity))) {
      sanitized.humidity = 70;
    } else {
      sanitized.humidity = Math.max(0, Math.min(100, Number(sanitized.humidity)));
    }
    if (sanitized.shock_g === undefined || sanitized.shock_g === null || isNaN(Number(sanitized.shock_g))) {
      sanitized.shock_g = 0.1;
    } else {
      sanitized.shock_g = Math.max(0, Math.min(25, Number(sanitized.shock_g)));
    }
    return sanitized;
  });
}

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "ChainGuard AI Professional" });
});

// List available contracts
app.get("/api/contracts", (req, res) => {
  try {
    const contractsDir = path.join(process.cwd(), "contracts");
    if (!fs.existsSync(contractsDir)) fs.mkdirSync(contractsDir, { recursive: true });
    const files = fs.readdirSync(contractsDir);
    const pdfFiles = files
      .filter((file) => file.toLowerCase().endsWith(".pdf"))
      .map((file) => ({
        name: file.replace(/_/g, " ").replace(".pdf", ""),
        path: path.join("contracts", file),
        filename: file
      }));
    res.json(pdfFiles);
  } catch (error) {
    res.status(500).json({ error: "Failed to list contract files." });
  }
});

// Upload contract (Base64)
app.post("/api/upload-contract", (req, res) => {
  try {
    const { filename, file_base64 } = req.body;
    const contractsDir = path.join(process.cwd(), "contracts");
    if (!fs.existsSync(contractsDir)) fs.mkdirSync(contractsDir, { recursive: true });

    const cleanName = filename.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    const filePath = path.join(contractsDir, cleanName);
    const buffer = Buffer.from(file_base64, "base64");
    
    fs.writeFileSync(filePath, buffer);
    res.json({ success: true, path: path.join("contracts", cleanName), filename: cleanName });
  } catch (error) {
    res.status(500).json({ error: "Failed to upload contract file." });
  }
});

app.post("/api/webhook/telemetry", (req, res) => {
  try {
    const { shipment_id, telemetry } = req.body;
    if (!shipment_id || !telemetry || !Array.isArray(telemetry)) {
      res.status(400).json({ error: "shipment_id and telemetry (array) are required." });
      return;
    }
    const sanitized = sanitizeTelemetry(telemetry);
    webhookTelemetryCache.set(shipment_id, sanitized);
    res.json({ success: true, count: sanitized.length, shipment_id });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to ingest telemetry via Webhook." });
  }
});

app.get("/api/active-telemetry", (req, res) => {
  try {
    const shipment_id = req.query.shipment_id as string;
    if (!shipment_id) {
      res.status(400).json({ error: "shipment_id query parameter is required." });
      return;
    }
    res.json({ telemetry: webhookTelemetryCache.get(shipment_id) || null });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to retrieve active telemetry." });
  }
});

app.get("/api/eval-results", (req, res) => {
  try {
    const evalPath = path.join(process.cwd(), "evaluation_dashboard.json");
    if (!fs.existsSync(evalPath)) {
      res.json({ error: "No evaluation results found. Please run accuracy tests first." });
      return;
    }
    res.json(JSON.parse(fs.readFileSync(evalPath, "utf-8")));
  } catch (error: any) {
    res.status(500).json({ error: "Failed to read evaluation dashboard." });
  }
});

// Analyze Telemetry - Complex proxy with multipart form data for Python
app.post("/api/analyze-telemetry", async (req, res) => {
  try {
    const {
      cargo_type,
      commercial_value_usd,
      iot_telemetry_history,
      incident_context,
      pdf_path
    } = req.body;

    const contractsDir = path.join(process.cwd(), "contracts");
    let contractPdfPath = pdf_path || path.join(contractsDir, "cherries_sla_agreement.pdf");
    
    if (!fs.existsSync(contractPdfPath)) {
        // Try relative path
        contractPdfPath = path.resolve(process.cwd(), contractPdfPath);
    }

    if (!fs.existsSync(contractPdfPath)) {
        return res.status(404).json({ error: `Contract PDF not found: ${contractPdfPath}` });
    }

    const pdfBuffer = fs.readFileSync(contractPdfPath);
    const pdfBlob = new Blob([pdfBuffer], { type: "application/pdf" });

    const formData = new FormData();
    formData.append("contract_file", pdfBlob, path.basename(contractPdfPath));
    formData.append("telemetry", JSON.stringify(iot_telemetry_history || []));
    formData.append("cargo_type", cargo_type || "Unknown");
    formData.append("commercial_value", String(commercial_value_usd || 0));
    if (incident_context) {
      formData.append("incident_context", incident_context);
    }
    
    // Check if API key exists, if not run in mock mode
    if (!process.env.DEEPSEEK_API_KEY && !process.env.GEMINI_API_KEY) {
      formData.append("mock", "true");
    }

    const response = await fetch("http://localhost:8081/v1/audit", {
      method: "POST",
      body: formData
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(500).json({ error: `FastAPI Failed: ${errText}` });
    }

    const auditResult: any = await response.json();
    
    // Return to frontend in expected format
    res.json({
      ...auditResult.report,
      extracted_terms: auditResult.extracted_terms,
      assessor_output: auditResult.assessor_output,
      legal_output: auditResult.legal_output,
      dispatcher_output: auditResult.dispatcher_output
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// TMS Webhook - Proxy to Python (UI simulator + internal)
app.post("/api/tms/webhook", async (req, res) => {
  try {
    const body = { ...req.body, include_pdf: req.body.include_pdf !== false };
    const response = await fetch("http://localhost:8081/v1/tms/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    res.status(response.ok ? 200 : response.status).json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Integration API - Zapier / Make.com (API key + free tier quotas)
app.post("/api/integrations/audit", requireApiKey, async (req, res) => {
  try {
    const apiKey = (req.headers["x-chainguard-api-key"] as string) || "hf-public";
    const includePdf = req.body.include_pdf === true;

    const quota = checkIntegrationQuota(apiKey, includePdf);
    if (!quota.allowed) {
      res.status(429).json({ error: quota.message, usage: quota.usage });
      return;
    }

    const payload = {
      tms_system: req.body.tms_system || "Zapier",
      event_type: req.body.event_type || "TEMPERATURE_ALERT",
      shipment_id: req.body.shipment_id,
      cargo_type: req.body.cargo_type,
      commercial_value_usd: req.body.commercial_value_usd,
      contract_pdf_path: req.body.contract_pdf_path || "contracts/cherries_sla_agreement.pdf",
      incident_context: req.body.incident_context || "",
      telemetry: req.body.telemetry,
      include_pdf: includePdf,
    };

    const response = await fetch("http://localhost:8081/v1/tms/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    res.status(response.ok ? 200 : response.status).json({ ...result, usage: quota.usage, tier: "free" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/tms/events", async (req, res) => {
  try {
    const response = await fetch("http://localhost:8081/v1/tms/events");
    const result = await response.json();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PDF Generation Proxy
app.post("/api/audit/pdf", async (req, res) => {
  try {
    const response = await fetch("http://localhost:8081/v1/audit/pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body)
    });
    const buffer = await response.arrayBuffer();
    res.setHeader("Content-Type", "application/pdf");
    res.send(Buffer.from(buffer));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/audit/chain", async (req, res) => {
  try {
    const response = await fetch("http://localhost:8081/v1/audit/chain");
    const result = await response.json();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/feedback", async (req, res) => {
  try {
    const response = await fetch("http://localhost:8081/v1/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });
    const result = await response.json();
    res.status(response.ok ? 200 : 500).json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/tms/download-pdf/:shipment_id", async (req, res) => {
  try {
    const { shipment_id } = req.params;
    const response = await fetch(`http://localhost:8081/v1/tms/download-pdf/${encodeURIComponent(shipment_id)}`);
    if (!response.ok) {
      const errText = await response.text();
      res.status(response.status).json({ error: errText });
      return;
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=claim_report_${shipment_id}.pdf`);
    res.send(buffer);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/audit/verify", async (req, res) => {
  try {
    const { file_base64, filename, shipment_id, telemetry, extracted_terms } = req.body;
    if (!file_base64) {
      res.status(400).json({ error: "file_base64 is required." });
      return;
    }
    const pdfBlob = new Blob([Buffer.from(file_base64, "base64")], { type: "application/pdf" });
    const formData = new FormData();
    formData.append("pdf_file", pdfBlob, filename || "report.pdf");
    if (shipment_id) formData.append("shipment_id", shipment_id);
    if (telemetry) formData.append("telemetry", telemetry);
    if (extracted_terms) formData.append("extracted_terms", extracted_terms);

    const response = await fetch("http://localhost:8081/v1/audit/verify", { method: "POST", body: formData });
    if (!response.ok) {
      res.status(500).json({ error: await response.text() });
      return;
    }
    res.json(await response.json());
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/chat-assistant", async (req, res) => {
  try {
    const { messages, shipment_data, analysis_report } = req.body;
    if (!messages || !Array.isArray(messages) || !shipment_data) {
      res.status(400).json({ error: "Missing required chat messages or shipment data." });
      return;
    }

    const shipment_id = shipment_data.shipment_id || "N/A";
    const cargo_type = shipment_data.cargo_type || "N/A";
    const commercial_value = shipment_data.commercial_value_usd || 0;
    const incident_context = shipment_data.incident_context || "N/A";
    const telemetry = shipment_data.iot_telemetry_history || [];

    const systemPrompt = `You are the ChainGuard AI assistant for cold-chain logistics liability.
Shipment: ${shipment_id}, Cargo: ${cargo_type}, Value: $${commercial_value} USD.
Context: ${incident_context}. Telemetry points: ${telemetry.length}.
Report: ${analysis_report ? JSON.stringify(analysis_report) : "Not compiled yet."}
Answer concisely about liability, damage, contract terms, or telemetry.`;

    if (!process.env.DEEPSEEK_API_KEY && !process.env.GEMINI_API_KEY) {
      const query = (messages[messages.length - 1]?.content || "").toLowerCase();
      let reply = `ChainGuard AI advisor for Shipment **${shipment_id}** (${cargo_type}). Ask about liability, damage, contract terms, or telemetry.`;
      if (query.includes("liable") && analysis_report?.liability_assignment) {
        const la = analysis_report.liability_assignment;
        reply = `Primary liability: **${la.liable_party}** at **${la.fault_percentage}%**. Evidence: "${la.evidence_citation}".`;
      }
      res.json({ content: reply });
      return;
    }

    const response = await openai.chat.completions.create({
      model: process.env.DEEPSEEK_API_KEY ? "deepseek-chat" : "gpt-3.5-turbo",
      messages: [{ role: "system", content: systemPrompt }, ...messages],
    });
    res.json({ content: response.choices[0]?.message?.content || "Unable to generate response." });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Static Assets & Runtime Env Injection
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath, { index: false }));
    app.get("*", (req, res) => {
      const indexPath = path.join(distPath, "index.html");
      if (fs.existsSync(indexPath)) {
        let html = fs.readFileSync(indexPath, "utf8");
        const runtimeEnv = {
          VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
          VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY,
          VITE_REQUIRE_AUTH: process.env.VITE_REQUIRE_AUTH ?? "false",
        };
        const envScript = `<script>window.__ENV__ = ${JSON.stringify(runtimeEnv)};</script>`;
        html = html.replace("<head>", `<head>${envScript}`);
        res.send(html);
      } else {
        res.status(404).send("Build not found");
      }
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`ChainGuard AI server running on port ${PORT}`);
  });
}

startServer();
