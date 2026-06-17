import fs from "fs";
import path from "path";
import crypto from "crypto";

interface QuotaRecord {
  month: string;
  audits: number;
  pdfs: number;
}

interface QuotaCheckResult {
  allowed: boolean;
  message?: string;
  usage: { audits: number; audit_limit: number; pdfs: number; pdf_limit: number; tier: string };
}

const QUOTA_FILE = path.join(process.cwd(), "integrations", "quota.json");

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function loadStore(): Record<string, QuotaRecord> {
  try {
    if (fs.existsSync(QUOTA_FILE)) {
      return JSON.parse(fs.readFileSync(QUOTA_FILE, "utf-8"));
    }
  } catch {
    /* ignore corrupt file */
  }
  return {};
}

function saveStore(store: Record<string, QuotaRecord>) {
  const dir = path.dirname(QUOTA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(QUOTA_FILE, JSON.stringify(store, null, 2));
}

function quotaKey(apiKey: string): string {
  const material = apiKey || "hf-public";
  return crypto.createHash("sha256").update(material).digest("hex").slice(0, 16);
}

export function checkIntegrationQuota(apiKey: string, includePdf: boolean): QuotaCheckResult {
  const auditLimit = parseInt(process.env.FREE_MONTHLY_AUDITS || "30", 10);
  const pdfLimit = parseInt(process.env.FREE_MONTHLY_PDFS || "5", 10);
  const month = currentMonth();
  const key = quotaKey(apiKey);

  const store = loadStore();
  const record = store[key]?.month === month ? store[key] : { month, audits: 0, pdfs: 0 };

  const usage = {
    audits: record.audits,
    audit_limit: auditLimit,
    pdfs: record.pdfs,
    pdf_limit: pdfLimit,
    tier: "free",
  };

  if (record.audits >= auditLimit) {
    return {
      allowed: false,
      message: `Monthly audit limit reached (${auditLimit}). Resets next calendar month.`,
      usage,
    };
  }

  if (includePdf && record.pdfs >= pdfLimit) {
    return {
      allowed: false,
      message: `Monthly sealed PDF limit reached (${pdfLimit}). Set include_pdf=false for summary-only audits, or upgrade.`,
      usage,
    };
  }

  record.audits += 1;
  if (includePdf) record.pdfs += 1;
  store[key] = record;
  saveStore(store);

  return {
    allowed: true,
    usage: { ...usage, audits: record.audits, pdfs: record.pdfs },
  };
}
