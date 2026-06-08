#!/bin/bash

# Ensure directories exist
mkdir -p contracts tms_claims memory/ideas

# Start Python FastAPI backend in the background
# Listening on 8081 as expected by the Node backend proxy
echo "Starting Python FastAPI backend..."
python3 api.py &

# Wait for a few seconds to let Python backend start
sleep 5

# Start Node backend
# It will listen on PORT (7860) and serve the frontend + proxy requests to Python
echo "Starting Node.js backend..."
npm start
