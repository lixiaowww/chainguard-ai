import os
import sys
import json
from openai import OpenAI
from crewai import LLM, Agent, Task, Crew

class LiabilityScorer:
    def __init__(self, shipment_data, contract_terms, knowledge_graph_path="knowledge_graph.json"):
        self.shipment_data = shipment_data
        self.contract_terms = contract_terms
        self.kg_path = knowledge_graph_path
        self.kg = self._load_knowledge_graph()

    def _load_knowledge_graph(self):
        kg_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), self.kg_path)
        if os.path.exists(kg_path):
            try:
                with open(kg_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                print(f"Error loading knowledge graph: {e}", file=sys.stderr)
        return {}

    def _load_verified_cases(self):
        cases_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "verified_cases")
        cases = []
        if os.path.exists(cases_dir):
            for file in os.listdir(cases_dir):
                if file.endswith(".json"):
                    try:
                        with open(os.path.join(cases_dir, file), "r", encoding="utf-8") as f:
                            cases.append(json.load(f))
                    except Exception as e:
                        print(f"Error loading verified case {file}: {e}", file=sys.stderr)
        return cases

    def run_debate_loop(self, mock=False):
        if mock:
            return self._run_mock_debate()
        else:
            return self._run_live_debate()

    def _get_llm(self):
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

    def _run_live_debate(self):
        llm = self._get_llm()

        shipment_id = self.shipment_data.get("shipment_id", "N/A")
        cargo_type = self.shipment_data.get("cargo_type")
        commercial_value = self.shipment_data.get("commercial_value_usd", 0)
        incident_context = self.shipment_data.get("incident_context", "")
        telemetry = self.shipment_data.get("iot_telemetry_history", [])
        
        telemetry_summary = json.dumps(telemetry, indent=2)
        
        contract_details = f"""
        - Deductible: {self.contract_terms.get('deductible')}
        - Exclusions / Disclaimers: {self.contract_terms.get('exclusions')}
        - Liability Limits: {self.contract_terms.get('liability_limits')}
        """

        # Format conventions and exemptions for Legal Officer RAG grounding
        conventions_text = ""
        for conv in self.kg.get("conventions", []):
            conventions_text += f"\n### {conv.get('name')}\n{conv.get('description')}\nExemptions:\n"
            for clause in conv.get("exemption_clauses", []):
                conventions_text += f"- {clause.get('keyword')} ({clause.get('clause_reference')}): {clause.get('description')} | Mapping: {clause.get('liability_mapping')}\n"

        # Load verified historical case studies for few-shot prompting RAG
        verified_cases = self._load_verified_cases()
        if verified_cases:
            conventions_text += "\n### Historical User-Verified Claims & Precedents (RAG Case Study Reference):\n"
            for idx, case in enumerate(verified_cases):
                orig = case.get("original_report", {})
                corr = case.get("corrected_liability", {})
                conventions_text += f"\nPrecedent Case Study #{idx+1}:\n"
                conventions_text += f"- Cargo Type: {case.get('cargo_type')}\n"
                conventions_text += f"- Incident Context: {case.get('incident_context')}\n"
                conventions_text += f"- Original AI Allocation: {orig.get('liability_assignment', {}).get('liable_party')} ({orig.get('liability_assignment', {}).get('fault_percentage')}% fault)\n"
                conventions_text += f"- User-Corrected Final Allocation: {corr.get('liable_party')} ({corr.get('fault_percentage')}% fault)\n"
                conventions_text += f"- Correction Reason/Notes: {corr.get('notes', 'N/A')}\n"

        # Format biological/physical formulas for Assessor grounding
        formulas_text = ""
        for formula in self.kg.get("physical_formulas", []):
            formulas_text += f"\n### {formula.get('name')} (Formula: {formula.get('latex')})\n{formula.get('description')}\nVariables:\n"
            for var, desc in formula.get("variables", {}).items():
                formulas_text += f"  - {var}: {desc}\n"
            formulas_text += f"Python Code Reference:\n```python\n{formula.get('python_code')}\n```\n"

        # Agent 1: Cargo Damage Assessor (Physics Agent)
        assessor = Agent(
            role="Cargo Damage Assessor (货损评估师)",
            goal="Evaluate perishable cargo's physical and biological degradation and determine exact financial damage.",
            backstory=f"""You are a world-class cold-chain logistics bio-physicist. 
            You specialize in calculating product shelf-life decay using Arrhenius equations and physical/chemical thresholds.
            You take telemetry history and cargo types to calculate spoilage and financial loss in USD.
            
            You MUST ground your evaluations and shelf-life calculations in the following scientific formulas:
            {formulas_text}""",
            llm=llm,
            verbose=True
        )

        # Agent 2: Liability Legal Officer (Legal Agent)
        legal_officer = Agent(
            role="Liability Legal Officer (定责法务官)",
            goal="Analyze liability, parse contract exclusions/deductibles, and assign fault percentage.",
            backstory=f"""You are an expert in international maritime, carriage of goods, and supply chain law.
            You specialize in analyzing SLAs, carrier exemptions, shipper obligations, disclaimers, and applying deductibles and liability limits to compute net insurance claims.
            
            You MUST evaluate liability in accordance with the following international conventions and guidelines:
            {conventions_text}""",
            llm=llm,
            verbose=True
        )

        # Agent 3: Emergency Dispatcher & Aggregator
        dispatcher = Agent(
            role="Emergency Dispatcher (应急调度员)",
            goal="Generate emergency operational procedures, salvage checklists, and claimant legal wording.",
            backstory="""You are a veteran logistics emergency responder. You coordinate salvage, rerouting, active cooling, product disposal, and compile final documentation for insurance claimants.""",
            llm=llm,
            verbose=True
        )

        # Task 1: Damage Assessment
        task_damage = Task(
            description=f"""
            Analyze the telemetry history and cargo type details for Shipment {shipment_id}:
            - Cargo Type: {cargo_type}
            - Commercial Value: ${commercial_value} USD
            - IoT Telemetry History:
            {telemetry_summary}
            
            Perishable rules:
            - Cherries: Spoilage occurs above 10°C. 100% spoilage if >6 hours above 15°C.
            - Bio-Pharma (vaccines): Spoilage if >25°C for 15+ minutes or <0°C.
            - Wine: Damage if >28°C (50% or 100% loss) or shock >3G.
            
            Calculate:
            1. Whether the cargo is in NORMAL, PARTIAL_DAMAGE, or TOTAL_LOSS.
            2. The biological/physical degradation reasoning, citing telemetry points.
            3. The estimated raw loss value in USD (cannot exceed declared commercial value).
            """,
            expected_output="Detailed biophysical degradation analysis and financial loss in USD.",
            agent=assessor
        )

        # Task 2: Initial Liability Assessment
        task_liability = Task(
            description=f"""
            Review the damage assessment from the Assessor, the incident context: "{incident_context}", and the contract terms:
            {contract_details}
            
            Determine:
            1. Who is strictly responsible (Carrier, Shipper, Port Authority, Force Majeure, or Shared).
            2. Proportional fault percentage (0 to 100).
            3. Apply the contract Deductible (e.g. deduct it from the estimated loss to find the net claimable amount) and enforce the Contract Liability Cap (e.g. if the cap is 60%, the claim cannot exceed 60% of commercial value).
            4. Detail the contractual disclaimer analysis (e.g. check if the carrier is exempt due to customs delay, force majeure, or shipper pre-cooling failures).
            5. Cite exact sensor timestamps and telemetry events to justify your assignment.
            """,
            expected_output="Fault assignment, deductible calculations, liability cap enforcement, and contract clause citations.",
            agent=legal_officer,
            context=[task_damage]
        )

        # Task 3: Biophysical Rebuttal & Cross-Examination (Debate Loop Phase 2)
        task_rebuttal = Task(
            description=f"""
            Review the initial liability assessment and check if any liability exemptions (such as customs delays, pre-cooling failure, or force majeure) were claimed.
            Cross-examine these claims against the physical telemetry data:
            - Did the temperature excursions happen during the exempt period (e.g. while delayed at customs) or did they happen before/after?
            - Does the telemetry support the claim that the carrier maintained cooling during the delay?
            Provide a physical rebuttal either confirming the exemption or proving carrier negligence.
            """,
            expected_output="Scientific verification/rebuttal of liability exemption claims based on telemetry history.",
            agent=assessor,
            context=[task_damage, task_liability]
        )

        # Task 4: Final Liability Allocation & Emergency Dispatch
        task_dispatch = Task(
            description=f"""
            Review the biophysical rebuttal and the initial liability assessment.
            Produce:
            1. Dynamic salvage instructions (e.g., re-chill, reject, repackage, accelerate transit).
            2. Driver/receiver guidelines.
            3. A formal insurance claim filing text, including the case code (e.g. SHELF_LIFE_Arrhenius_3.5) and evidentiary summary.
            4. Synthesize all findings into a structured report.
            """,
            expected_output="Emergency salvage list, claim draft text, and operational recovery items.",
            agent=dispatcher,
            context=[task_damage, task_liability, task_rebuttal]
        )

        # Run Crew
        crew = Crew(
            agents=[assessor, legal_officer, dispatcher],
            tasks=[task_damage, task_liability, task_rebuttal, task_dispatch],
            verbose=True
        )
        
        crew.kickoff()
        
        # Compile final JSON structure using AI
        synthesis_prompt = f"""
        You are the Core Intelligence compiler. Based on the reports produced by the agents in their debate cycle, extract and format the data into a perfect JSON document matching the required schema.

        === SCHEMA REQUIRED ===
        {{
          "incident_summary": "Summary of what went wrong, citing telemetry.",
          "damage_assessment": {{
            "status": "PARTIAL_DAMAGE" or "TOTAL_LOSS" or "NORMAL",
            "estimated_loss_usd": number (the final net loss in USD, taking into account deductibles and liability caps from the legal officer),
            "scientific_reasoning": "Scientific reasoning details including degradation rates."
          }},
          "liability_assignment": {{
            "liable_party": "Carrier" or "Shipper" or "Port Authority" or "Force Majeure" or "Shared",
            "fault_percentage": number (0 to 100),
            "evidence_citation": "Telemetry citations, timestamps, and contract clause applications."
          }},
          "action_items": [
            "Action item 1",
            "Action item 2",
            "..."
          ]
        }}

        === DEBATE REPORTS ===
        Initial Assessor Report:
        {task_damage.output.raw}

        Initial Legal Officer Report:
        {task_liability.output.raw}

        Biophysical Rebuttal:
        {task_rebuttal.output.raw}

        Final Dispatch & Synthesis:
        {task_dispatch.output.raw}
        """
        
        if os.environ.get("DEEPSEEK_API_KEY"):
            client = OpenAI(api_key=os.environ.get("DEEPSEEK_API_KEY"), base_url="https://api.deepseek.com")
            response = client.chat.completions.create(
                model="deepseek-chat",
                messages=[{"role": "user", "content": synthesis_prompt}],
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
                contents=synthesis_prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json"
                )
            )
            content = response.text
        
        try:
            final_report = json.loads(content.strip())
        except Exception as e:
            print(f"Error compiling final JSON: {e}", file=sys.stderr)
            # Safe fallback structure
            final_report = {
                "incident_summary": "Error parsing reports into JSON.",
                "damage_assessment": {
                    "status": "TOTAL_LOSS",
                    "estimated_loss_usd": commercial_value,
                    "scientific_reasoning": "Error compiling details."
                },
                "liability_assignment": {
                    "liable_party": "Shared",
                    "fault_percentage": 50,
                    "evidence_citation": "Error compiling details."
                },
                "action_items": ["Manually review the text logs."]
            }

        return {
            "assessor_output": task_damage.output.raw + "\n\nRebuttal:\n" + task_rebuttal.output.raw,
            "legal_output": task_liability.output.raw,
            "dispatcher_output": task_dispatch.output.raw,
            "final_structured_report": final_report
        }

    def _run_mock_debate(self):
        cargo_type = self.shipment_data.get("cargo_type", "")
        commercial_value = self.shipment_data.get("commercial_value_usd", 0.0)
        incident_context = self.shipment_data.get("incident_context", "")
        telemetry = self.shipment_data.get("iot_telemetry_history", [])
        
        is_cherries = "cherries" in cargo_type.lower()
        is_pharma = "pharma" in cargo_type.lower() or "vaccine" in cargo_type.lower() or "insulin" in cargo_type.lower()
        is_wine = "wine" in cargo_type.lower()
        
        has_temp_spike = any(pt.get("temperature", 0) > 10.0 for pt in telemetry)
        has_critical_temp_spike = any(pt.get("temperature", 0) > 25.0 for pt in telemetry)
        has_shock = any(pt.get("shock_g", 0) > 3.0 for pt in telemetry)
        
        status = "NORMAL"
        loss = 0.0
        scientific = "No critical threshold violation observed."
        liable_party = "None"
        fault_pct = 0
        evidence = "Telemetry within normal parameters."
        
        if is_cherries:
            if "customs" in incident_context.lower():
                status = "PARTIAL_DAMAGE"
                scientific = "Telemetry confirms temperature was steady, but delay occurred at customs for 12 hours. Cherry shelf-life reduced due to natural biological aging (Arrhenius degradation) during customs clearance delay."
                liable_party = "Port Authority"
                fault_pct = 100
                evidence = "Customs clearance delay of 12 hours. As per contract Clause 3.4 exclusions, customs delays exempt the carrier. Thus, Port Authority is assigned 100% liability."
                loss = commercial_value * 0.60
            elif has_temp_spike:
                status = "PARTIAL_DAMAGE"
                loss = commercial_value * 0.40
                scientific = "Temperature spiked above 10.0°C for multiple hours, leading to premature biological ripening and decay. Shelf-life reduced by 4 days based on Arrhenius rate degradation."
                liable_party = "Carrier"
                fault_pct = 80
                evidence = "Reefer log confirms temperature rose to 15.0°C at 02:00 PM due to cooling compressor shutoff."
                
        elif is_pharma:
            if has_critical_temp_spike or any(pt.get("temperature", 0) < 0 for pt in telemetry):
                status = "TOTAL_LOSS"
                scientific = "Temperature exceeded 25°C threshold / dropped below 0°C freezing threshold. Biological proteins denatured instantly, rendering vaccines unusable."
                liable_party = "Carrier"
                fault_pct = 100
                evidence = "Sensor spiked to 26.5°C for 25 minutes, exceeding the 15-minute SLA limit."
                loss = commercial_value
                
        elif is_wine:
            if has_shock:
                status = "PARTIAL_DAMAGE"
                loss = min(commercial_value, 15000.0)
                scientific = "Physical shock registered at 5.2G, exceeding the 3.0G handling threshold. Severe vibration caused structural damage and cork loosening."
                liable_party = "Carrier"
                fault_pct = 90
                evidence = "Mechanical impact sensor registered 5.2G shock at 04:00 PM during loading/unloading."

        assessor_txt = f"Cargo Damage Assessor Report:\nIntegrated telemetry analysis reveals cargo is in a state of {status}.\nLoss calculated: ${loss:.2f} USD.\nReasoning: {scientific}"
        legal_txt = f"Liability Legal Officer Report:\nLiability determined: {liable_party} is {fault_pct}% liable.\nContractual check: Deductible applied. Exclusions checked: {self.contract_terms.get('exclusions')}\nEvidence: {evidence}"
        dispatcher_txt = f"Emergency Dispatcher Report:\nAction items formulated:\n1. Move cargo to cold storage immediately.\n2. Reject shipment if TOTAL_LOSS.\n3. File insurance claim specifying code SHELF_LIFE_Arrhenius_3.5."

        # Apply liability limit capping
        if is_cherries and "60%" in self.contract_terms.get("liability_limits", ""):
            capped_loss = commercial_value * 0.60
            if loss > capped_loss:
                loss = capped_loss
                legal_txt += f"\nNote: Loss capped at 60% of declared value (${capped_loss}) per contract terms."
                
        return {
            "assessor_output": assessor_txt,
            "legal_output": legal_txt,
            "dispatcher_output": dispatcher_txt,
            "final_structured_report": {
                "incident_summary": f"Cold chain integrity breach occurred for Shipment {self.shipment_data.get('shipment_id')} containing {cargo_type}.",
                "damage_assessment": {
                    "status": status,
                    "estimated_loss_usd": loss,
                    "scientific_reasoning": scientific
                },
                "liability_assignment": {
                    "liable_party": liable_party,
                    "fault_percentage": fault_pct,
                    "evidence_citation": evidence
                },
                "action_items": [
                    "Isolate affected crates for inspection.",
                    "File formal notice of claim with carrier within contract SLA deadline.",
                    "Verify reefer power status and check for physical seal tampering."
                ]
            }
        }
