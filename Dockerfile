# Use an official Node runtime as a parent image
FROM node:18 AS frontend

# Set the working directory in the container
WORKDIR /app/frontend

# Copy package.json and package-lock.json
COPY frontend/package*.json ./

# Install dependencies
RUN npm install

# Copy the frontend source code
COPY frontend/ .

# Build the Next.js app
RUN npm run build

# Use an official Python runtime as a parent image
FROM python:3.12 AS backend

# Set the working directory in the container
WORKDIR /app/backend

# Copy requirements.txt
COPY backend/requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the backend source code
COPY backend/ .

# Final stage
FROM python:3.12-slim

# Install Node.js
RUN apt-get update && apt-get install -y nodejs npm

# Copy frontend build from frontend stage
COPY --from=frontend /app/frontend /app/frontend

# Copy backend from backend stage
COPY --from=backend /app/backend /app/backend

# Set the working directory
WORKDIR /app

# Copy the start script
COPY start.sh .
RUN chmod +x start.sh

# Expose ports
EXPOSE 3000 8000

# Start the applications
CMD ["./start.sh"]

