import os
import json
from sqlalchemy import create_engine, Column, String, Float, Text, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///chainguard.db")

# Standardize connection string for SQLAlchemy + Psycopg2
if DATABASE_URL.startswith("postgresql://") and "pgbouncer=true" in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.replace("pgbouncer=true", "").replace("??", "?").rstrip("?")

engine = create_engine(
    DATABASE_URL, connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class Base(DeclarativeBase):
    pass

class AuditSeal(Base):
    __tablename__ = "audit_seals"
    
    shipment_id = Column(String, primary_key=True, index=True)
    timestamp = Column(String, nullable=False)
    telemetry_hash = Column(String, nullable=False)
    terms_hash = Column(String, nullable=False)
    pdf_hash = Column(String, nullable=False)
    combined_hash = Column(String, nullable=False)
    anchored_tx_id = Column(String, nullable=True)

class TMSEvent(Base):
    __tablename__ = "tms_events"
    
    event_id = Column(String, primary_key=True, index=True)
    tms_system = Column(String, nullable=False)
    event_type = Column(String, nullable=False)
    shipment_id = Column(String, nullable=False, index=True)
    cargo_type = Column(String, nullable=False)
    commercial_value_usd = Column(Float, nullable=False)
    received_at = Column(String, nullable=False)
    status = Column(String, nullable=False)
    extracted_terms = Column(Text, nullable=True)  # JSON-encoded string
    report = Column(Text, nullable=True)           # JSON-encoded string
    assessor_output = Column(Text, nullable=True)
    legal_output = Column(Text, nullable=True)
    dispatcher_output = Column(Text, nullable=True)
    pdf_path = Column(String, nullable=False)

def init_db():
    Base.metadata.create_all(bind=engine)
    
    # Run dynamic migration if column missing
    db = SessionLocal()
    try:
        db.execute(text("ALTER TABLE audit_seals ADD COLUMN anchored_tx_id VARCHAR;"))
        db.commit()
        print("[Database] Migrated audit_seals: added anchored_tx_id column.")
    except Exception:
        db.rollback()
    finally:
        db.close()
    
    db = SessionLocal()
    try:
        # Migrate audit seals
        if db.query(AuditSeal).count() == 0:
            chain_file = os.path.join(os.getcwd(), "audit_chain.json")
            if os.path.exists(chain_file):
                try:
                    with open(chain_file, "r", encoding="utf-8") as f:
                        records = json.load(f)
                    for r in records:
                        seal = AuditSeal(
                            shipment_id=r["shipment_id"],
                            timestamp=r["timestamp"],
                            telemetry_hash=r["telemetry_hash"],
                            terms_hash=r["terms_hash"],
                            pdf_hash=r["pdf_hash"],
                            combined_hash=r["combined_hash"]
                        )
                        db.merge(seal)
                    db.commit()
                    print(f"[Database] Migrated {len(records)} audit seals from JSON.")
                except Exception as e:
                    print(f"[Database] Error migrating audit seals: {e}")
                    db.rollback()
        
        # Migrate TMS events
        if db.query(TMSEvent).count() == 0:
            events_file = os.path.join(os.getcwd(), "tms_events.json")
            if os.path.exists(events_file):
                try:
                    with open(events_file, "r", encoding="utf-8") as f:
                        events = json.load(f)
                    for ev in events:
                        event = TMSEvent(
                            event_id=ev["event_id"],
                            tms_system=ev["tms_system"],
                            event_type=ev["event_type"],
                            shipment_id=ev["shipment_id"],
                            cargo_type=ev["cargo_type"],
                            commercial_value_usd=ev["commercial_value_usd"],
                            received_at=ev["received_at"],
                            status=ev["status"],
                            extracted_terms=json.dumps(ev.get("extracted_terms")),
                            report=json.dumps(ev.get("report")),
                            assessor_output=ev.get("assessor_output"),
                            legal_output=ev.get("legal_output"),
                            dispatcher_output=ev.get("dispatcher_output"),
                            pdf_path=ev.get("pdf_path")
                        )
                        db.merge(event)
                    db.commit()
                    print(f"[Database] Migrated {len(events)} TMS events from JSON.")
                except Exception as e:
                    print(f"[Database] Error migrating TMS events: {e}")
                    db.rollback()
    finally:
        db.close()
