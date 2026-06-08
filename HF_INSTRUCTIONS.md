# Hugging Face Spaces Deployment Guide (Docker)

To deploy this project to Hugging Face Spaces for free:

### 1. Create a New Space
- Go to [Hugging Face Spaces](https://huggingface.co/spaces).
- Click **Create new Space**.
- **Name**: `chainguard-ai` (or your choice).
- **SDK**: Select **Docker**.
- **Template**: Select **Blank**.
- **Space Hardware**: **CPU basic (2 vCPU - 16GB RAM)** is free and sufficient.

### 2. Configure Environment Variables (Crucial)
Go to **Settings** -> **Variables and secrets** in your Space and add the following:

| Name | Type | Value |
| :--- | :--- | :--- |
| `GEMINI_API_KEY` | Secret | Your Google Gemini API Key |
| `VITE_SUPABASE_URL` | Variable | Your Supabase Project URL |
| `VITE_SUPABASE_ANON_KEY` | Secret | Your Supabase Anon Key |
| `DATABASE_URL` | Secret | Your Supabase PostgreSQL Connection String (e.g., `postgresql://postgres:[password]@db.[id].supabase.co:5432/postgres`) |

### 3. Upload Files
You can use the Hugging Face web interface or `git` to upload all files in the `chainguard-ai` directory to your Space repository.

**Files to include:**
- `Dockerfile` (already created)
- `start.sh` (already created)
- `package.json`
- `requirements.txt`
- `server.ts`
- `api.py`
- `src/` (frontend source)
- `client/` (frontend assets/config)
- `contracts/` (sample PDFs)
- `database.py`, `schema.sql`
- `crew_orchestrator.py`, `liability_scorer.py`, `generate_claim_pdf.py`, `domain_ingestion.py`
- `tsconfig.json`, `vite.config.ts`, `tailwind.config.js` (if any)

### 4. Wait for Build
Hugging Face will automatically detect the `Dockerfile`, build the image, and start the container.
- The Python backend will start on port `8081`.
- The Node.js backend will start on port `7860` (default for HF).
- The React frontend will be served by the Node.js backend.

### 5. Supabase Setup (One-time)
Ensure your Supabase PostgreSQL has the required tables. You can run the content of `schema.sql` in the Supabase SQL Editor.

### Why this works:
- **Hugging Face Spaces** provides high-spec free containers that don't sleep (unlike Render/Fly.io free tiers).
- **Supabase** handles data persistence, so your audits aren't lost when the container restarts.
- **Node.js Gateway** acts as a unified entry point, serving the UI and proxying complex reasoning tasks to the **Python FastAPI** backend.
