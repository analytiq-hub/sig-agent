# main.py

from fastapi import FastAPI, File, UploadFile, HTTPException, Query, Depends, status, Body, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from datetime import datetime, timedelta, UTC
from jose import JWTError, jwt
from pydantic import BaseModel
from typing import Optional
import os
import logging
import json
from dotenv import load_dotenv
import secrets

import api
import models
import schemas

# Load the .env file
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Environment variables
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
ENV = os.getenv("ENV", "dev")

# JWT settings
JWT_SECRET = os.getenv("JWT_SECRET")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

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
)

# MongoDB connection
client = AsyncIOMotorClient(MONGODB_URI)
db = client.prod if ENV == "prod" else client.dev
pdf_collection = db.pdf_manager.pdfs
user_collection = db.pdf_manager.users
api_token_collection = db.api_tokens

logger.info(f"Connected to {MONGODB_URI}")

# Ensure the 'pdfs' directory exists
os.makedirs("data", exist_ok=True)

# Pydantic models
class User(BaseModel):
    user_id: str
    user_name: str
    token_type: str

class ApiToken(BaseModel):
    id: str
    user_id: str
    name: str
    created_at: datetime
    lifetime: int
class CreateApiTokenRequest(BaseModel):
    name: str
    lifetime: int

async def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security)):
    token = credentials.credentials
    try:
        # First, try to validate as JWT
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        userId: str = payload.get("userId")
        userName: str = payload.get("userName")
        email: str = payload.get("email")
        logger.info(f"get_current_user(): userId: {userId}, userName: {userName}, email: {email}")
        if userName is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
        return User(user_id=userId,
                    user_name=userName,
                    token_type="jwt")
    except JWTError:
        # If JWT validation fails, check if it's an API token
        api_token = await api_token_collection.find_one({"token": token})
        logger.info(f"get_current_user(): api_token: {api_token}")
        if api_token:
            return User(user_id=api_token["user_id"],
                        user_name=api_token["name"],
                        token_type="api")
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")

# PDF management endpoints
@app.post("/upload")
async def upload_pdf(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")
    
    contents = await file.read()
    file_path = f"pdfs/{file.filename}"
    
    with open(file_path, "wb") as f:
        f.write(contents)
    
    document = {
        "filename": file.filename,
        "path": file_path,
        "upload_date": datetime.now(UTC),
        "uploaded_by": current_user.user_name,
        "retrieved_by": []
    }
    
    result = await pdf_collection.insert_one(document)
    return {"document_id": str(result.inserted_id)}

@app.get("/retrieve")
async def retrieve_pdf(current_user: User = Depends(get_current_user)):
    logger.info(f"Retrieving PDF for user: {current_user.user_name}")
    document = await pdf_collection.find_one(
        {"retrieved_by": {"$nin": [current_user.user_name]}},
        sort=[("upload_date", 1)]
    )
    
    if not document:
        raise HTTPException(status_code=404, detail="No unretrieved documents found")
    
    await pdf_collection.update_one(
        {"_id": document["_id"]},
        {"$push": {"retrieved_by": current_user.user_name}}
    )
    
    return FileResponse(document["path"], filename=document["filename"])

@app.get("/lookup/{document_id}")
async def lookup_pdf(
    document_id: str,
    current_user: User = Depends(get_current_user)
):
    logger.info(f"Looking up PDF for user: {current_user.user_name}")
    document = await pdf_collection.find_one({"_id": ObjectId(document_id)})
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    return FileResponse(document["path"], filename=document["filename"])

@app.get("/list")
async def list_pdfs(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    user: User = Depends(get_current_user)
):
    logger.info(f"Listing PDFs for user: {user}")
    cursor = pdf_collection.find().sort("upload_date", 1).skip(skip).limit(limit)
    documents = await cursor.to_list(length=limit)
    
    return [
        {
            "id": str(doc["_id"]),
            "filename": doc["filename"],
            "upload_date": doc["upload_date"],
            "uploaded_by": doc["uploaded_by"],
            "retrieved_by": doc["retrieved_by"]
        }
        for doc in documents
    ]

@app.post("/api/tokens", response_model=ApiToken)
async def create_api_token(
    request: CreateApiTokenRequest,
    current_user: User = Depends(get_current_user)
):
    logger.info(f"Creating API token for user: {current_user} request: {request}")
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

@app.get("/api/tokens", response_model=list[ApiToken])
async def list_api_tokens(current_user: User = Depends(get_current_user)):
    cursor = api_token_collection.find({"user_id": current_user.user_id})
    tokens = await cursor.to_list(length=None)
    ret = [
        {
            "id": str(token["_id"]),
            "user_id": token["user_id"],
            "name": token["name"],
            "created_at": token["created_at"],
            "lifetime": token["lifetime"]
        }
        for token in tokens
    ]
    logger.info(f"list_api_tokens(): {ret}")
    return ret

@app.delete("/api/tokens/{token_id}")
async def delete_api_token(
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)