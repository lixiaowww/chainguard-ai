import fs from "fs";
import { maskSensitiveData, sanitizeTelemetry, applyOutputGuardrails } from "./src/lib/HarnessHelper";

interface TestCase {
  name: string;
  fn: () => void | Promise<void>;
}

const tests: TestCase[] = [];

function test(name: string, fn: () => void | Promise<void>) {
  tests.push({ name, fn });
}

function assertEquals(actual: any, expected: any, message?: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Assertion failed: Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}` +
        (message ? ` (${message})` : "")
    );
  }
}

// ==========================================
// 1. PII Masking Tests
// ==========================================

test("maskSensitiveData: should mask email addresses", () => {
  const text = "Please contact support@chainguard.ai or admin@logistic.com for details.";
  const result = maskSensitiveData(text);
  assertEquals(
    result,
    "Please contact s***t@chainguard.ai or a***n@logistic.com for details."
  );
});

test("maskSensitiveData: should mask various phone formats", () => {
  const phone1 = "My phone is 123-456-7890.";
  const phone2 = "Contact +1 (555) 019-2834.";
  const phone3 = "Call 555.019.2834 now.";
  
  assertEquals(maskSensitiveData(phone1), "My phone is [PHONE_MASKED].");
  assertEquals(maskSensitiveData(phone2), "Contact [PHONE_MASKED].");
  assertEquals(maskSensitiveData(phone3), "Call [PHONE_MASKED] now.");
});

test("maskSensitiveData: should not affect safe text", () => {
  const text = "ChainGuard AI is a cold chain analytics platform with 100% security.";
  assertEquals(maskSensitiveData(text), text);
});

// ==========================================
// 2. Ingestion Sanitizer Tests
// ==========================================

test("sanitizeTelemetry: should handle empty and null telemetry history", () => {
  assertEquals(sanitizeTelemetry([]), []);
  
  const badPoints = [
    { timestamp: "2026-05-29T00:00:00Z", temperature: null, humidity: null, shock_g: null }
  ];
  const sanitized = sanitizeTelemetry(badPoints);
  assertEquals(sanitized[0].temperature, 4.0); // Default normal fridge temp
  assertEquals(sanitized[0].humidity, 70); // Default humidity
  assertEquals(sanitized[0].shock_g, 0.1); // Default shock
});

test("sanitizeTelemetry: should clamp outlier temperature limits", () => {
  const points = [
    { timestamp: "T1", temperature: 95.5, humidity: 50, shock_g: 0.2 },
    { timestamp: "T2", temperature: -120.0, humidity: 45, shock_g: 0.1 },
    { timestamp: "T3", temperature: 20.0, humidity: 120.0, shock_g: 30.0 }
  ];
  const sanitized = sanitizeTelemetry(points);
  assertEquals(sanitized[0].temperature, 80.0, "Should clamp temp to 80°C");
  assertEquals(sanitized[1].temperature, -100.0, "Should clamp temp to -100°C");
  assertEquals(sanitized[2].humidity, 100.0, "Should clamp humidity to 100%");
  assertEquals(sanitized[2].shock_g, 25.0, "Should clamp shock to 25.0G");
});

test("sanitizeTelemetry: should leave valid telemetry data unmodified", () => {
  const validPoints = [
    { timestamp: "2026-05-29T00:00:00Z", temperature: 4.5, humidity: 65, shock_g: 0.3 }
  ];
  assertEquals(sanitizeTelemetry(validPoints), validPoints);
});

// ==========================================
// 3. Output Guardrail Tests
// ==========================================

test("applyOutputGuardrails: should clamp estimated loss if it exceeds shipment value", () => {
  const mockReport = {
    damage_assessment: {
      status: "CRITICAL_DAMAGE",
      estimated_loss_usd: 120000,
      scientific_reasoning: "Extreme temperature deviation."
    }
  };
  
  const result = applyOutputGuardrails(mockReport, 100000);
  assertEquals(
    result.damage_assessment.estimated_loss_usd,
    100000,
    "Loss should be clamped to declared commercial value of 100,000"
  );
});

test("applyOutputGuardrails: should not clamp estimated loss if it is below shipment value", () => {
  const mockReport = {
    damage_assessment: {
      status: "PARTIAL_DAMAGE",
      estimated_loss_usd: 45000,
      scientific_reasoning: "Moderate temperature deviation."
    }
  };
  
  const result = applyOutputGuardrails(mockReport, 100000);
  assertEquals(
    result.damage_assessment.estimated_loss_usd,
    45000,
    "Loss should remain unmodified when below commercial value"
  );
});

test("applyOutputGuardrails: should handle empty/malformed report safely", () => {
  assertEquals(applyOutputGuardrails(null, 100), null);
  assertEquals(applyOutputGuardrails({}, 100), {});
});

// ==========================================
// 4. High-Concurrency API Integration Tests
// ==========================================

test("API High-Concurrency: should handle 5 simultaneous audit requests on /v1/audit", async () => {
  const url = "http://localhost:8081/v1/audit";
  
  // Check if server is running, skip if not
  try {
    const health = await fetch("http://localhost:8081/health");
    if (health.status !== 200) throw new Error();
  } catch {
    console.log("⚠️  Skipping API concurrency test: Local FastAPI server is not running on http://localhost:8081");
    return;
  }

  const concurrentRequests = 5;
  const promises = [];
  const pdfBuffer = fs.readFileSync("contracts/cherries_sla_agreement.pdf");

  for (let i = 0; i < concurrentRequests; i++) {
    const formData = new FormData();
    const pdfBlob = new Blob([pdfBuffer], { type: "application/pdf" });
    formData.append("contract_file", pdfBlob, "cherries_sla_agreement.pdf");
    formData.append("cargo_type", "Fresh Cherries");
    formData.append("commercial_value", "80000");
    formData.append("telemetry", JSON.stringify([
      { timestamp: "08:00 AM", temperature: 0.5, humidity: 75, shock_g: 0.1 },
      { timestamp: "12:00 PM", temperature: 1.0, humidity: 74, shock_g: 0.1 }
    ]));
    formData.append("incident_context", "Customs clearance delay of 12 hours.");
    formData.append("mock", "true");

    promises.push(
      fetch(url, {
        method: "POST",
        body: formData,
      }).then(async (res) => {
        if (res.status !== 200) {
          const text = await res.text();
          throw new Error(`Request failed with status ${res.status}: ${text}`);
        }
        const json = await res.json();
        if (!json.success) {
          throw new Error(`API returned success=false: ${JSON.stringify(json)}`);
        }
        // Verify key properties of returned report
        assertEquals(json.report.damage_assessment.status, "PARTIAL_DAMAGE");
        assertEquals(json.report.liability_assignment.liable_party, "Port Authority");
        return json;
      })
    );
  }

  const startTime = Date.now();
  await Promise.all(promises);
  const duration = Date.now() - startTime;
  console.log(`      [Concurrency Test] ${concurrentRequests} requests completed in ${duration}ms (Avg ${Math.round(duration / concurrentRequests)}ms/req)`);
});

// ==========================================
// 5. TMS Webhook & Event Integration Tests
// ==========================================

test("API TMS Webhook: should accept webhook triggers and fetch processed events", async () => {
  const webhookUrl = "http://localhost:8081/v1/tms/webhook";
  const eventsUrl = "http://localhost:8081/v1/tms/events";

  // Check if server is running, skip if not
  try {
    const health = await fetch("http://localhost:8081/health");
    if (health.status !== 200) throw new Error();
  } catch {
    console.log("⚠️  Skipping TMS Webhook test: Local FastAPI server is not running on http://localhost:8081");
    return;
  }

  const payload = {
    tms_system: "CargoWise",
    event_type: "SHIPMENT_DELIVERED",
    shipment_id: "TEST-TMS-9999",
    cargo_type: "Organic Sweet Rainier Cherries",
    commercial_value_usd: 85000,
    contract_pdf_path: "contracts/cherries_sla_agreement.pdf",
    incident_context: "Reefer power cut at gate inspection",
    telemetry: [
      { timestamp: "10:00 AM", temperature: 0.8, humidity: 88, shock_g: 0.1 },
      { timestamp: "11:00 AM", temperature: 1.0, humidity: 87, shock_g: 0.2 }
    ]
  };

  // 1. Post webhook
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  assertEquals(res.status, 200, "Webhook endpoint should return 200 OK");
  const json = await res.json();
  assertEquals(json.success, true, "Webhook result success should be true");
  assertEquals(json.status, "Completed", "Webhook audit status should be Completed");

  // 2. Fetch events list and verify
  const eventsRes = await fetch(eventsUrl);
  assertEquals(eventsRes.status, 200, "Events listing should return 200 OK");
  const events = await eventsRes.json();
  
  // Find the event we just created
  const myEvent = events.find((e: any) => e.shipment_id === "TEST-TMS-9999");
  assertEquals(!!myEvent, true, "Should find the logged event in the events database");
  assertEquals(myEvent.tms_system, "CargoWise", "Logged event should match payload");
  assertEquals(myEvent.cargo_type, "Organic Sweet Rainier Cherries", "Logged cargo type should match payload");
});

// ==========================================
// 6. Cryptographic Verification & Tamper Detection Tests
// ==========================================

test("API Verification: should verify authentic generated PDF and detect tampering", async () => {
  const verifyUrl = "http://localhost:8081/v1/audit/verify";
  
  // Check if server is running, skip if not
  try {
    const health = await fetch("http://localhost:8081/health");
    if (health.status !== 200) throw new Error();
  } catch {
    console.log("⚠️  Skipping API verification test: Local FastAPI server is not running on http://localhost:8081");
    return;
  }

  // 1. Read the claim report PDF generated in the webhook test
  const pdfPath = "tms_claims/claim_report_TEST-TMS-9999.pdf";
  if (!fs.existsSync(pdfPath)) {
    console.log("⚠️  Skipping API verification test: claim_report_TEST-TMS-9999.pdf not found (run webhook test first)");
    return;
  }

  const pdfBuffer = fs.readFileSync(pdfPath);
  const pdfBlob = new Blob([pdfBuffer], { type: "application/pdf" });

  // 2. Post verification request for authentic PDF
  const formData = new FormData();
  formData.append("pdf_file", pdfBlob, "claim_report_TEST-TMS-9999.pdf");
  formData.append("shipment_id", "TEST-TMS-9999");
  formData.append("telemetry", JSON.stringify([
    { timestamp: "10:00 AM", temperature: 0.8, humidity: 88, shock_g: 0.1 },
    { timestamp: "11:00 AM", temperature: 1.0, humidity: 87, shock_g: 0.2 }
  ]));

  const res = await fetch(verifyUrl, {
    method: "POST",
    body: formData
  });

  assertEquals(res.status, 200, "Verification should succeed with 200");
  const json = await res.json();
  assertEquals(json.success, true);
  assertEquals(json.status, "VERIFIED", "Status should be VERIFIED for authentic PDF");
  assertEquals(json.telemetry_verified, true, "Telemetry should match exactly");
  assertEquals(json.pdf_verified, true, "PDF hash should match exactly");

  // 3. Test Tampering: modify a byte in the PDF buffer and verify it triggers TAMPERED
  const tamperedBuffer = Buffer.from(pdfBuffer);
  tamperedBuffer[100] = tamperedBuffer[100] ^ 0xFF; // Flip one byte
  const tamperedBlob = new Blob([tamperedBuffer], { type: "application/pdf" });

  const tamperedFormData = new FormData();
  tamperedFormData.append("pdf_file", tamperedBlob, "tampered_report.pdf");
  tamperedFormData.append("shipment_id", "TEST-TMS-9999");

  const tamperedRes = await fetch(verifyUrl, {
    method: "POST",
    body: tamperedFormData
  });

  assertEquals(tamperedRes.status, 200);
  const tamperedJson = await tamperedRes.json();
  assertEquals(tamperedJson.success, true);
  assertEquals(tamperedJson.status, "TAMPERED", "Status should be TAMPERED for modified PDF");
  assertEquals(tamperedJson.pdf_verified, false, "PDF verified flag should be false");
});

// ==========================================
// 7. Biophysical & Legal Convention Tests
// ==========================================

test("API Biophysics & Legal: Bananas Ocean Freight with Telemetry Gap", async () => {
  const webhookUrl = "http://localhost:8081/v1/tms/webhook";
  
  try {
    const health = await fetch("http://localhost:8081/health");
    if (health.status !== 200) throw new Error();
  } catch {
    console.log("⚠️  Skipping Banana Ocean test: Local FastAPI server is not running on http://localhost:8081");
    return;
  }

  const payload = {
    tms_system: "CargoWise",
    event_type: "SHIPMENT_DELIVERED",
    shipment_id: "TEST-BANANA-OCEAN-99",
    cargo_type: "Organic Sweet Cavendish Bananas",
    commercial_value_usd: 20000,
    contract_pdf_path: "contracts/cherries_sla_agreement.pdf",
    incident_context: "Reefer cooling issues on ship transit",
    telemetry: [
      { timestamp: "2026-06-08T08:00:00Z", temperature: 14.0, carrierCustody: true },
      { timestamp: "2026-06-08T12:00:00Z", temperature: 10.0, carrierCustody: true } // 4-hour gap, below 13°C
    ],
    weight_kg: 1000,
    transport_mode: "Ocean"
  };

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  assertEquals(res.status, 200, "Webhook proxy response should be 200");
  const json = await res.json();
  assertEquals(json.success, true);
  
  const report = json.report;
  assertEquals(report.damage_assessment.status, "PARTIAL_DAMAGE");
  
  const scientific = report.damage_assessment.scientific_reasoning.toLowerCase();
  assertEquals(scientific.includes("banana"), true, "Reasoning should contain banana");
  assertEquals(scientific.includes("chilling"), true, "Reasoning should mention chilling injury");
  assertEquals(scientific.includes("gaps") || scientific.includes("bounds"), true, "Reasoning should mention gaps/bounds");
  
  // Verify thermodynamic cooling/warming model bounds
  const intervals = report.damage_assessment.uncertainty_intervals;
  assertEquals(intervals.length, 1);
  assertEquals(intervals[0].lower_bound_temp, 9.5, "Lower bound should be calculated using active cooling thermodynamic model");
  assertEquals(intervals[0].upper_bound_temp, 16.79, "Upper bound should be calculated using Newtonian heating decay model");
});

test("API Biophysics & Legal: mRNA Vaccine Freezing Total Loss & Air Cap", async () => {
  const webhookUrl = "http://localhost:8081/v1/tms/webhook";
  
  try {
    const health = await fetch("http://localhost:8081/health");
    if (health.status !== 200) throw new Error();
  } catch {
    return;
  }

  const payload = {
    tms_system: "CargoWise",
    event_type: "SHIPMENT_DELIVERED",
    shipment_id: "TEST-VACCINE-FREEZE-99",
    cargo_type: "mRNA Vaccine (BioNTech/Pfizer)",
    commercial_value_usd: 150000,
    contract_pdf_path: "contracts/pharma_global_transport.pdf",
    incident_context: "Reefer temperature drop below zero during flight",
    telemetry: [
      { timestamp: "2026-06-08T08:00:00Z", temperature: 4.0, carrierCustody: true },
      { timestamp: "2026-06-08T09:00:00Z", temperature: -1.5, carrierCustody: true } // freezing event
    ],
    weight_kg: 100,
    transport_mode: "Air"
  };

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  assertEquals(res.status, 200);
  const json = await res.json();
  assertEquals(json.success, true);
  
  const report = json.report;
  assertEquals(report.damage_assessment.status, "TOTAL_LOSS");
  
  const scientific = report.damage_assessment.scientific_reasoning.toLowerCase();
  assertEquals(scientific.includes("freezing"), true, "Reasoning should mention freezing");
  assertEquals(scientific.includes("vaccine"), true, "Reasoning should mention vaccine");
});

test("API Biophysics & Legal: Ocean Freight with Package Limit Dominance on Express Proxy", async () => {
  const webhookUrl = "http://localhost:3000/api/tms/webhook";
  
  try {
    const health = await fetch("http://localhost:3000/api/tms/audits");
    if (health.status !== 200) throw new Error();
  } catch {
    console.log("⚠️  Skipping Package Limit Dominance test: Local Express server is not running on port 3000");
    return;
  }

  // Under Hague-Visby rules (Ocean):
  // Cargo weight: 10 kg -> 10 * 2 SDR/kg * 1.31 USD/SDR = 26.20 USD weight-based limit
  // Package count: 10 -> 10 * 666.67 SDR/package * 1.31 USD/SDR = 8,733.38 USD package-based limit
  // Cargo value: 15000 USD. Severe excursion -> 100% loss (15000 USD loss)
  const payload = {
    shipmentId: "TEST-PKG-DOMINANT-NODE-88",
    carrier: "TransAtlantic Ocean Lines",
    commodity: "Organic Cavendish Bananas", // Ocean transport
    weightKg: 10,
    cargoValUsd: 15000,
    packageCount: 10,
    tempLogs: [
      { time: "2026-06-08T08:00:00Z", temp: 1.0, carrierCustody: true, durationHours: 4 } // severe chilling excursion -> 100% loss
    ]
  };

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  assertEquals(res.status, 200);
  const json = await res.json();
  assertEquals(json.success, true);
  
  const audit = json.audit;
  assertEquals(audit.limitValUsd, 8733.38, "Should choose package-based limit of 8,733.38 USD over weight-based 26.20 USD");
  assertEquals(audit.liableClaimUsd, 8733.38, "Liable claim should be capped at package-based limit");
});

test("API Security: In-Memory Rate-Limiting (Run Last)", async () => {
  const url = "http://localhost:8081/v1/audit/verify";
  
  try {
    const health = await fetch("http://localhost:8081/health");
    if (health.status !== 200) throw new Error();
  } catch {
    console.log("⚠️  Skipping rate-limiting test: Local FastAPI server is not running on port 8081");
    return;
  }

  console.log("      [Rate Limit Test] Sending 61 requests to verify endpoint to trigger 429...");
  const dummyBlob = new Blob([Buffer.from("dummy pdf content")], { type: "application/pdf" });
  let hitRateLimit = false;

  for (let i = 0; i < 62; i++) {
    const formData = new FormData();
    formData.append("pdf_file", dummyBlob, "dummy.pdf");
    
    const res = await fetch(url, {
      method: "POST",
      body: formData
    });

    if (res.status === 429) {
      hitRateLimit = true;
      break;
    }
  }

  assertEquals(hitRateLimit, true, "Should hit rate limit of 60 requests/min and return 429");
});

// ==========================================
// Test Runner
// ==========================================

async function runTests() {
  console.log("=== RUNNING CHAIN-GUARD HARNESS LAYER TESTS ===");
  let passedCount = 0;
  let failedCount = 0;

  for (const t of tests) {
    try {
      await t.fn();
      console.log(`✅ PASS: ${t.name}`);
      passedCount++;
    } catch (error: any) {
      console.error(`❌ FAIL: ${t.name}`);
      console.error(`   Error: ${error.message || error}`);
      failedCount++;
    }
  }

  console.log("\n===============================================");
  console.log(`Summary: ${passedCount} passed, ${failedCount} failed.`);
  console.log("===============================================");

  if (failedCount > 0) {
    process.exit(1);
  } else {
    console.log("🎉 All Harness checks passed successfully!");
    process.exit(0);
  }
}

runTests();
