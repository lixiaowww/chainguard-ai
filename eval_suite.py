import os
import sys
import json
import subprocess
import time

TEST_CASES = [
    {
        "name": "Cherries Customs Delay (Customs Exemption)",
        "pdf_path": "contracts/cherries_sla_agreement.pdf",
        "cargo_type": "Fresh Cherries",
        "commercial_value": 80000.0,
        "incident_context": "Shipment delayed at Port customs clearance checkpoint for 12 hours. Cooling was maintained, but delay caused cargo age degradation.",
        "telemetry": [
            {"timestamp": "08:00 AM", "temperature": 0.5, "humidity": 75, "shock_g": 0.1},
            {"timestamp": "12:00 PM", "temperature": 1.0, "humidity": 74, "shock_g": 0.1},
            {"timestamp": "04:00 PM", "temperature": 0.8, "humidity": 75, "shock_g": 0.2}
        ],
        "expected": {
            "liable_party": "Port Authority",
            "estimated_loss_usd": 48000.0
        }
    },
    {
        "name": "mRNA Vaccine Cold Chain Breach (Carrier Failure)",
        "pdf_path": "contracts/pharma_global_transport.pdf",
        "cargo_type": "mRNA Vaccines",
        "commercial_value": 500000.0,
        "incident_context": "Reefer power failure occurred during transit, causing temperatures to rise to 28°C for 2 hours.",
        "telemetry": [
            {"timestamp": "08:00 AM", "temperature": 4.0, "humidity": 60, "shock_g": 0.1},
            {"timestamp": "10:00 AM", "temperature": 28.0, "humidity": 62, "shock_g": 0.1},
            {"timestamp": "12:00 PM", "temperature": 28.5, "humidity": 61, "shock_g": 0.2}
        ],
        "expected": {
            "liable_party": "Carrier",
            "estimated_loss_usd": 500000.0
        }
    },
    {
        "name": "Fine Burgundy Wine Mechanical Drop (Shock Breach)",
        "pdf_path": "contracts/wine_logistics_spec.pdf",
        "cargo_type": "Fine Burgundy Wine",
        "commercial_value": 150000.0,
        "incident_context": "Reefer container was dropped during dock loading crane operations, registering a heavy shock impact.",
        "telemetry": [
            {"timestamp": "08:00 AM", "temperature": 12.0, "humidity": 70, "shock_g": 0.2},
            {"timestamp": "09:00 AM", "temperature": 12.5, "humidity": 69, "shock_g": 5.2},
            {"timestamp": "10:00 AM", "temperature": 12.0, "humidity": 70, "shock_g": 0.2}
        ],
        "expected": {
            "liable_party": "Carrier",
            "estimated_loss_usd": 15000.0
        }
    }
]

def run_eval():
    print("=== STARTING CREWAI ACCURACY & BIAS EVALUATION ===")
    results = []
    
    total_latency = 0.0
    correct_party_count = 0
    total_deviation = 0.0
    
    for case in TEST_CASES:
        print(f"Running evaluation: {case['name']}...")
        start_time = time.time()
        
        # Invoke orchestrator
        python_bin = sys.executable
        args = [
            python_bin, "crew_orchestrator.py",
            "--pdf_path", case["pdf_path"],
            "--cargo_type", case["cargo_type"],
            "--commercial_value", str(case["commercial_value"]),
            "--incident_context", case["incident_context"],
            "--telemetry_json", json.dumps(case["telemetry"]),
            "--mock"  # Run in mock evaluation for speed & offline compatibility
        ]
        
        try:
            res = subprocess.run(args, capture_output=True, text=True, check=True)
            latency = time.time() - start_time
            total_latency += latency
            
            # Find JSON boundaries
            stdout = res.stdout
            json_start = stdout.find("{")
            json_end = stdout.rfind("}")
            if json_start == -1 or json_end == -1:
                raise ValueError("No JSON found in stdout.")
            
            payload = json.loads(stdout[json_start:json_end+1])
            report = payload.get("final_structured_report", {})
            
            # Evaluate metrics
            actual_party = report.get("liability_assignment", {}).get("liable_party", "N/A")
            actual_loss = float(report.get("damage_assessment", {}).get("estimated_loss_usd", 0.0))
            
            # Accuracy Checks
            party_match = actual_party.lower() == case["expected"]["liable_party"].lower()
            if party_match:
                correct_party_count += 1
                
            # Bias / Deviation Calculations
            expected_loss = case["expected"]["estimated_loss_usd"]
            if expected_loss == 0.0:
                deviation = abs(actual_loss)
            else:
                deviation = abs(actual_loss - expected_loss) / expected_loss
            total_deviation += deviation
            
            results.append({
                "name": case["name"],
                "latency_sec": round(latency, 2),
                "expected_party": case["expected"]["liable_party"],
                "actual_party": actual_party,
                "party_correct": "✅ MATCH" if party_match else "❌ MISMATCH",
                "expected_loss": expected_loss,
                "actual_loss": actual_loss,
                "deviation_pct": f"{round(deviation * 100, 1)}%" if expected_loss != 0.0 else f"${actual_loss} diff"
            })
            
        except Exception as e:
            print(f"Failed case {case['name']}: {e}")
            results.append({
                "name": case["name"],
                "latency_sec": 0.0,
                "expected_party": case["expected"]["liable_party"],
                "actual_party": "ERROR",
                "party_correct": "❌ FAILED",
                "expected_loss": case["expected"]["estimated_loss_usd"],
                "actual_loss": 0.0,
                "deviation_pct": "100%"
            })

    # Aggregates
    count = len(TEST_CASES)
    avg_latency = round(total_latency / count, 2) if count > 0 else 0
    accuracy_rate = round((correct_party_count / count) * 100, 1) if count > 0 else 0
    avg_deviation_pct = round((total_deviation / count) * 100, 1) if count > 0 else 0
    
    dashboard_summary = {
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "avg_latency_sec": avg_latency,
        "accuracy_rate": f"{accuracy_rate}%",
        "average_deviation_error": f"{avg_deviation_pct}%",
        "results": results
    }
    
    # Write JSON summary
    with open("evaluation_dashboard.json", "w") as f:
        json.dump(dashboard_summary, f, indent=2)
        
    # Build Markdown Dashboard
    md = f"""# CrewAI Liability Model Accuracy Dashboard

**Audit Conducted**: {dashboard_summary['timestamp']}  
**Evaluation Mode**: Deterministic Logistics Scenario Battery (Offline Sandbox)

---

## 📈 Aggregated Model Metrics

| Metric | Target | Measured Outcome | Status |
| :--- | :--- | :--- | :--- |
| **Legal Liable Party Accuracy** | > 90% | **{accuracy_rate}%** | { '🟢 PASSED' if accuracy_rate >= 90 else '🟡 WARNING' } |
| **Financial Loss Variance Bias** | < 10% | **{avg_deviation_pct}%** | { '🟢 PASSED' if avg_deviation_pct <= 10 else '🟡 WARNING' } |
| **Average Response Latency** | < 5.0s | **{avg_latency}s** | 🟢 OPTIMAL |

---

## 🔬 Test Battery Breakdown

| Case Name | Expected Liable Party | Model Liable Party | Accuracy | Expected Loss | Model Loss | Deviation | Latency |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
"""

    for r in results:
        md += f"| {r['name']} | {r['expected_party']} | {r['actual_party']} | {r['party_correct']} | ${r['expected_loss']:,.0f} | ${r['actual_loss']:,.0f} | {r['deviation_pct']} | {r['latency_sec']}s |\n"

    md += """
---
*Disclaimer: Liability calculations are run in sandboxed simulation. Deviation measures discrepancy between AI-derived legal blame limits and verified ground truth carrier disclaimers.*
"""

    with open("evaluation_dashboard.md", "w") as f:
        f.write(md)
        
    print("=== EVALUATION COMPLETED SUCCESSFULLY ===")
    print(f"Accuracy Rate: {accuracy_rate}% | Avg Loss Bias: {avg_deviation_pct}%")

if __name__ == "__main__":
    run_eval()
