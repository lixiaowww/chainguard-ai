# ChainGuard AI — Zapier Integration

Connect any TMS, IoT platform, or spreadsheet workflow to ChainGuard's cold-chain liability engine.

## Architecture

```
ShipStation / IoT Sensor / Google Sheets
        ↓  (Zapier Trigger: new row, temp alert, shipment delivered)
ChainGuard Action: Run Cold Chain Cargo Audit
        ↓  POST /api/tms/webhook
Liability Report + Sealed PDF
        ↓  (Zapier Action: send email, Slack, update CRM)
Carrier claims team / Shipper inbox
```

## Server prerequisites

Set these environment variables on your ChainGuard deployment (HF Spaces → Settings → Secrets):

| Variable | Example | Purpose |
|----------|---------|---------|
| `APP_URL` | `https://yourname-chainguard-ai.hf.space` | Absolute PDF download links in Zapier output |
| `CHAINGUARD_API_KEY` | `cg_live_xxxx` | Secures `/api/tms/webhook` for external callers |
| `GEMINI_API_KEY` | *(optional)* | Live multi-agent debate; omit for rule-engine mode |

## Zapier Action output fields

| Field | Type | Use in downstream Zaps |
|-------|------|------------------------|
| `shipment_id` | string | CRM / ticket reference |
| `liable_party` | string | Carrier / Port / Shipper |
| `fault_percentage` | number | Liability split |
| `estimated_loss_usd` | number | Claim amount |
| `damage_status` | string | CLEAR / PARTIAL_LOSS / TOTAL_LOSS |
| `pdf_download_url` | string | Attach to email or store in Drive |
| `evidence_citation` | string | Claim letter body |
| `event_id` | string | Audit trail ID |

## Example Zaps

### 1. Temperature alert → auto claim report

- **Trigger**: Webhook from IoT platform (or Google Sheets new row)
- **Action**: ChainGuard — Run Cold Chain Cargo Audit
- **Action**: Gmail — Send email with `pdf_download_url` attachment

### 2. ShipStation shipment delivered → audit

- **Trigger**: ShipStation — New Shipment
- **Action**: ChainGuard — Run Cold Chain Cargo Audit (map tracking # → shipment_id)
- **Action**: Slack — Post `liable_party` + `estimated_loss_usd` to #claims

### 3. Make.com equivalent

Use Make's **HTTP module** with the same payload:

```http
POST {{APP_URL}}/api/tms/webhook
X-ChainGuard-Api-Key: {{API_KEY}}
Content-Type: application/json

{
  "tms_system": "Make",
  "event_type": "TEMPERATURE_ALERT",
  "shipment_id": "SH-001",
  "cargo_type": "Cherries",
  "commercial_value_usd": 48000,
  "contract_pdf_path": "contracts/cherries_sla_agreement.pdf",
  "incident_context": "Customs delay at port",
  "telemetry": [
    { "timestamp": "2026-06-05T10:00:00Z", "temperature": 12.0, "carrier_custody": false, "duration_hours": 4 }
  ]
}
```

## Local development

```bash
cd integrations/zapier
npm install
npx zapier login
npx zapier register "ChainGuard AI"
npx zapier push
```

Test against local server:

```bash
# Terminal 1
python3 api.py

# Terminal 2
CHAINGUARD_API_KEY=test-key APP_URL=http://localhost:7860 npm run dev
```

## Telemetry JSON format

```json
[
  {
    "timestamp": "2026-06-05T08:00:00Z",
    "temperature": 4.2,
    "humidity": 75,
    "shock_g": 0.1,
    "carrier_custody": true,
    "duration_hours": 1
  }
]
```

Aliases accepted: `time` → `timestamp`, `temp` → `temperature`, `carrierCustody` → `carrier_custody`.
