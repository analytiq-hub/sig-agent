# Use Python 3.12 as the base image
FROM python:3.12-slim

# Set the working directory in the container
WORKDIR /app

# Install Node.js with a more efficient setup
RUN apt-get update && apt-get install -y \
    curl \
    && curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copy only necessary files first
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm install

# Build-time arguments
ARG NEXT_PUBLIC_API_URL
ARG NODE_ENV=production

# Set build-time environment variables
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL:-http://localhost:8000}
ENV NODE_ENV=${NODE_ENV}

RUN echo "NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}"
RUN echo "NODE_ENV=${NODE_ENV}"
# Now copy the rest of the frontend files
COPY frontend/ ./frontend/
RUN cd frontend && npm run build

# Copy only backend requirements first
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

# Then copy the rest of the backend
COPY backend/ ./backend/

# Copy the start script
COPY start.sh .
RUN chmod +x start.sh

EXPOSE 3000 8000
CMD ["./start.sh"]
