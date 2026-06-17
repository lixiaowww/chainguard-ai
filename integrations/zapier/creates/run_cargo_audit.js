const CONTRACT_MAP = {
  seafood: 'contracts/cherries_sla_agreement.pdf',
  cherries: 'contracts/cherries_sla_agreement.pdf',
  pharma: 'contracts/pharma_global_transport.pdf',
  wine: 'contracts/wine_logistics_spec.pdf',
};

const sample = {
  shipment_id: 'SH-2026-DEMO001',
  event_id: 'EV-1710000000-DEMO',
  status: 'Completed',
  output_mode: 'summary',
  liable_party: 'Carrier',
  fault_percentage: 85,
  estimated_loss_usd: 48000,
  damage_status: 'PARTIAL_LOSS',
  evidence_citation: 'Temperature exceeded SLA during carrier custody.',
  pdf_download_url: null,
  tier: 'free',
  usage: { audits: 1, audit_limit: 30, pdfs: 0, pdf_limit: 5 },
};

const parseTelemetry = (raw) => {
  if (!raw) return [];
  const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (!Array.isArray(parsed)) {
    throw new Error('telemetry must be a JSON array of sensor readings.');
  }
  return parsed.map((pt) => ({
    timestamp: pt.timestamp || pt.time,
    temperature: pt.temperature ?? pt.temp,
    humidity: pt.humidity ?? 70,
    shock_g: pt.shock_g ?? 0.1,
    carrier_custody: pt.carrier_custody ?? pt.carrierCustody ?? true,
    duration_hours: pt.duration_hours ?? pt.durationHours ?? 1,
  }));
};

const perform = async (z, bundle) => {
  const contractPath = CONTRACT_MAP[bundle.inputData.contract_type] || CONTRACT_MAP.seafood;
  const telemetry = parseTelemetry(bundle.inputData.telemetry_json);
  const includePdf = bundle.inputData.include_pdf === true || bundle.inputData.include_pdf === 'true';

  const payload = {
    tms_system: bundle.inputData.tms_system || 'Zapier',
    event_type: bundle.inputData.event_type || 'TEMPERATURE_ALERT',
    shipment_id: bundle.inputData.shipment_id,
    cargo_type: bundle.inputData.cargo_type,
    commercial_value_usd: Number(bundle.inputData.commercial_value_usd),
    contract_pdf_path: contractPath,
    incident_context: bundle.inputData.incident_context || '',
    telemetry,
    include_pdf: includePdf,
  };

  const response = await z.request({
    method: 'POST',
    url: `${bundle.authData.base_url}/api/integrations/audit`,
    headers: {
      'Content-Type': 'application/json',
      'X-ChainGuard-Api-Key': bundle.authData.api_key,
    },
    body: payload,
  });

  return response.data;
};

module.exports = {
  key: 'run_cargo_audit',
  noun: 'Cargo Audit',
  display: {
    label: 'Run Cold Chain Cargo Audit',
    description:
      'Free summary audit: liability party, loss estimate, and evidence citation from IoT telemetry. Optional sealed PDF (limited free tier).',
  },
  operation: {
    inputFields: [
      { key: 'shipment_id', label: 'Shipment ID', required: true, type: 'string' },
      {
        key: 'cargo_type',
        label: 'Cargo Type',
        required: true,
        type: 'string',
        helpText: 'e.g. Frozen Salmon, Cherries, mRNA Vaccine',
      },
      { key: 'commercial_value_usd', label: 'Commercial Value (USD)', required: true, type: 'number' },
      {
        key: 'contract_type',
        label: 'Contract Template',
        required: true,
        type: 'string',
        choices: {
          seafood: 'Frozen Seafood / Reefer SLA',
          cherries: 'Fresh Produce SLA',
          pharma: 'Pharma Cold Chain',
          wine: 'Wine Logistics',
        },
        default: 'seafood',
      },
      {
        key: 'telemetry_json',
        label: 'IoT Telemetry (JSON Array)',
        required: true,
        type: 'text',
        helpText:
          '[{ "timestamp": "2026-06-05T10:00:00Z", "temperature": -5, "carrier_custody": true }]',
      },
      { key: 'incident_context', label: 'Incident Context', required: false, type: 'text' },
      {
        key: 'include_pdf',
        label: 'Generate Sealed PDF',
        required: false,
        type: 'boolean',
        default: 'false',
        helpText: 'Free tier: 5 sealed PDFs/month. Summary audits are always free (30/month).',
      },
      { key: 'tms_system', label: 'Source System', required: false, type: 'string', default: 'Zapier' },
      { key: 'event_type', label: 'Event Type', required: false, type: 'string', default: 'TEMPERATURE_ALERT' },
    ],
    perform,
    sample,
  },
};
