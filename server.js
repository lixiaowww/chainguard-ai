import express from "express";
import path from "path";
import fs from "fs";
import { execFile } from "child_process";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
dotenv.config();
const app = express();
const PORT = 3e3;
app.use(express.json({ limit: "10mb" }));
let aiClient = null;
function getAiClient() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is missing. Please configure it in your Secrets configuration.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
  }
  return aiClient;
}
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: (/* @__PURE__ */ new Date()).toISOString() });
});
app.get("/api/contracts", (req, res) => {
  try {
    const contractsDir = path.join(process.cwd(), "contracts");
    if (!fs.existsSync(contractsDir)) {
      fs.mkdirSync(contractsDir, { recursive: true });
    }
    const files = fs.readdirSync(contractsDir);
    const pdfFiles = files.filter((file) => file.toLowerCase().endsWith(".pdf")).map((file) => ({
      name: file.replace(/_/g, " ").replace(".pdf", ""),
      path: path.join("contracts", file),
      filename: file
    }));
    res.json(pdfFiles);
  } catch (error) {
    console.error("Error listing contracts:", error);
    res.status(500).json({ error: "Failed to list contract files." });
  }
});
app.post("/api/upload-contract", (req, res) => {
  try {
    const { filename, file_base64 } = req.body;
    if (!filename || !file_base64) {
      res.status(400).json({ error: "Filename and file_base64 are required." });
      return;
    }
    const contractsDir = path.join(process.cwd(), "contracts");
    if (!fs.existsSync(contractsDir)) {
      fs.mkdirSync(contractsDir, { recursive: true });
    }
    const cleanName = filename.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    const filePath = path.join(contractsDir, cleanName);
    const buffer = Buffer.from(file_base64, "base64");
    const MAX_SIZE = 5 * 1024 * 1024;
    if (buffer.length > MAX_SIZE) {
      res.status(400).json({ error: "Security violation: File exceeds maximum allowed size of 5MB." });
      return;
    }
    if (buffer.length < 4 || buffer.readUInt32BE(0) !== 626017350) {
      res.status(400).json({ error: "Security violation: Invalid file header. Document is not a valid PDF." });
      return;
    }
    const fileContentStr = buffer.toString("binary");
    const maliciousKeywords = ["/JS", "/JavaScript", "/Launch", "/EmbeddedFiles"];
    const foundKeywords = maliciousKeywords.filter((kw) => fileContentStr.includes(kw));
    if (foundKeywords.length > 0) {
      res.status(400).json({
        error: `Security violation: Document failed malicious script screening. Found directives: ${foundKeywords.join(", ")}`
      });
      return;
    }
    fs.writeFileSync(filePath, buffer);
    console.log(`Saved uploaded contract PDF to ${filePath}`);
    res.json({
      success: true,
      name: cleanName.replace(/_/g, " ").replace(".pdf", ""),
      path: path.join("contracts", cleanName),
      filename: cleanName
    });
  } catch (error) {
    console.error("Error uploading contract:", error);
    res.status(500).json({ error: "Failed to upload contract file." });
  }
});
const webhookTelemetryCache = /* @__PURE__ */ new Map();
app.post("/api/webhook/telemetry", (req, res) => {
  try {
    const { shipment_id, telemetry } = req.body;
    if (!shipment_id || !telemetry || !Array.isArray(telemetry)) {
      res.status(400).json({ error: "shipment_id and telemetry (array) are required." });
      return;
    }
    const sanitized = sanitizeTelemetry(telemetry);
    webhookTelemetryCache.set(shipment_id, sanitized);
    console.log(`[Webhook Ingestion] Stored ${sanitized.length} sanitized points for Shipment ID: ${shipment_id}`);
    res.json({ success: true, count: sanitized.length, shipment_id });
  } catch (error) {
    console.error("Webhook Ingestion Error:", error);
    res.status(500).json({ error: "Failed to ingest telemetry via Webhook." });
  }
});
app.get("/api/active-telemetry", (req, res) => {
  try {
    const shipment_id = req.query.shipment_id;
    if (!shipment_id) {
      res.status(400).json({ error: "shipment_id query parameter is required." });
      return;
    }
    const telemetry = webhookTelemetryCache.get(shipment_id) || null;
    res.json({ telemetry });
  } catch (error) {
    console.error("Active telemetry fetch error:", error);
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
    const data = JSON.parse(fs.readFileSync(evalPath, "utf-8"));
    res.json(data);
  } catch (error) {
    console.error("Error reading evaluation dashboard:", error);
    res.status(500).json({ error: "Failed to read evaluation dashboard." });
  }
});
function maskSensitiveData(text) {
  if (!text) return "";
  let masked = text.replace(/([a-zA-Z0-9_\-\.]+)@([a-zA-Z0-9_\-\.]+)\.([a-zA-Z]{2,5})/g, (match, emailUser, emailDomain, emailExt) => {
    return emailUser[0] + "***" + emailUser[emailUser.length - 1] + "@" + emailDomain + "." + emailExt;
  });
  masked = masked.replace(/(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, "[PHONE_MASKED]");
  return masked;
}
function sanitizeTelemetry(points) {
  if (!Array.isArray(points)) return [];
  return points.map((pt, idx) => {
    const sanitized = { ...pt };
    if (sanitized.temperature === void 0 || sanitized.temperature === null || isNaN(Number(sanitized.temperature))) {
      sanitized.temperature = 4;
    } else {
      const temp = Number(sanitized.temperature);
      if (temp > 80) {
        sanitized.temperature = 80;
        console.warn(`Harness Ingestion Sanitizer: Clamped outlier temp ${temp}\xB0C to 80\xB0C at index ${idx}`);
      } else if (temp < -100) {
        sanitized.temperature = -100;
        console.warn(`Harness Ingestion Sanitizer: Clamped outlier temp ${temp}\xB0C to -100\xB0C at index ${idx}`);
      } else {
        sanitized.temperature = temp;
      }
    }
    if (sanitized.humidity === void 0 || sanitized.humidity === null || isNaN(Number(sanitized.humidity))) {
      sanitized.humidity = 70;
    } else {
      const hum = Number(sanitized.humidity);
      sanitized.humidity = Math.max(0, Math.min(100, hum));
    }
    if (sanitized.shock_g === void 0 || sanitized.shock_g === null || isNaN(Number(sanitized.shock_g))) {
      sanitized.shock_g = 0.1;
    } else {
      const shock = Number(sanitized.shock_g);
      sanitized.shock_g = Math.max(0, Math.min(25, shock));
    }
    return sanitized;
  });
}
function applyOutputGuardrails(parsedReport, commercialValueUsd) {
  if (!parsedReport) return parsedReport;
  const declaredVal = Number(commercialValueUsd || 0);
  if (parsedReport.damage_assessment) {
    const damage = parsedReport.damage_assessment;
    if (damage.estimated_loss_usd > declaredVal) {
      console.warn(`Harness guardrail: Clamped estimated loss of $${damage.estimated_loss_usd} to declared commercial value $${declaredVal}`);
      damage.estimated_loss_usd = declaredVal;
    }
  }
  return parsedReport;
}
app.post("/api/analyze-telemetry", async (req, res) => {
  try {
    const {
      shipment_id,
      cargo_type,
      commercial_value_usd,
      iot_telemetry_history,
      incident_context,
      pdf_path
    } = req.body;
    if (!cargo_type || !iot_telemetry_history || !Array.isArray(iot_telemetry_history)) {
      res.status(400).json({ error: "Missing required shipment data or telemetry history." });
      return;
    }
    const sanitizedTelemetry = sanitizeTelemetry(iot_telemetry_history);
    const maskedIncidentContext = maskSensitiveData(incident_context || "");
    let contractPdfPath = pdf_path;
    if (!contractPdfPath) {
      const contractsDir = path.join(process.cwd(), "contracts");
      const defaultPath = path.join(contractsDir, "cherries_sla_agreement.pdf");
      if (fs.existsSync(defaultPath)) {
        contractPdfPath = "contracts/cherries_sla_agreement.pdf";
      } else {
        res.status(400).json({ error: "No contract PDF available. Please generate sample contracts first." });
        return;
      }
    }
    const pythonPath = path.join(process.cwd(), "venv", "bin", "python3");
    const scriptPath = path.join(process.cwd(), "crew_orchestrator.py");
    const args = [
      scriptPath,
      "--pdf_path",
      contractPdfPath,
      "--cargo_type",
      cargo_type,
      "--commercial_value",
      String(commercial_value_usd || 0),
      "--incident_context",
      maskedIncidentContext,
      "--telemetry_json",
      JSON.stringify(sanitizedTelemetry)
    ];
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.log("No GEMINI_API_KEY found, running Python CrewAI Orchestrator in MOCK mode.");
      args.push("--mock");
    } else {
      console.log("GEMINI_API_KEY found, running Python CrewAI Orchestrator with live LLM.");
    }
    const options = {
      cwd: process.cwd(),
      env: {
        ...process.env,
        GEMINI_API_KEY: apiKey
      }
    };
    execFile(pythonPath, args, options, (error, stdout, stderr) => {
      if (error) {
        console.error("Python Orchestrator Error:", error);
        console.error("stderr:", stderr);
        res.status(500).json({
          error: `AI Orchestrator Execution Failed: ${stderr || error.message}`
        });
        return;
      }
      try {
        const jsonStart = stdout.indexOf("{");
        const jsonEnd = stdout.lastIndexOf("}");
        if (jsonStart === -1 || jsonEnd === -1) {
          throw new Error("Could not locate JSON formatting boundaries in Python stdout.");
        }
        const cleanStdout = stdout.substring(jsonStart, jsonEnd + 1);
        const parsedData = JSON.parse(cleanStdout);
        if (parsedData.error) {
          res.status(500).json({ error: parsedData.error });
          return;
        }
        if (parsedData.final_structured_report) {
          parsedData.final_structured_report = applyOutputGuardrails(
            parsedData.final_structured_report,
            Number(commercial_value_usd || 0)
          );
        }
        res.json({
          ...parsedData.final_structured_report,
          extracted_terms: parsedData.extracted_terms,
          assessor_output: parsedData.assessor_output,
          legal_output: parsedData.legal_output,
          dispatcher_output: parsedData.dispatcher_output
        });
      } catch (parseError) {
        console.error("Error parsing Python script stdout:", parseError);
        console.error("Raw stdout was:", stdout);
        res.status(500).json({
          error: `Failed to parse AI output payload: ${parseError.message}`
        });
      }
    });
  } catch (error) {
    console.error("Analysis Endpoint Error:", error);
    res.status(500).json({
      error: error.message || "An error occurred during cold chain liability assessment."
    });
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
    const systemInstruction = `You are the ChainGuard AI interactive assistant, a professional cold-chain logistics, insurance claims, and legal liability advisor.
You are assisting the user who is viewing a specific shipment incident.

Active Shipment Metadata:
- Shipment ID: ${shipment_id}
- Cargo Type: ${cargo_type}
- Commercial Value: $${commercial_value} USD
- Incident Context & Route: ${incident_context}
- Telemetry History: ${JSON.stringify(telemetry)}

Compiled Analysis Report:
${analysis_report ? JSON.stringify(analysis_report) : "Not compiled yet. The user has not run the main compliance assessment yet. Advise them to click 'Compile Compliance & Liability Assessment' if they need biological Arrhenius shelf-life calculations and formal liability allocations."}

Your goals:
1. Provide accurate, helpful answers regarding the current shipment, telemetry data (identify temperature spikes or shock events), and contract terms.
2. If the analysis report is compiled, help them explain the findings (e.g. why a certain party is liable, how the deductible was applied, what exclusions were met).
3. If they ask questions outside this scope, politely steer them back to cargo protection and logistics liability.
Keep responses concise, professional, and well-structured.`;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      const lastUserMsg = messages[messages.length - 1]?.content || "";
      const query = lastUserMsg.toLowerCase();
      let reply = "";
      if (query.includes("liable") || query.includes("responsibility") || query.includes("blame") || query.includes("responsible") || query.includes("\u8C01") || query.includes("\u8D23\u4EFB")) {
        if (analysis_report && analysis_report.liability_assignment) {
          const { liable_party, fault_percentage, evidence_citation } = analysis_report.liability_assignment;
          reply = `Based on the compiled compliance report, the primary liability is assigned to **${liable_party}** with a fault percentage of **${fault_percentage}%**. The evidence cited is: "${evidence_citation}". This was audited by our Liability Legal Officer agent.`;
        } else {
          reply = `The liability has not been formally calculated yet because the compliance report isn't compiled. However, reviewing the telemetry, if the temperature exceeded the contract SLA due to carrier equipment malfunction, the Carrier would typically bear the liability. Please click the "Compile Compliance & Liability Assessment" button to run the CrewAI legal officer.`;
        }
      } else if (query.includes("damage") || query.includes("loss") || query.includes("spoil") || query.includes("worth") || query.includes("value") || query.includes("\u635F\u5931") || query.includes("\u8D54")) {
        if (analysis_report && analysis_report.damage_assessment) {
          const { status, estimated_loss_usd, scientific_reasoning } = analysis_report.damage_assessment;
          reply = `Our Cargo Damage Assessor evaluated the cargo status as **${status}**. The estimated financial loss is **$${estimated_loss_usd.toLocaleString()} USD** out of the declared commercial value of $${commercial_value.toLocaleString()} USD. Scientific reasoning: ${scientific_reasoning}`;
        } else {
          reply = `To calculate the precise biological degradation and financial loss, please compile the report. The Cargo Damage Assessor agent will apply the Arrhenius shelf-life model to the telemetry data (currently ${telemetry.length} logged data points) to check for thermal degradation.`;
        }
      } else if (query.includes("deductible") || query.includes("exclusion") || query.includes("clause") || query.includes("contract") || query.includes("terms") || query.includes("\u5408\u540C") || query.includes("\u514D\u8D54") || query.includes("\u514D\u8D23")) {
        if (analysis_report && analysis_report.extracted_terms) {
          const { deductible, exclusions, liability_limits } = analysis_report.extracted_terms;
          reply = `Here are the active contract terms extracted via LangChain RAG from the PDF:
- **Deductible**: ${deductible || "None"}
- **Exclusions**: ${exclusions || "None"}
- **Liability Limits**: ${liability_limits || "None"}`;
        } else {
          reply = `You have selected the contract file path: \`${req.body.pdf_path || "Default contract"}\`. Once you compile the assessment, our LangChain RAG loader will read the PDF, pull the specific deductible and exclusion clauses, and display them here.`;
        }
      } else if (query.includes("telemetry") || query.includes("temperature") || query.includes("humidity") || query.includes("shock") || query.includes("sensor") || query.includes("\u6E29\u5EA6") || query.includes("\u4F20\u611F\u5668")) {
        const temps = telemetry.map((t) => t.temperature);
        const maxTemp = temps.length > 0 ? Math.max(...temps) : "N/A";
        const shocks = telemetry.map((t) => t.shock_g);
        const maxShock = shocks.length > 0 ? Math.max(...shocks) : "N/A";
        reply = `Analyzing the active IoT telemetry stream:
- **Logged data points**: ${telemetry.length}
- **Peak temperature observed**: ${maxTemp}\xB0C
- **Peak mechanical shock observed**: ${maxShock}G
Temperature fluctuations outside safety boundaries (e.g., above 8\xB0C for cherries, or outside 2-8\xB0C for vaccines) will trigger bio-spoilage alerts. Let me know if you want to inspect a specific timestamp.`;
      } else {
        reply = `Hello! I am the ChainGuard AI virtual advisor. I can see you are reviewing Shipment **${shipment_id}** carrying **${cargo_type}** (valued at $${commercial_value.toLocaleString()} USD). 

You can ask me questions about:
1. **Liability Proportions** (Who is at fault and why?)
2. **Biological Damage** (How did the temperature affect the cargo shelf-life?)
3. **Contract Exclusions** (What deductibles or disclaimers apply?)

*Note: I am currently running in local offline simulation mode. To activate live Gemini responses, please set the \`GEMINI_API_KEY\` in your Secrets/Environment.*`;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
      res.json({ content: reply });
      return;
    }
    const client = getAiClient();
    const contents = messages.map((m) => ({
      role: m.role === "assistant" ? "model" : m.role,
      parts: [{ text: m.content }]
    }));
    const response = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents,
      config: {
        systemInstruction
      }
    });
    res.json({ content: response.text || "I was unable to generate a response. Please try again." });
  } catch (error) {
    console.error("Chat Assistant Endpoint Error:", error);
    res.status(500).json({ error: error.message || "Failed to process chat message." });
  }
});
async function setupServer() {
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting in DEVELOPMENT mode, enabling Vite middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting in PRODUCTION mode, serving static files...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`ChainGuard AI server listening on http://0.0.0.0:${PORT}`);
  });
}
if (process.env.HARNESS_TEST !== "true") {
  setupServer().catch((err) => {
    console.error("Failed to start server", err);
    process.exit(1);
  });
}
export {
  applyOutputGuardrails,
  maskSensitiveData,
  sanitizeTelemetry
};
