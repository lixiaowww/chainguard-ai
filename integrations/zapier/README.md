# ChainGuard AI — Zapier Integration

Embed cold-chain liability audits into workflows users already trust (Zapier, Make.com, webhooks).

## Strategy

- **Free summary audits** build habit (30/month)
- **Limited sealed PDFs** (5/month) create natural upgrade moment
- **No direct sales** — distribution via platform marketplace

## Architecture

```
Tive / Sensitech / Google Sheets / Webhook
        ↓
Zapier Trigger
        ↓
ChainGuard Action → POST /api/integrations/audit
        ↓
Slack / Gmail / CRM (liable_party, estimated_loss_usd, evidence_citation)
```

## Server setup (Hugging Face Spaces)

| Variable | Example | Purpose |
|----------|---------|---------|
| `CHAINGUARD_API_KEY` | `cg_live_xxxx` | Required for integration API |
| `GEMINI_API_KEY` | *(optional)* | Live multi-agent debate |
| `FREE_MONTHLY_AUDITS` | `30` | Summary audit quota |
| `FREE_MONTHLY_PDFS` | `5` | Sealed PDF quota |

## Publish to Zapier

```bash
cd integrations/zapier
npm install
npx zapier login
npx zapier register "ChainGuard AI"   # first time only
npx zapier push
```

Marketplace copy: see [MARKETPLACE.md](./MARKETPLACE.md)

## Free vs Paid Output

| `include_pdf` | Output | Quota |
|---------------|--------|-------|
| `false` (default) | JSON summary: liability, loss, evidence | 30/mo |
| `true` | Summary + sealed PDF download URL | 5/mo |

## Featured Zap Template

**Temperature Alert → Audit → Slack**

1. **Trigger:** Webhooks by Zapier — Catch Hook
2. **Action:** ChainGuard — Run Cold Chain Cargo Audit (`include_pdf` = false)
3. **Action:** Slack — Post to `#claims`:
   ```
   🚨 {{shipment_id}} | Liable: {{liable_party}} ({{fault_percentage}}%)
   Loss: ${{estimated_loss_usd}} | {{evidence_citation}}
   ```

## Make.com

```http
POST https://lixiaowww-chainguard-ai.hf.space/api/integrations/audit
X-ChainGuard-Api-Key: {{API_KEY}}
Content-Type: application/json

{
  "shipment_id": "SH-001",
  "cargo_type": "Frozen Salmon",
  "commercial_value_usd": 45000,
  "contract_pdf_path": "contracts/cherries_sla_agreement.pdf",
  "telemetry": [{ "timestamp": "2026-06-05T10:00:00Z", "temperature": 8.5, "carrier_custody": true }],
  "include_pdf": false
}
```

## Telemetry format

```json
[
  {
    "timestamp": "2026-06-05T08:00:00Z",
    "temperature": -5.0,
    "humidity": 75,
    "shock_g": 0.1,
    "carrier_custody": true,
    "duration_hours": 1
  }
]
```

Aliases: `time` → `timestamp`, `temp` → `temperature`, `carrierCustody` → `carrier_custody`.
