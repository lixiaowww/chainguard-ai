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

**Title:** Temperature Alert → Cold Chain Liability Audit → Slack

**Description:** When a webhook or spreadsheet row reports a temperature excursion, ChainGuard instantly calculates liable party and estimated loss, then posts to your claims channel.

**Steps:**
1. **Trigger:** Webhooks by Zapier — Catch Hook (from IoT platform)
2. **Action:** ChainGuard AI — Run Cold Chain Cargo Audit
   - Map `shipment_id`, `cargo_type`, `commercial_value_usd`, `telemetry_json`
   - Leave `include_pdf` = false (free summary)
3. **Action:** Slack — Send Channel Message
   ```
   🚨 Cold Chain Alert: {{shipment_id}}
   Liable: {{liable_party}} ({{fault_percentage}}%)
   Est. Loss: ${{estimated_loss_usd}}
   Evidence: {{evidence_citation}}
   ```

---

## Upgrade Path (future paid tier messaging)

| Free | Pro (future) |
|------|----------------|
| 30 summary audits/mo | Unlimited summaries |
| 5 sealed PDFs/mo | Unlimited PDFs + audit chain |
| Community support | Priority + custom contract templates |
