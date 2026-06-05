import express from "express";
import path from "path";
import fs from "fs";
import { execFile } from "child_process";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Body parser
app.use(express.json({ limit: "10mb" }));

// Lazy initializer for Google Gen AI client
let aiClient: GoogleGenAI | null = null;
function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is missing. Please configure it in your Secrets configuration.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// Contracts API - List available contract PDF paths
app.get("/api/contracts", (req, res) => {
  try {
    const contractsDir = path.join(process.cwd(), "contracts");
    if (!fs.existsSync(contractsDir)) {
      fs.mkdirSync(contractsDir, { recursive: true });
    }
    const files = fs.readdirSync(contractsDir);
    const pdfFiles = files
      .filter((file) => file.toLowerCase().endsWith(".pdf"))
      .map((file) => ({
        name: file.replace(/_/g, " ").replace(".pdf", ""),
        path: path.join("contracts", file),
        filename: file
      }));
    res.json(pdfFiles);
  } catch (error: any) {
    console.error("Error listing contracts:", error);
    res.status(500).json({ error: "Failed to list contract files." });
  }
});

// Contracts API - Upload a new PDF contract (Base64)
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

    // Clean filename
    const cleanName = filename.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    const filePath = path.join(contractsDir, cleanName);
    const buffer = Buffer.from(file_base64, "base64");
    
    // 1. Size Clamp (5MB)
    const MAX_SIZE = 5 * 1024 * 1024;
    if (buffer.length > MAX_SIZE) {
      res.status(400).json({ error: "Security violation: File exceeds maximum allowed size of 5MB." });
      return;
    }

    // 2. PDF Magic Bytes Validation
    if (buffer.length < 4 || buffer.readUInt32BE(0) !== 0x25504446) {
      res.status(400).json({ error: "Security violation: Invalid file header. Document is not a valid PDF." });
      return;
    }

    // 3. Exploit Keyword Scan
    const fileContentStr = buffer.toString("binary");
    const maliciousKeywords = ["/JS", "/JavaScript", "/Launch", "/EmbeddedFiles"];
    const foundKeywords = maliciousKeywords.filter(kw => fileContentStr.includes(kw));
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
  } catch (error: any) {
    console.error("Error uploading contract:", error);
    res.status(500).json({ error: "Failed to upload contract file." });
  }
});

// In-memory cache for Webhook Telemetry
const webhookTelemetryCache = new Map<string, any[]>();

// Webhook endpoint to post live telemetry from IoT devices
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
  } catch (error: any) {
    console.error("Webhook Ingestion Error:", error);
    res.status(500).json({ error: "Failed to ingest telemetry via Webhook." });
  }
});

// Endpoint to fetch active webhook telemetry updates
app.get("/api/active-telemetry", (req, res) => {
  try {
    const shipment_id = req.query.shipment_id as string;
    if (!shipment_id) {
      res.status(400).json({ error: "shipment_id query parameter is required." });
      return;
    }

    const telemetry = webhookTelemetryCache.get(shipment_id) || null;
    res.json({ telemetry });
  } catch (error: any) {
    console.error("Active telemetry fetch error:", error);
    res.status(500).json({ error: "Failed to retrieve active telemetry." });
  }
});

// Endpoint to fetch CrewAI model evaluation results
app.get("/api/eval-results", (req, res) => {
  try {
    const evalPath = path.join(process.cwd(), "evaluation_dashboard.json");
    if (!fs.existsSync(evalPath)) {
      res.json({ error: "No evaluation results found. Please run accuracy tests first." });
      return;
    }
    const data = JSON.parse(fs.readFileSync(evalPath, "utf-8"));
    res.json(data);
  } catch (error: any) {
    console.error("Error reading evaluation dashboard:", error);
    res.status(500).json({ error: "Failed to read evaluation dashboard." });
  }
});

// Harness Engineering - PII Masking Filter (Guide/Constraint)
export function maskSensitiveData(text: string): string {
  if (!text) return "";
  // Mask emails: john.doe@example.com -> j***e@example.com
  let masked = text.replace(/([a-zA-Z0-9_\-\.]+)@([a-zA-Z0-9_\-\.]+)\.([a-zA-Z]{2,5})/g, (match, emailUser, emailDomain, emailExt) => {
    return emailUser[0] + "***" + emailUser[emailUser.length - 1] + "@" + emailDomain + "." + emailExt;
  });
  // Mask US and international phone numbers
  masked = masked.replace(/(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, "[PHONE_MASKED]");
  return masked;
}

// Harness Engineering - Chaos Ingestion Sanitizer (Sensor/Filter)
export function sanitizeTelemetry(points: any[]): any[] {
  if (!Array.isArray(points)) return [];
  
  return points.map((pt, idx) => {
    const sanitized = { ...pt };
    
    // Validate temperature
    if (sanitized.temperature === undefined || sanitized.temperature === null || isNaN(Number(sanitized.temperature))) {
      sanitized.temperature = 4.0; // default normal fridge temp
    } else {
      const temp = Number(sanitized.temperature);
      if (temp > 80) {
        sanitized.temperature = 80;
        console.warn(`Harness Ingestion Sanitizer: Clamped outlier temp ${temp}°C to 80°C at index ${idx}`);
      } else if (temp < -100) {
        sanitized.temperature = -100;
        console.warn(`Harness Ingestion Sanitizer: Clamped outlier temp ${temp}°C to -100°C at index ${idx}`);
      } else {
        sanitized.temperature = temp;
      }
    }

    // Validate humidity
    if (sanitized.humidity === undefined || sanitized.humidity === null || isNaN(Number(sanitized.humidity))) {
      sanitized.humidity = 70;
    } else {
      const hum = Number(sanitized.humidity);
      sanitized.humidity = Math.max(0, Math.min(100, hum));
    }

    // Validate shock_g
    if (sanitized.shock_g === undefined || sanitized.shock_g === null || isNaN(Number(sanitized.shock_g))) {
      sanitized.shock_g = 0.1;
    } else {
      const shock = Number(sanitized.shock_g);
      sanitized.shock_g = Math.max(0, Math.min(25, shock)); // clamp extreme shock sensor noise
    }

    return sanitized;
  });
}

// Harness Engineering - Output Guardrail
export function applyOutputGuardrails(parsedReport: any, commercialValueUsd: number): any {
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

// Telemetry Analysis API Node - Updated to invoke RAG & CrewAI python orchestrator
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

    // Apply Harness constraints & filters (PII Masking and Ingestion Sanitizing)
    const sanitizedTelemetry = sanitizeTelemetry(iot_telemetry_history);
    const maskedIncidentContext = maskSensitiveData(incident_context || "");

    // Resolve contract PDF path (RAG source)
    let contractPdfPath = pdf_path;
    if (!contractPdfPath) {
      // Fallback to cherries agreement if none selected
      const contractsDir = path.join(process.cwd(), "contracts");
      const defaultPath = path.join(contractsDir, "cherries_sla_agreement.pdf");
      if (fs.existsSync(defaultPath)) {
        contractPdfPath = "contracts/cherries_sla_agreement.pdf";
      } else {
        res.status(400).json({ error: "No contract PDF available. Please generate sample contracts first." });
        return;
      }
    }

    // Read PDF file and construct FormData for the FastAPI microservice call
    const fullPdfPath = path.resolve(process.cwd(), contractPdfPath);
    if (!fs.existsSync(fullPdfPath)) {
      res.status(404).json({ error: `Contract PDF not found at path: ${contractPdfPath}` });
      return;
    }

    const pdfBuffer = fs.readFileSync(fullPdfPath);
    const pdfBlob = new Blob([pdfBuffer], { type: "application/pdf" });

    const formData = new FormData();
    formData.append("contract_file", pdfBlob, path.basename(contractPdfPath));
    formData.append("telemetry", JSON.stringify(sanitizedTelemetry));
    formData.append("cargo_type", cargo_type);
    formData.append("commercial_value", String(commercial_value_usd || 0));
    if (maskedIncidentContext) {
      formData.append("incident_context", maskedIncidentContext);
    }
    
    // Check if API key exists, if not run in mock mode
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      formData.append("mock", "true");
    }

    // Dispatch HTTP call to FastAPI REST server
    const fastApiUrl = "http://localhost:8081/v1/audit";
    console.log(`[Express Proxy] Dispatching audit request to FastAPI on port 8081 for shipment: ${shipment_id || 'unknown'}`);
    
    const response = await fetch(fastApiUrl, {
      method: "POST",
      body: formData
    });

    if (response.status !== 200) {
      const errText = await response.text();
      res.status(500).json({ error: `FastAPI Audit Microservice Failed: ${errText}` });
      return;
    }

    const auditResult = await response.json();
    
    // Harness Engineering - Output Guardrail
    if (auditResult.report) {
      auditResult.report = applyOutputGuardrails(
        auditResult.report,
        Number(commercial_value_usd || 0)
      );
    }

    // Return combined format preserving existing schema + adding agent details
    res.json({
      ...auditResult.report,
      extracted_terms: auditResult.extracted_terms,
      assessor_output: auditResult.assessor_output,
      legal_output: auditResult.legal_output,
      dispatcher_output: auditResult.dispatcher_output
    });

  } catch (error: any) {
    console.error("Analysis Endpoint Proxy Error:", error);
    res.status(500).json({
      error: error.message || "An error occurred during cold chain liability assessment microservice call.",
    });
  }
});

// Feedback Loop API - Save user-corrected case study
app.post("/api/feedback", (req, res) => {
  try {
    const { shipment_id, cargo_type, incident_context, original_report, corrected_liability } = req.body;
    if (!shipment_id || !corrected_liability) {
      res.status(400).json({ error: "shipment_id and corrected_liability are required." });
      return;
    }

    const verifiedDir = path.join(process.cwd(), "verified_cases");
    if (!fs.existsSync(verifiedDir)) {
      fs.mkdirSync(verifiedDir, { recursive: true });
    }

    const caseData = {
      shipment_id,
      cargo_type,
      incident_context,
      original_report,
      corrected_liability,
      timestamp: new Date().toISOString()
    };

    const cleanId = shipment_id.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    const filePath = path.join(verifiedDir, `${cleanId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(caseData, null, 2));

    console.log(`[Feedback Loop] Saved user-corrected case to ${filePath}`);
    res.json({ success: true, path: filePath });
  } catch (error: any) {
    console.error("Feedback Loop Error:", error);
    res.status(500).json({ error: "Failed to store verified case study feedback." });
  }
});

// PDF Generation API - Proxies request to FastAPI ReportLab engine
app.post("/api/audit/pdf", async (req, res) => {
  try {
    const response = await fetch("http://localhost:8081/v1/audit/pdf", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(req.body)
    });

    if (response.status !== 200) {
      const errText = await response.text();
      res.status(500).json({ error: `FastAPI PDF generation failed: ${errText}` });
      return;
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=claim_report_${req.body.shipment_id || "report"}.pdf`);
    res.send(buffer);
  } catch (error: any) {
    console.error("Express PDF Proxy Error:", error);
    res.status(500).json({ error: `Internal Server Error: ${error.message}` });
  }
});

// TMS Integration APIs - Webhook proxy to FastAPI
app.post("/api/tms/webhook", async (req, res) => {
  try {
    const response = await fetch("http://localhost:8081/v1/tms/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(req.body)
    });

    if (response.status !== 200) {
      const errText = await response.text();
      res.status(500).json({ error: `FastAPI TMS Webhook failed: ${errText}` });
      return;
    }

    const result = await response.json();
    res.json(result);
  } catch (error: any) {
    console.error("Express TMS Webhook Proxy Error:", error);
    res.status(500).json({ error: `Internal Server Error: ${error.message}` });
  }
});

app.get("/api/tms/events", async (req, res) => {
  try {
    const response = await fetch("http://localhost:8081/v1/tms/events");
    if (response.status !== 200) {
      const errText = await response.text();
      res.status(500).json({ error: `FastAPI fetch TMS events failed: ${errText}` });
      return;
    }
    const result = await response.json();
    res.json(result);
  } catch (error: any) {
    console.error("Express TMS Events Fetch Error:", error);
    res.status(500).json({ error: `Internal Server Error: ${error.message}` });
  }
});

app.get("/api/tms/download-pdf/:shipment_id", async (req, res) => {
  try {
    const { shipment_id } = req.params;
    const response = await fetch(`http://localhost:8081/v1/tms/download-pdf/${encodeURIComponent(shipment_id)}`);
    if (response.status !== 200) {
      const errText = await response.text();
      res.status(500).json({ error: `FastAPI PDF download failed: ${errText}` });
      return;
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=claim_report_${shipment_id}.pdf`);
    res.send(buffer);
  } catch (error: any) {
    console.error("Express TMS PDF download error:", error);
    res.status(500).json({ error: `Internal Server Error: ${error.message}` });
  }
});

app.get("/api/audit/chain", async (req, res) => {
  try {
    const response = await fetch("http://localhost:8081/v1/audit/chain");
    if (response.status !== 200) {
      const errText = await response.text();
      res.status(500).json({ error: `FastAPI fetch audit chain failed: ${errText}` });
      return;
    }
    const result = await response.json();
    res.json(result);
  } catch (error: any) {
    console.error("Express Audit Chain Proxy Error:", error);
    res.status(500).json({ error: `Internal Server Error: ${error.message}` });
  }
});

app.post("/api/audit/verify", async (req, res) => {
  try {
    const { file_base64, filename, shipment_id, telemetry, extracted_terms } = req.body;
    if (!file_base64) {
      res.status(400).json({ error: "file_base64 is required." });
      return;
    }
    
    const pdfBuffer = Buffer.from(file_base64, "base64");
    const pdfBlob = new Blob([pdfBuffer], { type: "application/pdf" });
    
    const formData = new FormData();
    formData.append("pdf_file", pdfBlob, filename || "report.pdf");
    if (shipment_id) formData.append("shipment_id", shipment_id);
    if (telemetry) formData.append("telemetry", telemetry);
    if (extracted_terms) formData.append("extracted_terms", extracted_terms);
    
    console.log(`[Express Proxy] Forwarding verification request to FastAPI on port 8081...`);
    const response = await fetch("http://localhost:8081/v1/audit/verify", {
      method: "POST",
      body: formData
    });
    
    if (response.status !== 200) {
      const errText = await response.text();
      res.status(500).json({ error: `FastAPI Audit verification failed: ${errText}` });
      return;
    }
    
    const result = await response.json();
    res.json(result);
  } catch (error: any) {
    console.error("Express Audit Verification Proxy Error:", error);
    res.status(500).json({ error: `Internal Server Error: ${error.message}` });
  }
});

// Chat Assistant API Node
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
      // Mock Response Generator when API key is missing
      const lastUserMsg = messages[messages.length - 1]?.content || "";
      const query = lastUserMsg.toLowerCase();
      let reply = "";

      if (query.includes("liable") || query.includes("responsibility") || query.includes("blame") || query.includes("responsible") || query.includes("谁") || query.includes("责任")) {
        if (analysis_report && analysis_report.liability_assignment) {
          const { liable_party, fault_percentage, evidence_citation } = analysis_report.liability_assignment;
          reply = `Based on the compiled compliance report, the primary liability is assigned to **${liable_party}** with a fault percentage of **${fault_percentage}%**. The evidence cited is: "${evidence_citation}". This was audited by our Liability Legal Officer agent.`;
        } else {
          reply = `The liability has not been formally calculated yet because the compliance report isn't compiled. However, reviewing the telemetry, if the temperature exceeded the contract SLA due to carrier equipment malfunction, the Carrier would typically bear the liability. Please click the "Compile Compliance & Liability Assessment" button to run the CrewAI legal officer.`;
        }
      } else if (query.includes("damage") || query.includes("loss") || query.includes("spoil") || query.includes("worth") || query.includes("value") || query.includes("损失") || query.includes("赔")) {
        if (analysis_report && analysis_report.damage_assessment) {
          const { status, estimated_loss_usd, scientific_reasoning } = analysis_report.damage_assessment;
          reply = `Our Cargo Damage Assessor evaluated the cargo status as **${status}**. The estimated financial loss is **$${estimated_loss_usd.toLocaleString()} USD** out of the declared commercial value of $${commercial_value.toLocaleString()} USD. Scientific reasoning: ${scientific_reasoning}`;
        } else {
          reply = `To calculate the precise biological degradation and financial loss, please compile the report. The Cargo Damage Assessor agent will apply the Arrhenius shelf-life model to the telemetry data (currently ${telemetry.length} logged data points) to check for thermal degradation.`;
        }
      } else if (query.includes("deductible") || query.includes("exclusion") || query.includes("clause") || query.includes("contract") || query.includes("terms") || query.includes("合同") || query.includes("免赔") || query.includes("免责")) {
        if (analysis_report && analysis_report.extracted_terms) {
          const { deductible, exclusions, liability_limits } = analysis_report.extracted_terms;
          reply = `Here are the active contract terms extracted via LangChain RAG from the PDF:
- **Deductible**: ${deductible || "None"}
- **Exclusions**: ${exclusions || "None"}
- **Liability Limits**: ${liability_limits || "None"}`;
        } else {
          reply = `You have selected the contract file path: \`${req.body.pdf_path || "Default contract"}\`. Once you compile the assessment, our LangChain RAG loader will read the PDF, pull the specific deductible and exclusion clauses, and display them here.`;
        }
      } else if (query.includes("telemetry") || query.includes("temperature") || query.includes("humidity") || query.includes("shock") || query.includes("sensor") || query.includes("温度") || query.includes("传感器")) {
        const temps = telemetry.map((t: any) => t.temperature);
        const maxTemp = temps.length > 0 ? Math.max(...temps) : "N/A";
        const shocks = telemetry.map((t: any) => t.shock_g);
        const maxShock = shocks.length > 0 ? Math.max(...shocks) : "N/A";
        
        reply = `Analyzing the active IoT telemetry stream:
- **Logged data points**: ${telemetry.length}
- **Peak temperature observed**: ${maxTemp}°C
- **Peak mechanical shock observed**: ${maxShock}G
Temperature fluctuations outside safety boundaries (e.g., above 8°C for cherries, or outside 2-8°C for vaccines) will trigger bio-spoilage alerts. Let me know if you want to inspect a specific timestamp.`;
      } else {
        reply = `Hello! I am the ChainGuard AI virtual advisor. I can see you are reviewing Shipment **${shipment_id}** carrying **${cargo_type}** (valued at $${commercial_value.toLocaleString()} USD). 

You can ask me questions about:
1. **Liability Proportions** (Who is at fault and why?)
2. **Biological Damage** (How did the temperature affect the cargo shelf-life?)
3. **Contract Exclusions** (What deductibles or disclaimers apply?)

*Note: I am currently running in local offline simulation mode. To activate live Gemini responses, please set the \`GEMINI_API_KEY\` in your Secrets/Environment.*`;
      }

      // Add a slight delay to simulate typing
      await new Promise(resolve => setTimeout(resolve, 500));
      res.json({ content: reply });
      return;
    }

    // Live AI Client flow
    const client = getAiClient();
    const contents = messages.map((m: any) => ({
      role: m.role === "assistant" ? "model" : m.role,
      parts: [{ text: m.content }]
    }));

    const response = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents,
      config: {
        systemInstruction,
      }
    });

    res.json({ content: response.text || "I was unable to generate a response. Please try again." });
  } catch (error: any) {
    console.error("Chat Assistant Endpoint Error:", error);
    res.status(500).json({ error: error.message || "Failed to process chat message." });
  }
});

// Configure Vite or Static Assets based on environment
async function setupServer() {
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting in DEVELOPMENT mode, enabling Vite middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
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
