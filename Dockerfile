# Use Python 3.12 as the base image
FROM python:3.12-slim

# Set the working directory in the container
WORKDIR /app

# Install Node.js
RUN apt-get update && apt-get install -y \
    curl \
    && curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copy frontend files
COPY frontend/ ./frontend/

# Install frontend dependencies and build
RUN cd frontend && npm install && npm run build

# Copy backend files
COPY backend/ ./backend/

# Install backend dependencies
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy the start script
COPY start.sh .
RUN chmod +x start.sh

# Expose ports
EXPOSE 3000 8000

# Start the application
CMD ["./start.sh"]
