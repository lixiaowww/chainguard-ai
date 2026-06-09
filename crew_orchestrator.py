import os
import sys
import json
import argparse
from openai import OpenAI
from langchain_community.document_loaders import PyPDFLoader
from crewai import LLM, Agent, Task, Crew
from liability_scorer import LiabilityScorer

def get_llm():
    if os.environ.get("DEEPSEEK_API_KEY"):
        return LLM(
            model="deepseek/deepseek-chat",
            base_url="https://api.deepseek.com",
            api_key=os.environ.get("DEEPSEEK_API_KEY")
        )
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("Neither DEEPSEEK_API_KEY nor GEMINI_API_KEY environment variable is found.")
    return LLM(model="gemini/gemini-1.5-flash", api_key=api_key)

def load_and_extract_contract_terms(pdf_path, mock=False):
    """
    RAG Component: Reads the insurance contract PDF via LangChain's PyPDFLoader
    and extracts terms (deductibles, disclaimers, liability limits).
    """
    if mock:
        # Provide realistic mock terms based on known file names if mock flag is set
        if "cherries" in pdf_path.lower():
            return {
                "deductible": "Deductible: $5,000 USD per shipment event.",
                "exclusions": "The carrier is exempt from liability if the temperature deviation is due to customs clearing delays or shipper's failure to pre-cool the cargo before loading. Standard reefer failure is covered only if it lasts more than 4 continuous hours.",
                "liability_limits": "Maximum liability capped at 60% of commercial value of the damaged perishable goods.",
                "raw_contract_text": """COLD CHAIN CARRIAGE SLA AGREEMENT (CHERRIES)

1. INTRODUCTION & DEFINITIONS
This agreement governs the cold chain transport requirements for fresh cherry shipments.

2. FINANCIAL LIABILITY RULES
Clause 2.1 - Deductible: $5,000 USD per shipment event. This deductible applies to all claims.

3. LIABILITY EXCLUSIONS
Clause 3.4 - Exclusions: The carrier is exempt from liability if the temperature deviation is due to customs clearing delays or shipper's failure to pre-cool the cargo before loading. Standard reefer failure is covered only if it lasts more than 4 continuous hours.

4. OVERALL LIABILITY CAP
Clause 4.2 - Liability Limits: Maximum liability capped at 60% of commercial value of the damaged perishable goods."""
            }
        elif "pharma" in pdf_path.lower():
            return {
                "deductible": "Deductible: $10,000 USD per temperature excursion event.",
                "exclusions": "The carrier is fully liable for any temperature excursion above 25°C lasting longer than 15 minutes, or freezing temperatures below 0°C, unless caused by documented port strikes. Frozen temperature failures must be reported within 2 hours of arrival.",
                "liability_limits": "100% full cargo commercial value recovery up to $1,000,000 USD.",
                "raw_contract_text": """GLOBAL BIOPHARMA TRANSPORT CONTRACT

SECTION A: LOGISTICS STANDARDS
This contract defines carriage terms for high-value biopharmaceutical and vaccine cargo.

SECTION B: DEDUCTIBLE ASSIGNMENT
Clause B.2 - Deductible: $10,000 USD per temperature excursion event.

SECTION C: CARRIER RESPONSIBILITY
Clause C.8 - Exclusions: The carrier is fully liable for any temperature excursion above 25°C lasting longer than 15 minutes, or freezing temperatures below 0°C, unless caused by documented port strikes. Frozen temperature failures must be reported within 2 hours of arrival.

SECTION D: RECOVERY LIMITS
Clause D.5 - Liability Limits: 100% full cargo commercial value recovery up to $1,000,000 USD."""
            }
        else:
            return {
                "deductible": "Deductible: $2,500 USD per shipment event.",
                "exclusions": "Mechanical shock limit set strictly at 3.0G. The carrier is liable for cracked bottles or cork-pushing from temperatures exceeding 28°C, except in cases of Force Majeure (extreme weather events or acts of God).",
                "liability_limits": "Liability capped at $50,000 USD maximum per shipment.",
                "raw_contract_text": """FINE WINES CARRIAGE SPECIFICATION

PART 1: OPERATIONS
Transport specifications for premium fine Burgundy wine cases.

PART 2: LIABILITY DEDUCTIBLES
Section 2.1 - Deductible: $2,500 USD per shipment event.

PART 3: SENSOR LIMITS & EXCLUSIONS
Section 3.2 - Exclusions: Mechanical shock limit set strictly at 3.0G. The carrier is liable for cracked bottles or cork-pushing from temperatures exceeding 28°C, except in cases of Force Majeure (extreme weather events or acts of God).

PART 4: INDEMNITY LIMIT
Section 4.5 - Liability Limits: Liability capped at $50,000 USD maximum per shipment."""
            }
            
    if not os.path.exists(pdf_path):
        raise FileNotFoundError(f"Contract PDF not found at: {pdf_path}")
        
    # Load document using LangChain PyPDFLoader
    loader = PyPDFLoader(pdf_path)
    docs = loader.load()
    full_text = "\n".join([doc.page_content for doc in docs])
    
    # Extract terms using AI API
    prompt = f"""
    You are an expert contract parser. Analyze the following contract text and extract specific terms related to cold chain cargo carriage:
    1. Deductible (免赔额): Look for deductible amounts or clauses.
    2. Exclusions and Disclaimers (免责声明/免责条款): Look for carrier liability exemptions (e.g. customs delays, pre-cooling issues, force majeure).
    3. Liability Limits (责任限制): Look for maximum recovery amounts or percentages.

    Provide the output in JSON format with exactly three keys: 'deductible', 'exclusions', and 'liability_limits'. Make sure values are clear and precise.

    === CONTRACT TEXT ===
    {full_text}
    """
    
    if os.environ.get("DEEPSEEK_API_KEY"):
        client = OpenAI(api_key=os.environ.get("DEEPSEEK_API_KEY"), base_url="https://api.deepseek.com")
        response = client.chat.completions.create(
            model="deepseek-chat",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"}
        )
        content = response.choices[0].message.content
    else:
        from google import genai
        from google.genai import types
        api_key = os.environ.get("GEMINI_API_KEY")
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model="gemini-1.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json"
            )
        )
        content = response.text
    
    try:
        terms = json.loads(content.strip())
        terms["raw_contract_text"] = full_text
        return terms
    except Exception as e:
        print(f"Error parsing AI response JSON: {e}. Raw response: {content}", file=sys.stderr)
        # Fallback keyword parsing in case of failures
        return {
            "deductible": "Not clearly defined (Parsed text fallback)",
            "exclusions": "Not clearly defined (Parsed text fallback)",
            "liability_limits": "Standard SLA terms apply (Parsed text fallback)",
            "raw_contract_text": full_text
        }

def run_crew_analysis(shipment_data, extracted_terms, mock=False):
    """
    Multi-Role Decoupling (CrewAI Component): Coordinates agents to analyze cargo damage,
    assess legal liability using RAG-extracted terms, and generate emergency dispatch actions.
    """
    scorer = LiabilityScorer(shipment_data, extracted_terms)
    return scorer.run_debate_loop(mock=mock)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--pdf_path", required=True)
    parser.add_argument("--cargo_type", required=True)
    parser.add_argument("--commercial_value", type=float, required=True)
    parser.add_argument("--incident_context", default="")
    parser.add_argument("--telemetry_json", required=True)
    parser.add_argument("--mock", action="store_true")
    
    args = parser.parse_args()
    
    try:
        # Load telemetry
        telemetry_data = json.loads(args.telemetry_json)
        
        # 1. RAG
        terms = load_and_extract_contract_terms(args.pdf_path, mock=args.mock)
        
        # 2. CrewAI
        shipment_data = {
            "shipment_id": os.path.basename(args.pdf_path).split(".")[0],
            "cargo_type": args.cargo_type,
            "commercial_value_usd": args.commercial_value,
            "incident_context": args.incident_context,
            "iot_telemetry_history": telemetry_data
        }
        
        result = run_crew_analysis(shipment_data, terms, mock=args.mock)
        
        # Add RAG terms to the result
        result["extracted_terms"] = terms
        
        # Output JSON
        print(json.dumps(result, indent=2, ensure_ascii=False))
        
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
