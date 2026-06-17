---
title: ChainGuard AI
emoji: 🛡️
colorFrom: indigo
colorTo: blue
sdk: docker
app_port: 7860
pinned: false
---

# ChainGuard AI — Cold Chain Claim Evidence API

> **Not a licensed surveyor.** ChainGuard compiles first-party IoT data and contract terms into structured claim evidence for settlement negotiation.

This deployment powers the **Zapier / Make.com integration** and provides an interactive demo UI.

**Live API base URL:** `https://lixiaowww-chainguard-ai.hf.space`

---

## Quick Start (Zapier)

1. Install the **ChainGuard AI** Zapier app (see `integrations/zapier/`)
2. Connect with:
   - **Base URL:** `https://lixiaowww-chainguard-ai.hf.space`
   - **API Key:** your `CHAINGUARD_API_KEY` (set in Space Secrets below)
3. Create a Zap:

```
IoT Webhook / Google Sheets row
    → ChainGuard: Run Cold Chain Cargo Audit
    → Slack / Gmail (liable_party, estimated_loss_usd, evidence_citation)
```

### Free Tier

| Feature | Limit |
|---------|-------|
| Summary audits (JSON) | 30 / month |
| Sealed PDF reports | 5 / month |

Summary mode returns liability party, fault %, loss estimate, and evidence citation — no PDF generated.

---

## API Reference

### `POST /api/integrations/audit`

Requires header: `X-ChainGuard-Api-Key`

```json
{
  "shipment_id": "SH-2026-001",
  "cargo_type": "Frozen Atlantic Salmon",
  "commercial_value_usd": 45000,
  "contract_pdf_path": "contracts/cherries_sla_agreement.pdf",
  "incident_context": "Temperature spike during carrier custody",
  "telemetry": [
    { "timestamp": "2026-06-05T10:00:00Z", "temperature": 8.5, "carrier_custody": true }
  ],
  "include_pdf": false
}
```

**Response fields:** `liable_party`, `fault_percentage`, `estimated_loss_usd`, `damage_status`, `evidence_citation`, `pdf_download_url` (if `include_pdf: true`), `usage`

---

## Interactive Demo

Open this Space URL to test 3 built-in scenarios (cherries, pharma, wine) in the browser UI.

1. Select a scenario → **Compile Compliance & Liability Assessment**
2. Download PDF → Verify in the Verification tab

---

## Space Secrets (Settings)

| Secret | Required | Purpose |
|--------|----------|---------|
| `CHAINGUARD_API_KEY` | Yes (for Zapier) | Secures `/api/integrations/audit` |
| `GEMINI_API_KEY` | Recommended | Multi-agent liability debate |
| `FREE_MONTHLY_AUDITS` | Optional | Default `30` |
| `FREE_MONTHLY_PDFS` | Optional | Default `5` |

---

## Architecture

React UI + Express gateway (port 7860) → FastAPI audit engine (port 8081)

Full docs: [GitHub](https://github.com/lixiaowww/chainguard-ai) · Zapier: `integrations/zapier/README.md`
