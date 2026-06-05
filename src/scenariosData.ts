import { ShipmentData } from "./types";

export const SCENARIOS: { [key: string]: { name: string; description: string; data: ShipmentData } } = {
  cherries_customs_delay: {
    name: "Oregon Sweet Cherries (Seattle Port Delay)",
    description: "Reefer power unplugged on customs dock during import processing. High-temperature microbial spoilage.",
    data: {
      shipment_id: "CG-2026-CH-9182",
      cargo_type: "Organic Sweet Rainier Cherries",
      commercial_value_usd: 85000,
      carrier_contract_terms: "Reefer holds must maintain -0.5°C to 1.5°C. Carrier responsibility ceases upon delivery to Customs Inspection Zone. Port Authority assume care-custody-control after gating in.",
      incident_context: "Customs paperwork mismatch held container CG-2026-CH-9182 on the tarmac for 14 hours during 28°C summer heat. Port operations failed to connect auxiliary power cord.",
      iot_telemetry_history: [
        { timestamp: "10:00 AM", temperature: 0.8, humidity: 88, shock_g: 0.1 },
        { timestamp: "11:00 AM", temperature: 1.0, humidity: 87, shock_g: 0.2 },
        { timestamp: "12:00 PM", temperature: 1.2, humidity: 88, shock_g: 0.1 },
        { timestamp: "01:00 PM", temperature: 5.4, humidity: 82, shock_g: 0.3 }, // gated into Customs, power cut
        { timestamp: "02:00 PM", temperature: 11.2, humidity: 76, shock_g: 0.1 }, // > 10°C
        { timestamp: "03:00 PM", temperature: 14.5, humidity: 74, shock_g: 0.2 },
        { timestamp: "04:00 PM", temperature: 16.8, humidity: 72, shock_g: 0.1 }, // > 15°C
        { timestamp: "05:00 PM", temperature: 18.2, humidity: 71, shock_g: 0.1 },
        { timestamp: "06:00 PM", temperature: 19.5, humidity: 70, shock_g: 0.1 },
        { timestamp: "07:00 PM", temperature: 20.1, humidity: 69, shock_g: 0.2 }, // > 6h above 15°C
        { timestamp: "08:00 PM", temperature: 20.4, humidity: 69, shock_g: 0.1 },
        { timestamp: "09:00 PM", temperature: 21.0, humidity: 68, shock_g: 0.1 },
        { timestamp: "10:00 PM", temperature: 21.3, humidity: 68, shock_g: 0.1 },
        { timestamp: "11:00 PM", temperature: 19.8, humidity: 70, shock_g: 0.2 },
        { timestamp: "12:00 AM", temperature: 14.2, humidity: 78, shock_g: 0.1 } // power reconnected
      ]
    }
  },
  biopharma_reefer_failure: {
    name: "Bio-Pharma mRNA Vaccine (Mid-Atlantic transit)",
    description: "Compressor motor breakdown during ocean freight. Temperature rose to room temperature, denaturing the biological assets.",
    data: {
      shipment_id: "CG-2026-BP-0043",
      cargo_type: "SARS-CoV-2 mRNA Concentrates (Ultra-cold)",
      commercial_value_usd: 650000,
      carrier_contract_terms: "Strict medical cold chain. Storage must stay within -80°C to -15°C limit in dry-ice containers, or active reefers must hold 2.0°C to 8.0°C depending on package variant. Any deviation > 25°C for > 15 min or freezing below 0°C incurs total loss.",
      incident_context: "Reefer vessel generator fluctuated at Sea. Container compressor shutdown for 8 hours under carrier's absolute care, followed by an over-correction sub-zero freeze event to -2°C.",
      iot_telemetry_history: [
        { timestamp: "08:00 AM", temperature: 4.2, humidity: 55, shock_g: 0.3 },
        { timestamp: "09:00 AM", temperature: 4.5, humidity: 54, shock_g: 0.2 },
        { timestamp: "10:00 AM", temperature: 9.8, humidity: 55, shock_g: 0.4 }, // failing
        { timestamp: "11:00 AM", temperature: 15.3, humidity: 57, shock_g: 0.2 },
        { timestamp: "12:00 PM", temperature: 22.1, humidity: 60, shock_g: 0.1 },
        { timestamp: "01:00 PM", temperature: 26.4, humidity: 62, shock_g: 0.2 }, // Spikes > 25°C - Denaturing initiated!
        { timestamp: "02:00 PM", temperature: 27.2, humidity: 61, shock_g: 0.3 },
        { timestamp: "03:00 PM", temperature: 25.8, humidity: 60, shock_g: 0.1 },
        { timestamp: "04:00 PM", temperature: 14.2, humidity: 58, shock_g: 0.2 }, // Over-corrected chilling
        { timestamp: "05:00 PM", temperature: 1.0, humidity: 56, shock_g: 0.2 },
        { timestamp: "06:00 PM", temperature: -2.4, humidity: 52, shock_g: 0.1 }, // Frozen crystal structure failure
        { timestamp: "07:00 PM", temperature: 4.0, humidity: 54, shock_g: 0.2 }
      ]
    }
  },
  wine_handling_error: {
    name: "Grand Cru Burgundy Wine (Customs Gate Drop)",
    description: "Heavy-impact mechanical drop combined with high solar radiative heating, resulting in cork leaks.",
    data: {
      shipment_id: "CG-2026-WN-7711",
      cargo_type: "2018 Romanée-Conti Grand Cru Cases",
      commercial_value_usd: 240000,
      carrier_contract_terms: "Store between 10.0°C and 16.0°C. Shocks must never exceed 2.0G to avoid fracturing fine glass and causing bottle agitations.",
      incident_context: "Stevedores at Port of Rotterdam dropped crate from height of 1.2 meters. Container was then parked on dock exposed to direct sunlight for 6 hours without active ventilation.",
      iot_telemetry_history: [
        { timestamp: "02:00 AM", temperature: 14.0, humidity: 65, shock_g: 0.2 },
        { timestamp: "04:00 AM", temperature: 14.2, humidity: 64, shock_g: 0.3 },
        { timestamp: "06:00 AM", temperature: 14.1, humidity: 65, shock_g: 0.1 },
        { timestamp: "08:00 AM", temperature: 14.4, humidity: 66, shock_g: 0.2 },
        { timestamp: "10:00 AM", temperature: 14.5, humidity: 65, shock_g: 4.8 }, // Drop shock event - 4.8G!
        { timestamp: "12:00 PM", temperature: 24.1, humidity: 55, shock_g: 0.4 }, // parked in sun
        { timestamp: "02:00 PM", temperature: 29.8, humidity: 48, shock_g: 0.2 }, // > 28°C cork pushing
        { timestamp: "04:00 PM", temperature: 31.2, humidity: 44, shock_g: 0.1 },
        { timestamp: "06:00 PM", temperature: 25.4, humidity: 50, shock_g: 0.3 },
        { timestamp: "08:00 PM", temperature: 16.2, humidity: 60, shock_g: 0.2 }
      ]
    }
  },
  perfect_salmon_transit: {
    name: "Premium Atlantic Salmon (Cold Chain Perfect)",
    description: "Flawless ocean voyage. Temperature maintained at exactly the freezing boundary with zero mechanical shock.",
    data: {
      shipment_id: "CG-2026-SL-1110",
      cargo_type: "Fresh Atlantic Atlantic Salmon Fillets",
      commercial_value_usd: 45000,
      carrier_contract_terms: "Strict sub-freezing fresh state (-1.5°C to 1.5°C). Safe limit must not exceed 4.0°C to preserve cellular structure and hygiene.",
      incident_context: "Perfect transit. All logistics legs complied carefully with pre-cooling instructions. No customs delays.",
      iot_telemetry_history: [
        { timestamp: "01:00 PM", temperature: -0.5, humidity: 85, shock_g: 0.1 },
        { timestamp: "03:00 PM", temperature: -0.4, humidity: 84, shock_g: 0.1 },
        { timestamp: "05:00 PM", temperature: -0.3, humidity: 85, shock_g: 0.2 },
        { timestamp: "07:00 PM", temperature: 0.0, humidity: 86, shock_g: 0.1 },
        { timestamp: "09:00 PM", temperature: 0.1, humidity: 85, shock_g: 0.1 },
        { timestamp: "11:00 PM", temperature: -0.2, humidity: 84, shock_g: 0.2 },
        { timestamp: "01:00 AM", temperature: -0.4, humidity: 83, shock_g: 0.1 },
        { timestamp: "03:00 AM", temperature: -0.5, humidity: 85, shock_g: 0.1 },
        { timestamp: "05:00 AM", temperature: -0.5, humidity: 86, shock_g: 0.1 }
      ]
    }
  }
};
