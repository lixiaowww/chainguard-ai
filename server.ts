import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import OpenAI from "openai";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import ws from "ws";

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
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") { res.sendStatus(200); return; }
  next();
});

// --- ChainGuard AI 2.0 API Endpoints ---

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

// TMS Webhook - Proxy to Python
app.post("/api/tms/webhook", async (req, res) => {
  try {
    const response = await fetch("http://localhost:8081/v1/tms/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body)
    });
    const result = await response.json();
    res.json(result);
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
        const runtimeEnv = { VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY };
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
