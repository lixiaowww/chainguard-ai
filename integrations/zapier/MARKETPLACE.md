# Zapier Marketplace Listing — ChainGuard AI

Use this copy when publishing via `zapier push` and the Zapier Developer Platform.

---

## App Name

**ChainGuard AI**

## Short Description (80 chars max)

Auto audit reefer claims from IoT data—liability, loss, evidence in 60 seconds.

## Long Description

When a temperature excursion hits your cold-chain shipment, compiling logger data, mapping Hague-Visby or Montreal Convention liability limits, and building a defensible claim package is still mostly manual PDFs and email threads.

**ChainGuard AI** is a free workflow action for Zapier that automates this:

- Ingests raw IoT telemetry (Tive, Sensitech, TempTale CSV/JSON, webhooks, Google Sheets)
- Applies Arrhenius biophysical spoilage modeling
- Assigns liability (Carrier / Port / Shipper) with fault percentage
- Returns structured evidence for Slack, Gmail, or your TMS

**Important:** ChainGuard compiles first-party evidence for settlement negotiation. It is **not** a licensed marine surveyor or insurance adjuster.

### Free Tier (default)
- **30 summary audits/month** — liability party, loss estimate, evidence citation
- **5 sealed PDFs/month** — cryptographically sealed claim reports for carrier submission

### Perfect For
- Boutique freight forwarders handling reefer seafood, produce, and pharma
- SMB importers with first-party temperature loggers
- Ops teams automating post-alert workflows

### Works With
Webhook, Google Sheets, Gmail, Slack, ShipStation, and any app that can pass JSON telemetry.

## Category

Shipping & Logistics

## Intended Audience

SMB logistics teams, freight forwarders, cold-chain importers

## Privacy Policy URL

`https://github.com/lixiaowww/chainguard-ai` (update with dedicated page when available)

## Homepage / Demo

`https://lixiaowww-chainguard-ai.hf.space`

## Authentication Help Text

1. Deploy ChainGuard on Hugging Face Spaces (or self-host)
2. Set `CHAINGUARD_API_KEY` in Space Secrets
3. Enter your Space URL as **Base URL** and the same key as **API Key**

## Search Keywords

cold chain, reefer, cargo claim, temperature excursion, freight claim, IoT logistics, perishable, liability, Hague-Visby, marine cargo

---

## Featured Zap Template (publish in Zapier template gallery)

**Title:** Google Sheet Row → Cold Chain Liability Audit → Slack

**Description:** Add a shipment row to a Google Sheet; ChainGuard assigns liability and posts results to Slack. No IoT integration required—fastest path for SMB forwarders.

**Steps:**
1. **Trigger:** Google Sheets — New Spreadsheet Row (import `templates/sheets-audit-template.csv`)
2. **Action:** ChainGuard AI — Run Cold Chain Cargo Audit (map Sheet columns 1:1)
3. **Action:** Slack — Send Channel Message (copy from `templates/slack-message.txt`)

**Advanced:** Webhooks by Zapier — Catch Hook (IoT / TMS POST)

---

## Upgrade Path (future paid tier messaging)

| Free | Pro (future) |
|------|----------------|
| 30 summary audits/mo | Unlimited summaries |
| 5 sealed PDFs/mo | Unlimited PDFs + audit chain |
| Community support | Priority + custom contract templates |
