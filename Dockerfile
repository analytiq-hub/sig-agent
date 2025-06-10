FROM node:18 AS frontend

WORKDIR /app

# Copy only necessary files first
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm install

# Build-time arguments
ARG NEXT_PUBLIC_FASTAPI_FRONTEND_URL
ARG NODE_ENV=production

# Set build-time environment variables
ENV NEXT_PUBLIC_FASTAPI_FRONTEND_URL=${NEXT_PUBLIC_FASTAPI_FRONTEND_URL:-http://localhost:8000}
ENV FASTAPI_BACKEND_URL=${FASTAPI_BACKEND_URL:-http://localhost:8000}
ENV NODE_ENV=${NODE_ENV}

RUN echo "NEXT_PUBLIC_FASTAPI_FRONTEND_URL=${NEXT_PUBLIC_FASTAPI_FRONTEND_URL}"
RUN echo "FASTAPI_BACKEND_URL=${FASTAPI_BACKEND_URL}"
RUN echo "NODE_ENV=${NODE_ENV}"
# Now copy the rest of the frontend files
COPY frontend/ ./frontend/
RUN cd frontend && npm run build

EXPOSE 3000

# Use slim Python 3.12 as the base image
FROM python:3.12-slim AS backend

# Set the working directory in the container
WORKDIR /app

# Install system dependencies and uv
RUN apt-get update && \
    apt-get install -y --no-install-recommends libreoffice curl && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* && \
    pip install --no-cache-dir uv

# Copy only packages requirements first
COPY packages/requirements.txt ./packages/
RUN uv pip install --system --no-cache-dir -r packages/requirements.txt

# Then copy the rest of the packages
COPY packages/ ./packages/

EXPOSE 8000
