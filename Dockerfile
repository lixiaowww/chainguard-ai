# Use Node.js for building the frontend and running the Node backend
# Trigger rebuild: 2026-06-17 deploy
FROM node:20-slim

# Install Python and other necessary tools
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm install

# Copy requirements.txt and install Python dependencies
COPY requirements.txt ./
# Using --break-system-packages as we are in a container and it's simpler for this setup
RUN pip3 install --no-cache-dir -r requirements.txt --break-system-packages

# Copy the rest of the application
COPY . .

# Build the frontend
RUN npm run build

# Expose the port HF Spaces uses (7860)
EXPOSE 7860

# Set environment variables
ENV PORT=7860
ENV NODE_ENV=production
ENV VITE_REQUIRE_AUTH=false

# Start script to run both backends
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

CMD ["/app/start.sh"]
