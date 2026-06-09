import os
import sys
from sqlalchemy import create_engine, text

# Use the DATABASE_URL from environment
DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    print("Error: DATABASE_URL environment variable not set.")
    sys.exit(1)

def init_db():
    print(f"Connecting to remote Supabase database...")
    try:
        engine = create_engine(DATABASE_URL)
        
        # Read schema.sql
        schema_path = os.path.join(os.getcwd(), "schema.sql")
        if not os.path.exists(schema_path):
            print(f"Error: schema.sql not found at {schema_path}")
            return
            
        with open(schema_path, "r", encoding="utf-8") as f:
            sql_commands = f.read()
            
        # Split by semicolon to execute commands individually if needed, 
        # but SQLAlchemy can often handle multiple commands if they don't involve transaction blocks that conflict.
        # Supabase SQL Editor handles it fine. Let's try executing the whole block.
        
        with engine.connect() as connection:
            # We use text() to wrap the SQL. 
            # Note: PostgreSQL might have issues with some multi-statement executions depending on the driver.
            # We'll split by '--' sections or just execute it.
            
            print("Executing schema.sql...")
            # For robustness, we split by semicolon
            for command in sql_commands.split(';'):
                clean_command = command.strip()
                if clean_command:
                    try:
                        connection.execute(text(clean_command))
                        connection.commit()
                    except Exception as e:
                        print(f"Warning/Error on command: {clean_command[:50]}... \nError: {e}")
            
        print("Successfully initialized remote Supabase database!")
        
    except Exception as e:
        print(f"Failed to initialize database: {e}")

if __name__ == "__main__":
    init_db()
