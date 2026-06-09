import os
import sys
import json
from openai import OpenAI

def load_dotenv(env_path=".env"):
    """Manually load dotenv if .env exists, to support local/server key ingestion."""
    if os.path.exists(env_path):
        with open(env_path, "r") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, val = line.split("=", 1)
                    os.environ[key.strip()] = val.strip().strip('"').strip("'")

# Pre-defined high-quality offline knowledge graph data to act as a fallback
FALLBACK_KNOWLEDGE_GRAPH = {
    "conventions": [
        {
            "name": "Hague-Visby Rules",
            "description": "International convention governing carriage of goods by sea, detailing carrier rights, immunities, and liabilities.",
            "exemption_clauses": [
                {
                    "keyword": "Act of God",
                    "clause_reference": "Article IV, Rule 2(d)",
                    "description": "Natural disasters or extreme physical events occurring without human intervention or control.",
                    "liability_mapping": "Exempts carrier from liability if cargo damage is caused directly by storms, lightning, or other natural catastrophes."
                },
                {
                    "keyword": "Perils of the Sea",
                    "clause_reference": "Article IV, Rule 2(c)",
                    "description": "Dangers, accidents, and hazards peculiar to marine navigation that could not be avoided by reasonable care.",
                    "liability_mapping": "Exempts carrier if the damage is caused by sea hazards (e.g., rogue waves, collisions) despite sea-worthiness."
                },
                {
                    "keyword": "Act of War",
                    "clause_reference": "Article IV, Rule 2(e)",
                    "description": "Damage or destruction of cargo arising from military conflicts, hostile acts of nations, or warfare.",
                    "liability_mapping": "Exempts carrier if cargo is damaged or lost due to warfare, combat operations, or military actions."
                }
                # ... (more items)
            ]
        }
    ],
    "physical_formulas": [
        {
            "name": "Arrhenius Equation",
            "latex": "k = A * e^{-E_a / (R * T)}",
            "description": "Models the temperature dependence of chemical and biological reaction rates, calculating food/pharma degradation velocities.",
            "variables": {
                "k": "Reaction velocity rate constant (fractional decay per hour)",
                "A": "Pre-exponential frequency factor",
                "E_a": "Activation energy of the degradation reaction (J/mol)",
                "R": "Universal gas constant (8.314 J/(mol*K))",
                "T": "Absolute temperature in Kelvin (T_K = T_C + 273.15)"
            },
            "python_code": "def arrhenius_degradation_rate(A, Ea, temp_celsius):\n    import math\n    R = 8.314\n    temp_kelvin = temp_celsius + 273.15\n    return A * math.exp(-Ea / (R * temp_kelvin))"
        }
    ]
}

def query_ai_for_knowledge_graph(api_key, provider="deepseek"):
    """Use DeepSeek or Gemini to fetch real grounded legal/physical specifications."""
    prompt = """
    You are ChainGuard AI's Domain Knowledge Engineer. We are building the knowledge scaffolding for ChainGuard AI 2.0.
    Generate a highly accurate, structured JSON document containing:
    1. A list of Conventions:
       - 'Hague-Visby Rules': Cover at least 15 liability exemption keywords.
       - 'Montreal Convention': Cover at least 4 air cargo exemptions.
       - 'Cold Chain Management Science Guidelines': Cover 2 practical exclusions.
    
    2. A list of Physical Formulas:
       - 'Arrhenius Equation'
       - 'Q10 Temperature Coefficient'
       - 'Kinetic Shelf Life Degradation Model'

    Output must strictly follow this JSON structure:
    {
      "conventions": [
        {
          "name": "Convention Name",
          "description": "Convention description",
          "exemption_clauses": [
            {
              "keyword": "Exemption Keyword",
              "clause_reference": "Article/Rule Reference",
              "description": "Detailed explanation",
              "liability_mapping": "Carrier/Shipper/Port"
            }
          ]
        }
      ],
      "physical_formulas": [
        {
          "name": "Formula Name",
          "latex": "LaTeX math representation",
          "description": "Description",
          "variables": { "symbol": "meaning" },
          "python_code": "def func()..."
        }
      ]
    }
    """
    
    if provider == "deepseek":
        print("Connecting to DeepSeek API...", file=sys.stderr)
        client = OpenAI(api_key=api_key, base_url="https://api.deepseek.com")
        response = client.chat.completions.create(
            model="deepseek-chat",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"}
        )
        return json.loads(response.choices[0].message.content)
    else:
        from google import genai
        from google.genai import types
        print("Connecting to Gemini API...", file=sys.stderr)
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json"
            )
        )
        return json.loads(response.text.strip())

def main():
    load_dotenv()
    deepseek_key = os.environ.get("DEEPSEEK_API_KEY")
    gemini_key = os.environ.get("GEMINI_API_KEY")
    
    knowledge_graph = None
    try:
        if deepseek_key:
            knowledge_graph = query_ai_for_knowledge_graph(deepseek_key, provider="deepseek")
        elif gemini_key:
            knowledge_graph = query_ai_for_knowledge_graph(gemini_key, provider="gemini")
        else:
            print("No API key found. Using fallback.")
            knowledge_graph = FALLBACK_KNOWLEDGE_GRAPH
    except Exception as e:
        print(f"AI Query failed: {e}. Using fallback.")
        knowledge_graph = FALLBACK_KNOWLEDGE_GRAPH

    with open("knowledge_graph.json", "w", encoding="utf-8") as f:
        json.dump(knowledge_graph, f, indent=2, ensure_ascii=False)
    
    print("Knowledge Graph updated successfully.")
    return 0

if __name__ == "__main__":
    main()
