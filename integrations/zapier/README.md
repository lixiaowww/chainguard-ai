# ChainGuard AI — Zapier Integration

Embed cold-chain liability audits into workflows users already trust (Zapier, Make.com, webhooks).

---

## ✅ 已完成（无需你操作）

| 项目 | 状态 |
|------|------|
| HF 线上 API + 海鲜解冻定责规则 | ✅ 已部署 |
| Zapier 私有 App（ChainGuard AI） | ✅ 已 push |
| Google Sheets CSV 模板 | `templates/sheets-audit-template.csv` |
| Slack 消息模板 | `templates/slack-message.txt` |
| 字段映射文档 | 见下方 Featured Zap Template |

---

## 👤 只需你完成（约 10 分钟）

无法代你 OAuth 登录 Google / Slack / Zapier，请按顺序操作：

### A. 导入 Google Sheet 模板

1. 打开 [Google Sheets](https://sheets.google.com) → 新建空白表
2. **文件 → 导入 → 上传**，选择仓库内 `integrations/zapier/templates/sheets-audit-template.csv`
3. 保留第 1 行表头；示例在第 2 行；**从第 3 行起填真实运单**

### B. 新建 Zap（3 步）

| # | App | Event |
|---|-----|-------|
| 1 | **Google Sheets** | New Spreadsheet Row → 选你的 Sheet |
| 2 | **ChainGuard AI** | Run Cold Chain Cargo Audit → 每字段映射同名列 |
| 3 | **Slack** 或 **Gmail** | Send Channel Message / Send Email → 正文见 `templates/slack-message.txt` |

**ChainGuard 账户（Step 2）：**

- Base URL: `https://lixiaowww-chainguard-ai.hf.space`
- API Key: 你 `.env` 里的 `CHAINGUARD_API_KEY`

### C. 测试

1. Sheet 里**新增一行**（改 `shipment_id`）
2. Zapier → **Test run**
3. Slack 应收到 `TOTAL_LOSS` / `Carrier` / `$42000`

### D. 关闭旧测试 Zap（可选）

若仍开着 **Schedule → ChainGuard** 的每日演示 Zap，可 **OFF** 掉，避免重复消耗配额。

---

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

## Featured Zap Template (start here)

**Google Sheets New Row → Audit → Slack**

Fastest path for users: paste a shipment row in Sheets, get liability + Slack alert.

### 1. Create the Sheet

Import [templates/sheets-audit-template.csv](./templates/sheets-audit-template.csv) into Google Sheets, or create columns manually:

| Column | Example | ChainGuard field |
|--------|---------|------------------|
| `shipment_id` | `SH-SALMON-7781` | Shipment ID |
| `cargo_type` | `Frozen Atlantic Salmon` | Cargo Type |
| `commercial_value_usd` | `42000` | Commercial Value (USD) |
| `contract_type` | `seafood` | Contract Template (`seafood` / `cherries` / `pharma` / `wine`) |
| `incident_context` | `Reefer compressor fault…` | Incident Context |
| `telemetry_json` | `[{"temperature":5,…}]` | IoT Telemetry (JSON Array) |
| `include_pdf` | `false` | Generate Sealed PDF |

Keep row 1 as headers. Add real shipments from row 2 onward.

### 2. Zap wiring

| Step | App | Event | Map from Sheet |
|------|-----|-------|----------------|
| 1 | Google Sheets | **New Spreadsheet Row** | Select your Sheet + worksheet |
| 2 | ChainGuard AI | **Run Cold Chain Cargo Audit** | Map each column → same-named field |
| 3 | Slack | **Send Channel Message** | Map ChainGuard output (see below) |

**ChainGuard account:** Base URL `https://lixiaowww-chainguard-ai.hf.space`, API Key = your `CHAINGUARD_API_KEY`.

**Slack message template:**

```
🚨 Cold Chain Audit — {{shipment_id}}
Status: {{damage_status}} | Liable: {{liable_party}} ({{fault_percentage}}%)
Loss: ${{estimated_loss_usd}}
Evidence: {{evidence_citation}}
```

Use **Gmail → Send Email** instead of Slack if preferred; map the same ChainGuard output fields.

### 3. Test

1. Add a new row (copy the example row, change `shipment_id`).
2. Zapier → **Test run** or wait for the trigger poll (~1–15 min on free tier).
3. Confirm Slack shows `TOTAL_LOSS` / `Carrier` for the salmon thaw example.

### Advanced: Webhook trigger

For TMS / IoT POST payloads:

1. **Trigger:** Webhooks by Zapier — Catch Hook
2. **Action:** ChainGuard — Run Cold Chain Cargo Audit (`include_pdf` = false)
3. **Action:** Slack — Post to `#claims` (same template as above)

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
