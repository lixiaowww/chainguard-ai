import os
import re
import sys
import json
import shutil
import hashlib

from typing import Optional
from fastapi import FastAPI, File, Form, UploadFile, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from starlette.middleware.base import BaseHTTPMiddleware
from pydantic import BaseModel
import time
from collections import defaultdict

# Import existing codebase items
from crew_orchestrator import load_and_extract_contract_terms
from liability_scorer import LiabilityScorer
from generate_claim_pdf import generate_claim_pdf

app = FastAPI(title="ChainGuard AI RESTful Audit API", version="2.0.0")

rate_limit_store = defaultdict(list)

class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path.rstrip("/")
        if request.method == "POST" and path in ["/v1/audit", "/v1/audit/verify"]:
            client_ip = request.client.host if request.client else "127.0.0.1"
            now = time.time()
            rate_limit_store[client_ip] = [t for t in rate_limit_store[client_ip] if now - t < 60]
            if len(rate_limit_store[client_ip]) >= 60:
                return JSONResponse(
                    status_code=429,
                    content={"detail": "Too many requests. Rate limit is 60 requests per minute per IP."}
                )
            rate_limit_store[client_ip].append(now)
        return await call_next(request)

# Register rate limiting middleware first
app.add_middleware(RateLimitMiddleware)

# Enable CORS for developer ease
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup_event():
    from database import init_db
    init_db()

# Hashing and Audit Chain helpers
def compute_canonical_hash(data) -> str:
    canonical_str = json.dumps(data, sort_keys=True, separators=(',', ':'), ensure_ascii=False)
    return hashlib.sha256(canonical_str.encode('utf-8')).hexdigest()

def compute_sha256(data_bytes: bytes) -> str:
    return hashlib.sha256(data_bytes).hexdigest()

def register_audit_seal(shipment_id: str, telemetry: list, extracted_terms: dict, pdf_bytes: bytes, anchored_tx_id: Optional[str] = None, timestamp: Optional[str] = None) -> dict:
    from datetime import datetime
    from database import SessionLocal, AuditSeal
    
    telemetry_hash = compute_canonical_hash(telemetry or [])
    terms_hash = compute_canonical_hash(extracted_terms or {})
    pdf_hash = compute_sha256(pdf_bytes)
    combined_hash = hashlib.sha256(f"{telemetry_hash}:{terms_hash}:{pdf_hash}".encode('utf-8')).hexdigest()
    
    ts = timestamp or (datetime.utcnow().isoformat() + "Z")
    tx_id = anchored_tx_id or ("0x" + hashlib.sha256(f"tsa_anchor:{combined_hash}:{ts}".encode('utf-8')).hexdigest())
    
    record = {
        "shipment_id": shipment_id,
        "timestamp": ts,
        "telemetry_hash": telemetry_hash,
        "terms_hash": terms_hash,
        "pdf_hash": pdf_hash,
        "combined_hash": combined_hash,
        "anchored_tx_id": tx_id
    }
    
    db = SessionLocal()
    try:
        existing = db.query(AuditSeal).filter(AuditSeal.shipment_id == shipment_id).first()
        if existing:
            existing.timestamp = record["timestamp"]
            existing.telemetry_hash = record["telemetry_hash"]
            existing.terms_hash = record["terms_hash"]
            existing.pdf_hash = record["pdf_hash"]
            existing.combined_hash = record["combined_hash"]
            existing.anchored_tx_id = record["anchored_tx_id"]
        else:
            seal = AuditSeal(
                shipment_id=shipment_id,
                timestamp=record["timestamp"],
                telemetry_hash=record["telemetry_hash"],
                terms_hash=record["terms_hash"],
                pdf_hash=record["pdf_hash"],
                combined_hash=record["combined_hash"],
                anchored_tx_id=record["anchored_tx_id"]
            )
            db.add(seal)
        db.commit()
    except Exception as e:
        print(f"[Database] Error registering audit seal: {e}")
        db.rollback()
    finally:
        db.close()
        
    print(f"[Audit Chain] Registered seal for Shipment ID {shipment_id}: {combined_hash[:10]}... Anchored at {tx_id[:10]}...")
    return record

def solve_liability_limit(weight_kg: float, transport_mode: str, packages: Optional[int] = None) -> float:
    SDR_RATE = 1.31
    if transport_mode == "Air":
        # Montreal Convention: 22 SDR/kg
        return weight_kg * 22.0 * SDR_RATE
    else:
        # Hague-Visby Rules: 2 SDR/kg or 666.67 SDR/package, whichever is higher
        weight_limit = weight_kg * 2.0 * SDR_RATE
        if packages is not None and packages > 0:
            package_limit = packages * 666.67 * SDR_RATE
            return max(weight_limit, package_limit)
        else:
            return weight_limit

def calculate_biophysical_metrics(commodity: str, telemetry: list, weight_kg: float, cargo_val_usd: float, transport_mode: str, incident_context: str, packages: Optional[int] = None) -> dict:
    from dateutil.parser import parse as parse_date
    import math
    
    # 1. Parse telemetry and handle gaps
    sorted_telemetry = []
    for pt in (telemetry or []):
        temp = pt.get("temperature")
        if temp is None:
            temp = pt.get("temp")
        try:
            temp = float(temp) if temp is not None else 4.0
        except ValueError:
            temp = 4.0
            
        time_str = pt.get("timestamp")
        if time_str is None:
            time_str = pt.get("time")
            
        dt = None
        if time_str:
            try:
                dt = parse_date(time_str)
            except Exception:
                pass
                
        custody = pt.get("carrierCustody")
        if custody is None:
            custody = pt.get("carrier_custody")
        if custody is None:
            custody = True
            
        duration = pt.get("durationHours")
        if duration is None:
            duration = pt.get("duration_hours")
        try:
            duration = float(duration) if duration is not None else 1.0
        except ValueError:
            duration = 1.0
            
        sorted_telemetry.append({
            "dt": dt,
            "time_str": time_str or "N/A",
            "temperature": temp,
            "carrier_custody": custody,
            "duration_hours": duration,
            "humidity": pt.get("humidity", 70.0),
            "shock_g": pt.get("shock_g", 0.1)
        })
        
    if all(x["dt"] is not None for x in sorted_telemetry):
        sorted_telemetry.sort(key=lambda x: x["dt"])
        for i in range(1, len(sorted_telemetry)):
            prev_pt = sorted_telemetry[i-1]
            pt = sorted_telemetry[i]
            if prev_pt["dt"] and pt["dt"]:
                dt1 = prev_pt["dt"].replace(tzinfo=None)
                dt2 = pt["dt"].replace(tzinfo=None)
                pt["duration_hours"] = max(1.0, (dt2 - dt1).total_seconds() / 3600.0)
        
    comm_lower = commodity.lower()
    is_vaccine = any(x in comm_lower for x in ["vaccine", "pharm", "med", "insulin"])
    is_banana = any(x in comm_lower for x in ["banana", "fruit", "produce"])
    
    target_temp = 2.0
    k_val = 0.12
    t_ambient = 20.0
    
    if is_vaccine:
        target_temp = 8.0
        k_val = 0.05
        t_ambient = 25.0
    elif is_banana:
        target_temp = 13.0
        k_val = 0.12
        t_ambient = 20.0

    gaps_detected = []
    uncertainty_intervals = []
    max_temp_seen = -999.0
    excursion_duration_hours = 0.0
    excursion_in_custody = False
    
    for i in range(len(sorted_telemetry)):
        pt = sorted_telemetry[i]
        if pt["temperature"] > max_temp_seen:
            max_temp_seen = pt["temperature"]
            
        if i < len(sorted_telemetry) - 1:
            next_pt = sorted_telemetry[i+1]
            gap_hours = 0.0
            if pt["dt"] and next_pt["dt"]:
                dt1 = pt["dt"].replace(tzinfo=None)
                dt2 = next_pt["dt"].replace(tzinfo=None)
                gap_hours = (dt2 - dt1).total_seconds() / 3600.0
            else:
                gap_hours = pt["duration_hours"]
                
            if gap_hours > 2.0:
                gaps_detected.append({
                    "start": pt["time_str"],
                    "end": next_pt["time_str"],
                    "duration_hours": gap_hours
                })
                t1 = pt["temperature"]
                t2 = next_pt["temperature"]
                
                # Thermodynamic heating decay toward ambient (power loss scenario)
                upper_bound = t_ambient + (t1 - t_ambient) * math.exp(-k_val * gap_hours)
                upper_bound = max(t1, t2, upper_bound)
                
                # Thermodynamic active cooling decay toward target_temp (normal reefer control)
                lower_bound = target_temp + (t1 - target_temp) * math.exp(-k_val * gap_hours)
                lower_bound = min(t1, t2, lower_bound)
                
                # Apply safety margin bounds
                lower_bound = max(-20.0, lower_bound - 0.5)
                upper_bound = min(50.0, upper_bound + 0.5)
                
                uncertainty_intervals.append({
                    "gap_start": pt["time_str"],
                    "gap_end": next_pt["time_str"],
                    "gap_duration_hours": gap_hours,
                    "lower_bound_temp": round(lower_bound, 2),
                    "upper_bound_temp": round(upper_bound, 2)
                })

    optimal_range = [0.0, 2.0]
    hourly_base_rate = 0.2
    
    if is_vaccine:
        optimal_range = [2.0, 8.0]
        hourly_base_rate = 0.5
    elif is_banana:
        optimal_range = [13.0, 15.0]
        hourly_base_rate = 3.0

    degradation_rate = 0.0
    total_loss_triggered = False
    scientific_reasoning = ""
    
    if is_vaccine:
        for pt in sorted_telemetry:
            if pt["temperature"] < 0.0:
                total_loss_triggered = True
                scientific_reasoning = f"Freezing temperature ({pt['temperature']}°C) detected at {pt['time_str']}. mRNA vaccines denature instantly when frozen, resulting in immediate TOTAL_LOSS."
                break
                
    if not total_loss_triggered:
        for pt in sorted_telemetry:
            duration = pt["duration_hours"]
            temp = pt["temperature"]
            custody = pt["carrier_custody"]
            
            excursion = False
            if is_banana:
                if temp < target_temp:
                    excursion = True
                    delta_t = target_temp - temp
                    multiplier = 1.8 ** (delta_t / 3.0)
                    degradation_rate += hourly_base_rate * multiplier * duration
            else:
                if temp > target_temp:
                    excursion = True
                    delta_t = temp - target_temp
                    multiplier = 2.2 ** (delta_t / 4.0)
                    degradation_rate += hourly_base_rate * multiplier * duration
                    
            if excursion:
                excursion_duration_hours += duration
                if custody:
                    excursion_in_custody = True

        degradation_rate = min(100.0, round(degradation_rate * 10) / 10.0)
        
    if total_loss_triggered:
        degradation_rate = 100.0
        
    status = "NORMAL"
    if degradation_rate > 15.0 and degradation_rate < 40.0:
        status = "PARTIAL_DAMAGE"
    elif degradation_rate >= 40.0:
        status = "TOTAL_LOSS" if (degradation_rate == 100.0 or is_vaccine) else "CLAIM_PENDING"

    if not scientific_reasoning:
        if degradation_rate == 0.0:
            scientific_reasoning = f"No critical temperature threshold violations observed. Cargo maintained within optimal range of {optimal_range[0]}°C to {optimal_range[1]}°C."
        else:
            if is_banana:
                scientific_reasoning = f"Banana cargo subjected to chilling temperatures below 13°C for {excursion_duration_hours:.1f} hours. Accumulation of chilling injury reached {degradation_rate}% biological decay."
            elif is_vaccine:
                scientific_reasoning = f"Vaccine cargo subjected to heat breach above 8°C for {excursion_duration_hours:.1f} hours. Biological protein degradation reached {degradation_rate}% shelf-life reduction."
            else:
                scientific_reasoning = f"Cherry cargo subjected to temperatures above 2°C for {excursion_duration_hours:.1f} hours. Accumulation of heat-breach ripening reached {degradation_rate}% decay."

        if uncertainty_intervals:
            scientific_reasoning += f" Warning: telemetry data gaps > 2 hours detected (gaps: {len(uncertainty_intervals)}). Temperature bounds during gaps calculated."

    estimated_loss_usd = round(cargo_val_usd * (degradation_rate / 100.0), 2)
    if status == "TOTAL_LOSS":
        estimated_loss_usd = cargo_val_usd

    limit_val_usd = solve_liability_limit(weight_kg, transport_mode, packages)
    liable_claim_usd = estimated_loss_usd if excursion_in_custody else 0.0
    liable_claim_usd = min(liable_claim_usd, limit_val_usd)
    liable_claim_usd = round(liable_claim_usd, 2)
    
    liability_score = 0
    if degradation_rate > 0:
        if excursion_in_custody:
            liability_score += 50
            liability_score += int((degradation_rate / 100.0) * 40)
            if excursion_duration_hours > 6:
                liability_score += 10
        else:
            liability_score += int((degradation_rate / 100.0) * 15)
    liability_score = min(100, liability_score)
    
    return {
        "degradation_rate": degradation_rate,
        "excursion_duration_hours": excursion_duration_hours,
        "max_temp_seen": max_temp_seen,
        "excursion_in_custody": excursion_in_custody,
        "estimated_loss_usd": estimated_loss_usd,
        "liable_claim_usd": liable_claim_usd,
        "liability_score": liability_score,
        "claim_status": status,
        "limit_val_usd": limit_val_usd,
        "uncertainty_intervals": uncertainty_intervals,
        "scientific_reasoning": scientific_reasoning
    }

# Helper functions replicating Node's harness layer in Python
def mask_sensitive_data(text: str) -> str:
    if not text:
        return ""
    # Mask email: support@chainguard.ai -> s***t@chainguard.ai
    def replace_email(m):
        user, domain, ext = m.group(1), m.group(2), m.group(3)
        return user[0] + "***" + user[-1] + "@" + domain + "." + ext
    
    masked = re.sub(
        r'([a-zA-Z0-9_\-\.]+)@([a-zA-Z0-9_\-\.]+)\.([a-zA-Z]{2,5})',
        replace_email,
        text
    )
    # Mask US and international phone numbers
    masked = re.sub(
        r'(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}',
        "[PHONE_MASKED]",
        masked
    )
    return masked

def sanitize_telemetry(points: list) -> list:
    if not isinstance(points, list):
        return []
    sanitized_points = []
    for idx, pt in enumerate(points):
        sanitized = dict(pt)
        
        # Temperature clamp [-100, 80]
        temp = sanitized.get("temperature")
        if temp is None or str(temp) == "None" or str(temp) == "":
            sanitized["temperature"] = 4.0
        else:
            try:
                temp = float(temp)
                if temp > 80:
                    sanitized["temperature"] = 80.0
                elif temp < -100:
                    sanitized["temperature"] = -100.0
                else:
                    sanitized["temperature"] = temp
            except ValueError:
                sanitized["temperature"] = 4.0
                
        # Humidity clamp [0, 100]
        hum = sanitized.get("humidity")
        if hum is None or str(hum) == "None" or str(hum) == "":
            sanitized["humidity"] = 70.0
        else:
            try:
                hum = float(hum)
                sanitized["humidity"] = max(0.0, min(100.0, hum))
            except ValueError:
                sanitized["humidity"] = 70.0
                
        # Shock clamp [0, 25.0]
        shock = sanitized.get("shock_g")
        if shock is None or str(shock) == "None" or str(shock) == "":
            sanitized["shock_g"] = 0.1
        else:
            try:
                shock = float(shock)
                sanitized["shock_g"] = max(0.0, min(25.0, shock))
            except ValueError:
                sanitized["shock_g"] = 0.1
                
        sanitized_points.append(sanitized)
    return sanitized_points

def apply_output_guardrails(parsed_report: dict, commercial_value: float) -> dict:
    if not parsed_report:
        return parsed_report
    declared_val = float(commercial_value or 0.0)
    if "damage_assessment" in parsed_report:
        damage = parsed_report["damage_assessment"]
        if float(damage.get("estimated_loss_usd", 0.0)) > declared_val:
            damage["estimated_loss_usd"] = declared_val
    return parsed_report

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "ChainGuard AI REST API"}

class FeedbackPayload(BaseModel):
    shipment_id: str
    cargo_type: str
    incident_context: Optional[str] = None
    original_report: dict
    corrected_liability: dict

@app.post("/v1/feedback")
def submit_feedback(payload: FeedbackPayload):
    try:
        verified_dir = os.path.join(os.getcwd(), "verified_cases")
        os.makedirs(verified_dir, exist_ok=True)
        
        clean_id = re.sub(r'[^a-zA-Z0-9.\-_]', '_', payload.shipment_id)
        file_path = os.path.join(verified_dir, f"{clean_id}.json")
        
        case_data = {
            "shipment_id": payload.shipment_id,
            "cargo_type": payload.cargo_type,
            "incident_context": payload.incident_context,
            "original_report": payload.original_report,
            "corrected_liability": payload.corrected_liability,
            "timestamp": payload.corrected_liability.get("timestamp") or ""
        }
        if not case_data["timestamp"]:
            from datetime import datetime
            case_data["timestamp"] = datetime.utcnow().isoformat()
            
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(case_data, f, indent=2, ensure_ascii=False)
            
        print(f"[Feedback Loop] Saved user-corrected case to {file_path}")
        return {"success": True, "path": file_path}
    except Exception as e:
        print(f"Feedback API Error: {str(e)}", file=sys.stderr)
        raise HTTPException(status_code=500, detail=f"Failed to save feedback: {str(e)}")

class PDFGenerationPayload(BaseModel):
    shipment_id: str
    cargo_type: str
    commercial_value: float
    extracted_terms: dict
    report: dict
    telemetry: Optional[list] = None
    weight_kg: Optional[float] = 180.0
    transport_mode: Optional[str] = "Air"
    packages: Optional[int] = None
    package_count: Optional[int] = None

@app.post("/v1/audit/pdf")
async def export_audit_pdf(payload: PDFGenerationPayload):
    try:
        # 1. Compute input hashes
        telemetry_hash = compute_canonical_hash(payload.telemetry or [])
        terms_hash = compute_canonical_hash(payload.extracted_terms or {})
        
        # 2. Compute inputs seal
        input_seal = hashlib.sha256(f"{telemetry_hash}:{terms_hash}".encode('utf-8')).hexdigest()
        
        # Pre-compute anchored_tx_id to avoid circular dependency
        from datetime import datetime
        now_ts = datetime.utcnow().isoformat() + "Z"
        anchored_tx_id = "0x" + hashlib.sha256(f"tsa_anchor:{telemetry_hash}:{terms_hash}:{now_ts}".encode('utf-8')).hexdigest()
        
        pdf_payload = payload.model_dump()
        pdf_payload["input_seal"] = input_seal
        pdf_payload["anchored_tx_id"] = anchored_tx_id
        
        packages = payload.packages if payload.packages is not None else payload.package_count
        limit_val = solve_liability_limit(payload.weight_kg, payload.transport_mode, packages)
        pdf_payload["limit_val_usd"] = limit_val
        
        pdf_bytes = generate_claim_pdf(pdf_payload)
        
        # 3. Save to registry ledger
        register_audit_seal(
            shipment_id=payload.shipment_id,
            telemetry=payload.telemetry or [],
            extracted_terms=payload.extracted_terms or {},
            pdf_bytes=pdf_bytes,
            anchored_tx_id=anchored_tx_id,
            timestamp=now_ts
        )
        
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=claim_report_{payload.shipment_id}.pdf"
            }
        )
    except Exception as e:
        print(f"PDF Generation Error: {str(e)}", file=sys.stderr)
        raise HTTPException(status_code=500, detail=f"Failed to generate claim PDF: {str(e)}")

@app.post("/v1/audit")
async def audit_shipment(
    contract_file: UploadFile = File(...),
    telemetry: str = Form(...),
    cargo_type: str = Form(...),
    commercial_value: float = Form(...),
    incident_context: Optional[str] = Form(None),
    mock: bool = Form(False),
    weight_kg: Optional[float] = Form(180.0),
    transport_mode: Optional[str] = Form("Air"),
    packages: Optional[int] = Form(None),
    package_count: Optional[int] = Form(None)
):
    try:
        # 1. Parse telemetry JSON string
        try:
            telemetry_data = json.loads(telemetry)
        except Exception as json_err:
            raise HTTPException(status_code=400, detail=f"Invalid telemetry JSON payload: {str(json_err)}")

        # 2. Apply Ingestion Filters (PII Masking & Telemetry Sanitizing)
        sanitized_telemetry = sanitize_telemetry(telemetry_data)
        masked_incident_context = mask_sensitive_data(incident_context or "")

        # Create contracts directory if not exists
        contracts_dir = os.path.join(os.getcwd(), "contracts")
        os.makedirs(contracts_dir, exist_ok=True)
        
        # Save contract file to disk for RAG analysis
        clean_filename = re.sub(r'[^a-zA-Z0-9.\-_]', '_', contract_file.filename)
        temp_pdf_path = os.path.join(contracts_dir, f"uploaded_{clean_filename}")
        
        with open(temp_pdf_path, "wb") as buffer:
            shutil.copyfileobj(contract_file.file, buffer)

        # 3. Extract Contract SLA terms (RAG Component)
        terms = load_and_extract_contract_terms(temp_pdf_path, mock=mock)

        # Solve biophysical metrics
        resolved_packages = packages if packages is not None else package_count
        biophysical = calculate_biophysical_metrics(
            commodity=cargo_type,
            telemetry=sanitized_telemetry,
            weight_kg=weight_kg,
            cargo_val_usd=commercial_value,
            transport_mode=transport_mode,
            incident_context=masked_incident_context,
            packages=resolved_packages
        )

        # 4. Multi-Agent Liability Scorer (Reasoning Loop)
        shipment_data = {
            "shipment_id": os.path.basename(temp_pdf_path).split(".")[0],
            "cargo_type": cargo_type,
            "commercial_value_usd": commercial_value,
            "incident_context": masked_incident_context,
            "iot_telemetry_history": sanitized_telemetry,
            "biophysical_metrics": biophysical
        }

        scorer = LiabilityScorer(shipment_data, terms)
        result = scorer.run_debate_loop(mock=mock)
        
        # 5. Apply Output Guardrails (PII and Clamping)
        if "final_structured_report" in result:
            result["final_structured_report"] = apply_output_guardrails(
                result["final_structured_report"],
                commercial_value
            )

        # Override biophysical/financial results to enforce Single Source of Truth
        if "final_structured_report" in result:
            report = result["final_structured_report"]
            if not isinstance(report, dict):
                report = {}
            if "damage_assessment" not in report or not isinstance(report["damage_assessment"], dict):
                report["damage_assessment"] = {}
            if "liability_assignment" not in report or not isinstance(report["liability_assignment"], dict):
                report["liability_assignment"] = {}
                
            current_status = report["damage_assessment"].get("status", "NORMAL")
            new_status = biophysical["claim_status"]
            if current_status != "NORMAL" and new_status == "NORMAL":
                pass
            else:
                report["damage_assessment"]["status"] = new_status
                
            current_loss = float(report["damage_assessment"].get("estimated_loss_usd", 0.0))
            new_loss = biophysical["estimated_loss_usd"]
            if current_loss > 0.0 and new_loss == 0.0:
                pass
            else:
                report["damage_assessment"]["estimated_loss_usd"] = new_loss
                
            if report["damage_assessment"]["status"] != "NORMAL" and new_status == "NORMAL":
                pass
            else:
                report["damage_assessment"]["scientific_reasoning"] = biophysical["scientific_reasoning"]
            
            if not report["liability_assignment"].get("liable_party") or mock:
                if "customs" in (incident_context or "").lower():
                    report["liability_assignment"]["liable_party"] = "Port Authority"
                    report["liability_assignment"]["fault_percentage"] = 100
                    report["liability_assignment"]["evidence_citation"] = "Customs clearance delay. Carrier is exempt per contract exclusions."
                else:
                    report["liability_assignment"]["liable_party"] = "Carrier" if biophysical["excursion_in_custody"] else "Shipper"
                    report["liability_assignment"]["fault_percentage"] = biophysical["liability_score"]
                    report["liability_assignment"]["evidence_citation"] = f"Temperature excursions during custody. Max temp seen: {biophysical['max_temp_seen']}°C."
            
            if not report.get("action_items") or mock:
                report["action_items"] = [
                    "Isolate affected crates for inspection.",
                    "File formal notice of claim with carrier within contract SLA deadline.",
                    "Verify reefer power status and check for physical seal tampering."
                ]
            result["final_structured_report"] = report

        # Build response payload
        return {
            "success": True,
            "extracted_terms": terms,
            "assessor_output": result.get("assessor_output"),
            "legal_output": result.get("legal_output"),
            "dispatcher_output": result.get("dispatcher_output"),
            "report": result.get("final_structured_report")
        }

    except Exception as e:
        print(f"API Error: {str(e)}", file=sys.stderr)
        raise HTTPException(status_code=500, detail=f"Audit execution failed: {str(e)}")


class TMSWebhookPayload(BaseModel):
    tms_system: str
    event_type: str
    shipment_id: str
    cargo_type: str
    commercial_value_usd: float
    contract_pdf_path: str
    incident_context: Optional[str] = None
    telemetry: list
    weight_kg: Optional[float] = 180.0
    transport_mode: Optional[str] = "Air"
    packages: Optional[int] = None
    package_count: Optional[int] = None

@app.post("/v1/tms/webhook")
def receive_tms_webhook(payload: TMSWebhookPayload):
    try:
        # 1. Apply sanitization & PII masking
        sanitized_telemetry = sanitize_telemetry(payload.telemetry)
        masked_incident_context = mask_sensitive_data(payload.incident_context or "")
        
        # 2. Resolve contract path
        contract_path = payload.contract_pdf_path
        full_pdf_path = os.path.join(os.getcwd(), contract_path)
        if not os.path.exists(full_pdf_path):
            contracts_dir = os.path.join(os.getcwd(), "contracts")
            if "pharma" in contract_path:
                full_pdf_path = os.path.join(contracts_dir, "pharma_global_transport.pdf")
            elif "wine" in contract_path:
                full_pdf_path = os.path.join(contracts_dir, "wine_logistics_spec.pdf")
            else:
                full_pdf_path = os.path.join(contracts_dir, "cherries_sla_agreement.pdf")
        
        # 3. Extract Contract SLA terms (RAG)
        mock_mode = os.environ.get("GEMINI_API_KEY") is None
        terms = load_and_extract_contract_terms(full_pdf_path, mock=mock_mode)
        
        resolved_packages = payload.packages if payload.packages is not None else payload.package_count
        # Solve biophysical metrics
        biophysical = calculate_biophysical_metrics(
            commodity=payload.cargo_type,
            telemetry=sanitized_telemetry,
            weight_kg=payload.weight_kg or 180.0,
            cargo_val_usd=payload.commercial_value_usd,
            transport_mode=payload.transport_mode or "Air",
            incident_context=masked_incident_context,
            packages=resolved_packages
        )

        # 4. Multi-Agent Liability Scorer (Reasoning Loop)
        shipment_data = {
            "shipment_id": payload.shipment_id,
            "cargo_type": payload.cargo_type,
            "commercial_value_usd": payload.commercial_value_usd,
            "incident_context": masked_incident_context,
            "iot_telemetry_history": sanitized_telemetry,
            "biophysical_metrics": biophysical
        }
        
        scorer = LiabilityScorer(shipment_data, terms)
        result = scorer.run_debate_loop(mock=mock_mode)
        
        # 5. Apply Output Guardrails
        if "final_structured_report" in result:
            result["final_structured_report"] = apply_output_guardrails(
                result["final_structured_report"],
                payload.commercial_value_usd
            )
            
        # Override biophysical/financial results to enforce Single Source of Truth
        if "final_structured_report" in result:
            report = result["final_structured_report"]
            if not isinstance(report, dict):
                report = {}
            if "damage_assessment" not in report or not isinstance(report["damage_assessment"], dict):
                report["damage_assessment"] = {}
            if "liability_assignment" not in report or not isinstance(report["liability_assignment"], dict):
                report["liability_assignment"] = {}
                
            current_status = report["damage_assessment"].get("status", "NORMAL")
            new_status = biophysical["claim_status"]
            if current_status != "NORMAL" and new_status == "NORMAL":
                pass
            else:
                report["damage_assessment"]["status"] = new_status
                
            current_loss = float(report["damage_assessment"].get("estimated_loss_usd", 0.0))
            new_loss = biophysical["estimated_loss_usd"]
            if current_loss > 0.0 and new_loss == 0.0:
                pass
            else:
                report["damage_assessment"]["estimated_loss_usd"] = new_loss
                
            if report["damage_assessment"]["status"] != "NORMAL" and new_status == "NORMAL":
                pass
            else:
                report["damage_assessment"]["scientific_reasoning"] = biophysical["scientific_reasoning"]
            
            report["damage_assessment"]["uncertainty_intervals"] = biophysical["uncertainty_intervals"]
            
            if not report["liability_assignment"].get("liable_party") or mock_mode:
                if "customs" in (payload.incident_context or "").lower():
                    report["liability_assignment"]["liable_party"] = "Port Authority"
                    report["liability_assignment"]["fault_percentage"] = 100
                    report["liability_assignment"]["evidence_citation"] = "Customs clearance delay. Carrier is exempt per contract exclusions."
                else:
                    report["liability_assignment"]["liable_party"] = "Carrier" if biophysical["excursion_in_custody"] else "Shipper"
                    report["liability_assignment"]["fault_percentage"] = biophysical["liability_score"]
                    report["liability_assignment"]["evidence_citation"] = f"Temperature excursions during custody. Max temp seen: {biophysical['max_temp_seen']}°C."
            
            if not report.get("action_items") or mock_mode:
                report["action_items"] = [
                    "Isolate affected crates for inspection.",
                    "File formal notice of claim with carrier within contract SLA deadline.",
                    "Verify reefer power status and check for physical seal tampering."
                ]
            result["final_structured_report"] = report
        
        # 6. Generate and save PDF server-side in tms_claims/
        tms_claims_dir = os.path.join(os.getcwd(), "tms_claims")
        os.makedirs(tms_claims_dir, exist_ok=True)
        
        telemetry_hash = compute_canonical_hash(sanitized_telemetry)
        terms_hash = compute_canonical_hash(terms)
        input_seal = hashlib.sha256(f"{telemetry_hash}:{terms_hash}".encode('utf-8')).hexdigest()
        
        # Pre-compute anchored_tx_id to avoid circular dependency
        from datetime import datetime
        now_ts = datetime.utcnow().isoformat() + "Z"
        anchored_tx_id = "0x" + hashlib.sha256(f"tsa_anchor:{telemetry_hash}:{terms_hash}:{now_ts}".encode('utf-8')).hexdigest()
        
        pdf_payload = {
            "shipment_id": payload.shipment_id,
            "cargo_type": payload.cargo_type,
            "commercial_value": payload.commercial_value_usd,
            "extracted_terms": terms,
            "report": result.get("final_structured_report", {}),
            "input_seal": input_seal,
            "transport_mode": payload.transport_mode or "Air",
            "weight_kg": payload.weight_kg or 180.0,
            "limit_val_usd": biophysical["limit_val_usd"],
            "anchored_tx_id": anchored_tx_id,
            "packages": resolved_packages
        }
        pdf_bytes = generate_claim_pdf(pdf_payload)
        
        # Register in audit chain registry
        register_audit_seal(
            shipment_id=payload.shipment_id,
            telemetry=sanitized_telemetry,
            extracted_terms=terms,
            pdf_bytes=pdf_bytes,
            anchored_tx_id=anchored_tx_id,
            timestamp=now_ts
        )
        
        clean_shipment_id = re.sub(r'[^a-zA-Z0-9.\-_]', '_', payload.shipment_id)
        pdf_filename = f"claim_report_{clean_shipment_id}.pdf"
        pdf_dest_path = os.path.join(tms_claims_dir, pdf_filename)
        with open(pdf_dest_path, "wb") as f:
            f.write(pdf_bytes)
        
        # 7. Update tms_events in database
        from datetime import datetime
        from database import SessionLocal, TMSEvent
        event_id = f"EV-{int(datetime.utcnow().timestamp())}-{clean_shipment_id[:10]}"
        
        db_sess = SessionLocal()
        try:
            event = TMSEvent(
                event_id=event_id,
                tms_system=payload.tms_system,
                event_type=payload.event_type,
                shipment_id=payload.shipment_id,
                cargo_type=payload.cargo_type,
                commercial_value_usd=payload.commercial_value_usd,
                received_at=datetime.utcnow().isoformat() + "Z",
                status="Completed",
                extracted_terms=json.dumps(terms),
                report=json.dumps(result.get("final_structured_report")),
                assessor_output=result.get("assessor_output"),
                legal_output=result.get("legal_output"),
                dispatcher_output=result.get("dispatcher_output"),
                pdf_path=f"tms_claims/{pdf_filename}"
            )
            db_sess.add(event)
            db_sess.commit()
        except Exception as e:
            print(f"[Database] Error saving TMS event: {e}")
            db_sess.rollback()
        finally:
            db_sess.close()
            
        return {
            "success": True,
            "event_id": event_id,
            "status": "Completed",
            "pdf_path": f"tms_claims/{pdf_filename}",
            "report": result.get("final_structured_report"),
            "extracted_terms": terms
        }
    except Exception as e:
        print(f"TMS Webhook Error: {str(e)}", file=sys.stderr)
        raise HTTPException(status_code=500, detail=f"TMS Webhook failed: {str(e)}")

@app.get("/v1/tms/events")
def get_tms_events():
    from database import SessionLocal, TMSEvent
    db = SessionLocal()
    try:
        events = db.query(TMSEvent).order_by(TMSEvent.received_at.desc()).all()
        result_list = []
        for ev in events:
            try:
                extracted_terms = json.loads(ev.extracted_terms) if ev.extracted_terms else {}
            except Exception:
                extracted_terms = {}
            try:
                report = json.loads(ev.report) if ev.report else {}
            except Exception:
                report = {}
                
            result_list.append({
                "event_id": ev.event_id,
                "tms_system": ev.tms_system,
                "event_type": ev.event_type,
                "shipment_id": ev.shipment_id,
                "cargo_type": ev.cargo_type,
                "commercial_value_usd": ev.commercial_value_usd,
                "received_at": ev.received_at,
                "status": ev.status,
                "extracted_terms": extracted_terms,
                "report": report,
                "assessor_output": ev.assessor_output,
                "legal_output": ev.legal_output,
                "dispatcher_output": ev.dispatcher_output,
                "pdf_path": ev.pdf_path
            })
        return result_list
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read events: {str(e)}")
    finally:
        db.close()

@app.get("/v1/tms/download-pdf/{shipment_id}")
def download_tms_pdf(shipment_id: str):
    clean_id = re.sub(r'[^a-zA-Z0-9.\-_]', '_', shipment_id)
    pdf_path = os.path.join(os.getcwd(), "tms_claims", f"claim_report_{clean_id}.pdf")
    if not os.path.exists(pdf_path):
        raise HTTPException(status_code=404, detail=f"Claim PDF for shipment {shipment_id} not found.")
    
    with open(pdf_path, "rb") as f:
        pdf_bytes = f.read()
        
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=claim_report_{clean_id}.pdf"
        }
    )

@app.get("/v1/audit/chain")
def get_audit_chain():
    from database import SessionLocal, AuditSeal
    db = SessionLocal()
    try:
        seals = db.query(AuditSeal).order_by(AuditSeal.timestamp.desc()).all()
        return [
            {
                "shipment_id": s.shipment_id,
                "timestamp": s.timestamp,
                "telemetry_hash": s.telemetry_hash,
                "terms_hash": s.terms_hash,
                "pdf_hash": s.pdf_hash,
                "combined_hash": s.combined_hash,
                "anchored_tx_id": s.anchored_tx_id
            }
            for s in seals
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read audit chain: {str(e)}")
    finally:
        db.close()

@app.post("/v1/audit/verify")
async def verify_audit_document(
    pdf_file: UploadFile = File(...),
    shipment_id: Optional[str] = Form(None),
    telemetry: Optional[str] = Form(None),
    extracted_terms: Optional[str] = Form(None)
):
    try:
        pdf_bytes = await pdf_file.read()
        uploaded_pdf_hash = compute_sha256(pdf_bytes)
        
        # Read ledger from database
        from database import SessionLocal, AuditSeal
        db = SessionLocal()
        matching_record = None
        try:
            record = db.query(AuditSeal).filter(AuditSeal.pdf_hash == uploaded_pdf_hash).first()
            if record:
                matching_record = record
            elif shipment_id:
                record = db.query(AuditSeal).filter(AuditSeal.shipment_id == shipment_id).first()
                if record:
                    matching_record = record
        except Exception as e:
            print(f"[Database] Query failed during verification: {e}")
        finally:
            db.close()
        
        if not matching_record:
            return {
                "success": True,
                "status": "NOT_FOUND",
                "message": "No registered cryptographic seal matches this document or shipment ID.",
                "uploaded_pdf_hash": uploaded_pdf_hash
            }
        
        record_shipment_id = matching_record.shipment_id
        stored_pdf_hash = matching_record.pdf_hash
        stored_telemetry_hash = matching_record.telemetry_hash
        stored_terms_hash = matching_record.terms_hash
        
        pdf_verified = (uploaded_pdf_hash == stored_pdf_hash)
        telemetry_verified = True
        terms_verified = True
        
        calc_telemetry_hash = None
        if telemetry:
            try:
                telemetry_data = json.loads(telemetry)
                sanitized = sanitize_telemetry(telemetry_data)
                calc_telemetry_hash = compute_canonical_hash(sanitized)
                telemetry_verified = (calc_telemetry_hash == stored_telemetry_hash)
            except Exception:
                telemetry_verified = False
                
        calc_terms_hash = None
        if extracted_terms:
            try:
                terms_data = json.loads(extracted_terms)
                calc_terms_hash = compute_canonical_hash(terms_data)
                terms_verified = (calc_terms_hash == stored_terms_hash)
            except Exception:
                terms_verified = False
                
        overall_status = "VERIFIED" if (pdf_verified and telemetry_verified and terms_verified) else "TAMPERED"
        
        return {
            "success": True,
            "status": overall_status,
            "shipment_id": record_shipment_id,
            "timestamp": matching_record.timestamp,
            "anchored_tx_id": matching_record.anchored_tx_id,
            "telemetry_verified": telemetry_verified,
            "terms_verified": terms_verified,
            "pdf_verified": pdf_verified,
            "stored_hashes": {
                "telemetry_hash": stored_telemetry_hash,
                "terms_hash": stored_terms_hash,
                "pdf_hash": stored_pdf_hash,
                "combined_hash": matching_record.combined_hash
            },
            "calculated_hashes": {
                "telemetry_hash": calc_telemetry_hash,
                "terms_hash": calc_terms_hash,
                "pdf_hash": uploaded_pdf_hash,
                "combined_hash": compute_sha256(f"{calc_telemetry_hash or stored_telemetry_hash}:{calc_terms_hash or stored_terms_hash}:{uploaded_pdf_hash}".encode('utf-8')) if overall_status == "VERIFIED" else None
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Verification failed: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api:app", host="0.0.0.0", port=8081, reload=True)
