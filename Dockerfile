FROM node:18 AS frontend

WORKDIR /app

# Copy only necessary files first
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm install

# Build-time arguments
ARG NEXT_PUBLIC_API_URL
ARG API_URL
ARG NODE_ENV=production

# Set build-time environment variables
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL:-http://localhost:8000}
ENV API_URL=${API_URL:-http://localhost:8000}
ENV NODE_ENV=${NODE_ENV}

RUN echo "NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}"
RUN echo "API_URL=${API_URL}"
RUN echo "NODE_ENV=${NODE_ENV}"
# Now copy the rest of the frontend files
COPY frontend/ ./frontend/
RUN cd frontend && npm run build

EXPOSE 3000

# Use Python 3.12 as the base image
FROM python:3.12-slim AS backend

# Set the working directory in the container
WORKDIR /app

# Copy only backend requirements first
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

# Then copy the rest of the backend
COPY backend/ ./backend/

EXPOSE 8000
