import os
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

def create_pdf(filename, title, shipper, terms):
    os.makedirs(os.path.dirname(filename), exist_ok=True)
    doc = SimpleDocTemplate(filename, pagesize=letter, rightMargin=54, leftMargin=54, topMargin=54, bottomMargin=54)
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=colors.HexColor('#1a365d'),
        spaceAfter=15
    )
    
    section_style = ParagraphStyle(
        'DocSection',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=14,
        leading=18,
        textColor=colors.HexColor('#2c5282'),
        spaceBefore=12,
        spaceAfter=6
    )
    
    body_style = ParagraphStyle(
        'DocBody',
        parent=styles['BodyText'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#2d3748'),
        spaceAfter=10
    )
    
    highlight_style = ParagraphStyle(
        'DocHighlight',
        parent=styles['BodyText'],
        fontName='Helvetica-BoldOblique',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#b7791f'),
        spaceAfter=10
    )

    story = []
    
    # Title
    story.append(Paragraph(title, title_style))
    story.append(Paragraph(f"<b>Shipper:</b> {shipper}", body_style))
    story.append(Spacer(1, 12))
    
    # Standard Clauses
    story.append(Paragraph("1. Purpose & Scope", section_style))
    story.append(Paragraph("This logistics agreement governs the transportation of cold-chain cargo and establishes compliance requirements, temperature boundaries, and liability guidelines between the Carrier and the Shipper.", body_style))
    
    # Dynamic SLA terms
    story.append(Paragraph("2. Cold-Chain SLA & Liability Limits", section_style))
    story.append(Paragraph(f"<b>Liability Limit:</b> {terms['liability_limits']}", body_style))
    
    story.append(Paragraph("3. Claim Exclusions and Disclaimers", section_style))
    story.append(Paragraph(f"<b>Disclaimer Exclusions:</b> {terms['exclusions']}", body_style))
    
    story.append(Paragraph("4. Deductible Clauses", section_style))
    story.append(Paragraph(f"<b>Deductible Amount:</b> {terms['deductible']}", highlight_style))
    
    story.append(Paragraph("5. Governing Law and Arbitration", section_style))
    story.append(Paragraph("This contract shall be construed in accordance with the Maritime Law and commercial transport codes. All disputes regarding cargo damage, biological spoilage, and operational negligence shall be settled through binding arbitration under the rules of the International Chamber of Commerce.", body_style))

    doc.build(story)
    print(f"Created PDF contract: {filename}")

if __name__ == "__main__":
    contracts = {
        "contracts/cherries_sla_agreement.pdf": {
            "title": "Fresh Fruits Transportation SLA Agreement",
            "shipper": "FreshProduce Corp",
            "terms": {
                "deductible": "Deductible: $5,000 USD per shipment event.",
                "exclusions": "The carrier is exempt from liability if the temperature deviation is due to customs clearing delays or shipper's failure to pre-cool the cargo before loading. Standard reefer failure is covered only if it lasts more than 4 continuous hours.",
                "liability_limits": "Maximum liability capped at 60% of commercial value of the damaged perishable goods."
            }
        },
        "contracts/pharma_global_transport.pdf": {
            "title": "Biological Assets & Cold-Chain Logistics Protocol",
            "shipper": "BioPharma Global",
            "terms": {
                "deductible": "Deductible: $10,000 USD per temperature excursion event.",
                "exclusions": "The carrier is fully liable for any temperature excursion above 25°C lasting longer than 15 minutes, or freezing temperatures below 0°C, unless caused by documented port strikes. Frozen temperature failures must be reported within 2 hours of arrival.",
                "liability_limits": "100% full cargo commercial value recovery up to $1,000,000 USD."
            }
        },
        "contracts/wine_logistics_spec.pdf": {
            "title": "Premium Vintage Carriage & Safety Specification",
            "shipper": "Chateau Fine Wines",
            "terms": {
                "deductible": "Deductible: $2,500 USD per shipment event.",
                "exclusions": "Mechanical shock limit set strictly at 3.0G. The carrier is liable for cracked bottles or cork-pushing from temperatures exceeding 28°C, except in cases of Force Majeure (extreme weather events or acts of God).",
                "liability_limits": "Liability capped at $50,000 USD maximum per shipment."
            }
        }
    }
    
    for path, data in contracts.items():
        create_pdf(path, data["title"], data["shipper"], data["terms"])
