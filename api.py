import os
import re
import sys
import json
import shutil
import hashlib

from typing import Optional
from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Import existing codebase items
from crew_orchestrator import load_and_extract_contract_terms
from liability_scorer import LiabilityScorer
from generate_claim_pdf import generate_claim_pdf
from fastapi.responses import Response

app = FastAPI(title="ChainGuard AI RESTful Audit API", version="2.0.0")

# Enable CORS for developer ease
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Hashing and Audit Chain helpers
def compute_canonical_hash(data) -> str:
    canonical_str = json.dumps(data, sort_keys=True, separators=(',', ':'), ensure_ascii=False)
    return hashlib.sha256(canonical_str.encode('utf-8')).hexdigest()

def compute_sha256(data_bytes: bytes) -> str:
    return hashlib.sha256(data_bytes).hexdigest()

def register_audit_seal(shipment_id: str, telemetry: list, extracted_terms: dict, pdf_bytes: bytes) -> dict:
    from datetime import datetime
    telemetry_hash = compute_canonical_hash(telemetry or [])
    terms_hash = compute_canonical_hash(extracted_terms or {})
    pdf_hash = compute_sha256(pdf_bytes)
    combined_hash = hashlib.sha256(f"{telemetry_hash}:{terms_hash}:{pdf_hash}".encode('utf-8')).hexdigest()
    
    record = {
        "shipment_id": shipment_id,
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "telemetry_hash": telemetry_hash,
        "terms_hash": terms_hash,
        "pdf_hash": pdf_hash,
        "combined_hash": combined_hash
    }
    
    chain_file = os.path.join(os.getcwd(), "audit_chain.json")
    records = []
    if os.path.exists(chain_file):
        try:
            with open(chain_file, "r", encoding="utf-8") as f:
                records = json.load(f)
        except Exception:
            records = []
            
    records = [r for r in records if r.get("shipment_id") != shipment_id]
    records.insert(0, record)
    with open(chain_file, "w", encoding="utf-8") as f:
        json.dump(records, f, indent=2, ensure_ascii=False)
        
    print(f"[Audit Chain] Registered seal for Shipment ID {shipment_id}: {combined_hash[:10]}...")
    return record

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

@app.post("/v1/audit/pdf")
async def export_audit_pdf(payload: PDFGenerationPayload):
    try:
        # 1. Compute input hashes
        telemetry_hash = compute_canonical_hash(payload.telemetry or [])
        terms_hash = compute_canonical_hash(payload.extracted_terms or {})
        
        # 2. Compute inputs seal
        input_seal = hashlib.sha256(f"{telemetry_hash}:{terms_hash}".encode('utf-8')).hexdigest()
        
        pdf_payload = payload.model_dump()
        pdf_payload["input_seal"] = input_seal
        
        pdf_bytes = generate_claim_pdf(pdf_payload)
        
        # 3. Save to registry ledger
        register_audit_seal(
            shipment_id=payload.shipment_id,
            telemetry=payload.telemetry or [],
            extracted_terms=payload.extracted_terms or {},
            pdf_bytes=pdf_bytes
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
    mock: bool = Form(False)
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

        # 4. Multi-Agent Liability Scorer (Reasoning Loop)
        shipment_data = {
            "shipment_id": os.path.basename(temp_pdf_path).split(".")[0],
            "cargo_type": cargo_type,
            "commercial_value_usd": commercial_value,
            "incident_context": masked_incident_context,
            "iot_telemetry_history": sanitized_telemetry
        }

        scorer = LiabilityScorer(shipment_data, terms)
        result = scorer.run_debate_loop(mock=mock)
        
        # 5. Apply Output Guardrails (PII and Clamping)
        if "final_structured_report" in result:
            result["final_structured_report"] = apply_output_guardrails(
                result["final_structured_report"],
                commercial_value
            )

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
        
        # 4. Multi-Agent Liability Scorer (Reasoning Loop)
        shipment_data = {
            "shipment_id": payload.shipment_id,
            "cargo_type": payload.cargo_type,
            "commercial_value_usd": payload.commercial_value_usd,
            "incident_context": masked_incident_context,
            "iot_telemetry_history": sanitized_telemetry
        }
        
        scorer = LiabilityScorer(shipment_data, terms)
        result = scorer.run_debate_loop(mock=mock_mode)
        
        # 5. Apply Output Guardrails
        if "final_structured_report" in result:
            result["final_structured_report"] = apply_output_guardrails(
                result["final_structured_report"],
                payload.commercial_value_usd
            )
        
        # 6. Generate and save PDF server-side in tms_claims/
        tms_claims_dir = os.path.join(os.getcwd(), "tms_claims")
        os.makedirs(tms_claims_dir, exist_ok=True)
        
        telemetry_hash = compute_canonical_hash(sanitized_telemetry)
        terms_hash = compute_canonical_hash(terms)
        input_seal = hashlib.sha256(f"{telemetry_hash}:{terms_hash}".encode('utf-8')).hexdigest()
        
        pdf_payload = {
            "shipment_id": payload.shipment_id,
            "cargo_type": payload.cargo_type,
            "commercial_value": payload.commercial_value_usd,
            "extracted_terms": terms,
            "report": result.get("final_structured_report", {}),
            "input_seal": input_seal
        }
        pdf_bytes = generate_claim_pdf(pdf_payload)
        
        # Register in audit chain registry
        register_audit_seal(
            shipment_id=payload.shipment_id,
            telemetry=sanitized_telemetry,
            extracted_terms=terms,
            pdf_bytes=pdf_bytes
        )
        
        clean_shipment_id = re.sub(r'[^a-zA-Z0-9.\-_]', '_', payload.shipment_id)
        pdf_filename = f"claim_report_{clean_shipment_id}.pdf"
        pdf_dest_path = os.path.join(tms_claims_dir, pdf_filename)
        with open(pdf_dest_path, "wb") as f:
            f.write(pdf_bytes)
        
        # 7. Update tms_events.json
        from datetime import datetime
        event_id = f"EV-{int(datetime.utcnow().timestamp())}-{clean_shipment_id[:10]}"
        event_log_item = {
            "event_id": event_id,
            "tms_system": payload.tms_system,
            "event_type": payload.event_type,
            "shipment_id": payload.shipment_id,
            "cargo_type": payload.cargo_type,
            "commercial_value_usd": payload.commercial_value_usd,
            "received_at": datetime.utcnow().isoformat() + "Z",
            "status": "Completed",
            "extracted_terms": terms,
            "report": result.get("final_structured_report"),
            "assessor_output": result.get("assessor_output"),
            "legal_output": result.get("legal_output"),
            "dispatcher_output": result.get("dispatcher_output"),
            "pdf_path": f"tms_claims/{pdf_filename}"
        }
        
        events_file = os.path.join(os.getcwd(), "tms_events.json")
        events_list = []
        if os.path.exists(events_file):
            try:
                with open(events_file, "r", encoding="utf-8") as f:
                    events_list = json.load(f)
            except Exception:
                events_list = []
                
        events_list.insert(0, event_log_item)
        with open(events_file, "w", encoding="utf-8") as f:
            json.dump(events_list, f, indent=2, ensure_ascii=False)
            
        return {
            "success": True,
            "event_id": event_id,
            "status": "Completed",
            "pdf_path": f"tms_claims/{pdf_filename}"
        }
    except Exception as e:
        print(f"TMS Webhook Error: {str(e)}", file=sys.stderr)
        raise HTTPException(status_code=500, detail=f"TMS Webhook failed: {str(e)}")

@app.get("/v1/tms/events")
def get_tms_events():
    events_file = os.path.join(os.getcwd(), "tms_events.json")
    if not os.path.exists(events_file):
        return []
    try:
        with open(events_file, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read events: {str(e)}")

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
    chain_file = os.path.join(os.getcwd(), "audit_chain.json")
    if not os.path.exists(chain_file):
        return []
    try:
        with open(chain_file, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read audit chain: {str(e)}")

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
        
        # Read ledger
        chain_file = os.path.join(os.getcwd(), "audit_chain.json")
        records = []
        if os.path.exists(chain_file):
            try:
                with open(chain_file, "r", encoding="utf-8") as f:
                    records = json.load(f)
            except Exception:
                records = []
        
        # Find matching record in ledger
        matching_record = None
        for r in records:
            if r.get("pdf_hash") == uploaded_pdf_hash:
                matching_record = r
                break
        if not matching_record and shipment_id:
            for r in records:
                if r.get("shipment_id") == shipment_id:
                    matching_record = r
                    break
                    
        if not matching_record:
            return {
                "success": True,
                "status": "NOT_FOUND",
                "message": "No registered cryptographic seal matches this document or shipment ID.",
                "uploaded_pdf_hash": uploaded_pdf_hash
            }
        
        record_shipment_id = matching_record.get("shipment_id")
        stored_pdf_hash = matching_record.get("pdf_hash")
        stored_telemetry_hash = matching_record.get("telemetry_hash")
        stored_terms_hash = matching_record.get("terms_hash")
        
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
            "timestamp": matching_record.get("timestamp"),
            "telemetry_verified": telemetry_verified,
            "terms_verified": terms_verified,
            "pdf_verified": pdf_verified,
            "stored_hashes": {
                "telemetry_hash": stored_telemetry_hash,
                "terms_hash": stored_terms_hash,
                "pdf_hash": stored_pdf_hash,
                "combined_hash": matching_record.get("combined_hash")
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
