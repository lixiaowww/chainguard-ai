export interface TelemetryPoint {
  timestamp: string;
  temperature: number; // °C
  humidity: number; // %
  shock_g: number; // G force
}

export interface ShipmentData {
  shipment_id: string;
  cargo_type: string;
  commercial_value_usd: number;
  carrier_contract_terms: string;
  incident_context: string;
  iot_telemetry_history: TelemetryPoint[];
}

export interface DamageAssessment {
  status: "PARTIAL_DAMAGE" | "TOTAL_LOSS" | "NORMAL";
  estimated_loss_usd: number;
  scientific_reasoning: string;
}

export interface LiabilityAssignment {
  liable_party: "Carrier" | "Shipper" | "Port Authority" | "Force Majeure" | "Shared" | string;
  fault_percentage: number;
  evidence_citation: string;
}

export interface AnalysisReport {
  incident_summary: string;
  damage_assessment: DamageAssessment;
  liability_assignment: LiabilityAssignment;
  action_items: string[];
  extracted_terms?: {
    deductible: string;
    exclusions: string;
    liability_limits: string;
    raw_contract_text?: string;
  };
  assessor_output?: string;
  legal_output?: string;
  dispatcher_output?: string;
}

export interface Contract {
  name: string;
  path: string;
  filename: string;
}

export interface Message {
  role: "user" | "assistant";
  content: string;
}

