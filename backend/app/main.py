# main.py

from fastapi import FastAPI, File, UploadFile, HTTPException, Query, Depends, status, Body, Security, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from datetime import datetime, timedelta, UTC
from jose import JWTError, jwt
from typing import Optional, List
import os
import json
from dotenv import load_dotenv
import secrets
import base64
import io
import analytiq_data as ad

import api
import models
from schemas import (
    User,
    ApiToken, ListApiTokensResponse, CreateApiTokenRequest,
    ListPDFsResponse,
    PDFMetadata,
    FileUpload, FilesUpload,
    LLMToken, CreateLLMTokenRequest, ListLLMTokensResponse
)

# Load the .env file
load_dotenv()

# Initialize the logger
ad.init_logger("fastapi")

# Environment variables
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
ENV = os.getenv("ENV", "dev")

# JWT settings
JWT_SECRET = os.getenv("JWT_SECRET")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
UPLOAD_DIR = "data"

app = FastAPI()
security = HTTPBearer()

# CORS configuration
origins = [
    "http://localhost:5173",  # Add your frontend origin here
    "http://localhost:3000",  # Add any other origins you need
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"] # Needed to expose the Content-Disposition header to the frontend
)

# MongoDB connection
analytiq_client = ad.common.get_client(env=ENV)
db_name = "prod" if ENV == "prod" else "dev"
db = analytiq_client.mongodb_async[db_name]
docs_collection = db.docs
api_token_collection = db.api_tokens
llm_token_collection = db.llm_tokens

ad.log.info(f"Connected to {MONGODB_URI}")

# Ensure the 'pdfs' directory exists
os.makedirs("data", exist_ok=True)

from pydantic import BaseModel

async def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security)):
    token = credentials.credentials
    try:
        # First, try to validate as JWT
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        userId: str = payload.get("userId")
        userName: str = payload.get("userName")
        email: str = payload.get("email")
        ad.log.info(f"get_current_user(): userId: {userId}, userName: {userName}, email: {email}")
        if userName is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
        return User(user_id=userId,
                    user_name=userName,
                    token_type="jwt")
    except JWTError:
        # If JWT validation fails, check if it's an API token
        api_token = await api_token_collection.find_one({"token": token})
        ad.log.info(f"get_current_user(): api_token: {api_token}")
        if api_token:
            return User(user_id=api_token["user_id"],
                        user_name=api_token["name"],
                        token_type="api")
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")

# PDF management endpoints
@app.post("/api/upload")
async def upload_pdf(
    files_upload: FilesUpload = Body(...),
    current_user: User = Depends(get_current_user)
):
    ad.log.info(f"upload_pdf(): files: {[file.name for file in files_upload.files]}")
    uploaded_files = []
    for file in files_upload.files:
        if not file.name.endswith('.pdf'):
            raise HTTPException(status_code=400, detail=f"File {file.name} is not a PDF")
        
        # Decode and save the file
        content = base64.b64decode(file.content.split(',')[1])

        # Save the file to mongodb
        ad.common.save_file(analytiq_client,
                            file_name=file.name,
                            blob=content,
                            metadata={"type": "application/pdf",
                             "size": len(content)})

        document = {
            "filename": file.name,
            "upload_date": datetime.utcnow(),
            "uploaded_by": current_user.user_name,
            "state": "Uploaded"
        }
        
        result = await docs_collection.insert_one(document)
        uploaded_files.append({"filename": file.name, "document_id": str(result.inserted_id)})
    
    return {"uploaded_files": uploaded_files}

@app.get("/api/download/{document_id}")
async def download_pdf(
    document_id: str,
    current_user: User = Depends(get_current_user)
):
    document = await docs_collection.find_one({"_id": ObjectId(document_id)})
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
        
    # Get the file from mongodb
    file = ad.common.get_file(analytiq_client, document["filename"])
    if file is None:
        raise HTTPException(status_code=404, detail="File not found")
    
    file_blob = file["blob"]

    # Return the file as a response
    return StreamingResponse(io.BytesIO(file_blob),
                             media_type=file["metadata"]["type"],
                             headers={"Content-Disposition": f"attachment; filename={document['filename']}"})

@app.get("/api/list", response_model=ListPDFsResponse)
async def list_pdfs(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    user: User = Depends(get_current_user)
):
    # Get the total count of documents
    total_count = await docs_collection.count_documents({})
    
    cursor = docs_collection.find().sort("upload_date", 1).skip(skip).limit(limit)
    documents = await cursor.to_list(length=limit)
    
    return ListPDFsResponse(
        pdfs=[
            {
                "id": str(doc["_id"]),
                "filename": doc["filename"],
                "upload_date": doc["upload_date"].isoformat(),
                "uploaded_by": doc["uploaded_by"],
                "state": doc.get("state", "")
            }
            for doc in documents
        ],
        total_count=total_count,
        skip=skip
    )

@app.delete("/api/delete/{file_id}", response_model=None)
async def delete_pdf(
    file_id: str,
    current_user: User = Depends(get_current_user)
):
    document = await docs_collection.find_one({"_id": ObjectId(file_id)})
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    ad.common.delete_file(analytiq_client, file_name=document["filename"])
    await docs_collection.delete_one({"_id": ObjectId(file_id)})

    return

@app.post("/api/api_tokens", response_model=ApiToken)
async def api_token_create(
    request: CreateApiTokenRequest,
    current_user: User = Depends(get_current_user)
):
    ad.log.info(f"Creating API token for user: {current_user} request: {request}")
    token = secrets.token_urlsafe(32)
    new_token = {
        "user_id": current_user.user_id,
        "name": request.name,
        "token": token,
        "created_at": datetime.now(UTC),
        "lifetime": request.lifetime
    }
    result = await api_token_collection.insert_one(new_token)
    new_token["id"] = str(result.inserted_id)
    return new_token

@app.get("/api/api_tokens", response_model=ListApiTokensResponse)
async def api_token_list(current_user: User = Depends(get_current_user)):
    cursor = api_token_collection.find({"user_id": current_user.user_id})
    tokens = await cursor.to_list(length=None)
    ret = [
        {
            "id": str(token["_id"]),
            "user_id": token["user_id"],
            "name": token["name"],
            "token": token["token"],
            "created_at": token["created_at"],
            "lifetime": token["lifetime"]
        }
        for token in tokens
    ]
    ad.log.info(f"list_api_tokens(): {ret}")
    return ListApiTokensResponse(api_tokens=ret)

@app.delete("/api/api_tokens/{token_id}")
async def api_token_delete(
    token_id: str,
    current_user: User = Depends(get_current_user)
):
    result = await api_token_collection.delete_one({
        "_id": ObjectId(token_id),
        "user_id": current_user.user_id
    })
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Token not found")
    return {"message": "Token deleted successfully"}

@app.post("/api/llm_tokens", response_model=LLMToken)
async def llm_token_create(
    request: CreateLLMTokenRequest,
    current_user: User = Depends(get_current_user)
):
    ad.log.info(f"Creating/Updating LLM token for user: {current_user} request: {request}")
    
    # Check if a token for this vendor already exists
    existing_token = await llm_token_collection.find_one({
        "user_id": current_user.user_id,
        "llm_vendor": request.llm_vendor
    })

    new_token = {
        "user_id": current_user.user_id,
        "llm_vendor": request.llm_vendor,
        "token": request.token,
        "created_at": datetime.now(UTC),
    }

    if existing_token:
        # Update the existing token
        result = await llm_token_collection.replace_one(
            {"_id": existing_token["_id"]},
            new_token
        )
        new_token["id"] = str(existing_token["_id"])
        ad.log.info(f"Updated existing LLM token for {request.llm_vendor}")
    else:
        # Insert a new token
        result = await llm_token_collection.insert_one(new_token)
        new_token["id"] = str(result.inserted_id)
        ad.log.info(f"Created new LLM token for {request.llm_vendor}")

    return new_token

@app.get("/api/llm_tokens", response_model=ListLLMTokensResponse)
async def llm_token_list(current_user: User = Depends(get_current_user)):
    cursor = llm_token_collection.find({"user_id": current_user.user_id})
    tokens = await cursor.to_list(length=None)
    llm_tokens = [
        {
            "id": str(token["_id"]),
            "user_id": token["user_id"],
            "llm_vendor": token["llm_vendor"],
            "token": token["token"],
            "created_at": token["created_at"],
        }
        for token in tokens
    ]
    ad.log.info(f"list_llm_tokens(): {llm_tokens}")
    return ListLLMTokensResponse(llm_tokens=llm_tokens)

@app.delete("/api/llm_tokens/{token_id}")
async def llm_token_delete(
    token_id: str,
    current_user: User = Depends(get_current_user)
):
    result = await llm_token_collection.delete_one({
        "_id": ObjectId(token_id),
        "user_id": current_user.user_id
    })
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="LLM Token not found")
    return {"message": "LLM Token deleted successfully"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
