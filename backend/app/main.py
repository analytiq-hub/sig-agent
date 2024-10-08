# main.py

from fastapi import FastAPI, File, UploadFile, HTTPException, Query, Depends, status, Body
from fastapi.security import APIKeyCookie
from fastapi.security import OAuth2PasswordBearer
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from datetime import datetime, timedelta, UTC
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel
from typing import Optional
import os
import logging
import json
import bcrypt
from dotenv import load_dotenv

# Load the .env file
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Environment variables
DOCP_MONGODB_URI = os.getenv("DOCP_MONGODB_URI", "mongodb://localhost:27017")
DOCP_ENV = os.getenv("DOCP_ENV", "dev")
DOCP_AWS_ACCT = os.getenv("DOCP_AWS_ACCT", "")

# JWT settings
SECRET_KEY = "aabx88sasda8903232234,2342,svc" # Obsolete
JWT_SECRET = os.getenv("JWT_SECRET")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

app = FastAPI()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

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
client = AsyncIOMotorClient(DOCP_MONGODB_URI)
db = client.prod if DOCP_ENV == "prod" else client.dev
pdf_collection = db.pdf_manager.pdfs
user_collection = db.pdf_manager.users

logger.info(f"Connected to {DOCP_MONGODB_URI}")

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Use this instead of OAuth2PasswordBearer
cookie_scheme = APIKeyCookie(name="session")

# Ensure the 'pdfs' directory exists
os.makedirs("pdfs", exist_ok=True)

# Pydantic models
class User(BaseModel):
    username: str
    email: Optional[str] = None
    full_name: Optional[str] = None
    disabled: Optional[bool] = None

class UserInDB(User):
    hashed_password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class UserRegister(BaseModel):
    username: str
    password: str

class LoginData(BaseModel):
    username: str
    password: str

class TokenData(BaseModel):
    user_id: str
    user_name: str
    email: str

async def get_current_user(token: str = Depends(oauth2_scheme)):
    logger.info(f"Getting current user with token: {token}")
    credentials_exception = HTTPException(
        status_code=401,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    logger.info(f"token: {token}")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        userId: str = payload.get("userId")
        userName: str = payload.get("userName")
        email: str = payload.get("email")
        logger.info(f"get_current_user(): userId: {userId}, userName: {userName}, email: {email}")
        if userId is None or userName is None or email is None:
            raise credentials_exception
        token_data = TokenData(user_id=userId, user_name=userName, email=email)
        logger.info(f"token_data: {token_data}")
    except JWTError as e:
        logger.error(f"JWTError: {str(e)}")
        raise credentials_exception
    return token_data

# Hash a password using bcrypt
def get_password_hash(password):
    pwd_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed_password = bcrypt.hashpw(password=pwd_bytes, salt=salt)
    return hashed_password.decode('utf-8')  # Return as string for storage

# Check if the provided password matches the stored password (hashed)
def verify_password(plain_password, hashed_password):
    password_byte_enc = plain_password.encode('utf-8')
    hashed_password_bytes = hashed_password.encode('utf-8')
    return bcrypt.checkpw(password=password_byte_enc, hashed_password=hashed_password_bytes)

async def get_user(username: str):
    user_dict = await user_collection.find_one({"username": username})
    if user_dict:
        return UserInDB(**user_dict)

async def authenticate_user(username: str, password: str):
    user = await get_user(username)
    if not user:
        return False
    if not verify_password(password, user.hashed_password):
        return False
    return user

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(UTC) + expires_delta
    else:
        expire = datetime.now(UTC) + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

# async def get_current_user(session: str = Depends(cookie_scheme)):
#     credentials_exception = HTTPException(
#         status_code=status.HTTP_401_UNAUTHORIZED,
#         detail="Could not validate credentials",
#         headers={"WWW-Authenticate": "Bearer"},
#     )
#     try:
#         payload = jwt.decode(session, SECRET_KEY, algorithms=[ALGORITHM])
#         username: str = payload.get("sub")
#         if username is None:
#             raise credentials_exception
#     except JWTError:
#         raise credentials_exception
#     user = await get_user(username)
#     if user is None:
#         raise credentials_exception
#     return user

# Authentication endpoints
@app.post("/register", response_model=User)
async def register(user_data: UserRegister):
    # Log the full user data as JSON
    logger.info(f"Registering new user: {json.dumps(user_data.dict(), default=str, indent=2)}")

    # Validate input
    if not user_data.username or not user_data.password:
        logger.error("Registration failed: Missing username or password")
        raise HTTPException(status_code=400, detail="Username and password are required")

    user = await get_user(user_data.username)
    if user:
        logger.error(f"Registration failed: Username '{user_data.username}' already exists")
        raise HTTPException(status_code=400, detail="Username already registered")

    hashed_password = get_password_hash(user_data.password)
    user_dict = {
        "username": user_data.username,
        "hashed_password": hashed_password,
        "email": None,
        "full_name": None,
        "disabled": False
    }
    
    try:
        await user_collection.insert_one(user_dict)
        logger.info(f"New user registered: {json.dumps({**user_dict, 'hashed_password': '[REDACTED]'}, default=str, indent=2)}")
        return User(**user_dict)
    except Exception as e:
        logger.error(f"Registration failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.post("/token", response_model=Token)
async def login(login_data: LoginData):
    logger.info(f"Login attempt for user: {login_data.username}")
    user = await authenticate_user(login_data.username, login_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

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
        "uploaded_by": current_user.username,
        "retrieved_by": []
    }
    
    result = await pdf_collection.insert_one(document)
    return {"document_id": str(result.inserted_id)}

@app.get("/retrieve")
async def retrieve_pdf(current_user: User = Depends(get_current_user)):
    logger.info(f"Retrieving PDF for user: {current_user.username}")
    document = await pdf_collection.find_one(
        {"retrieved_by": {"$nin": [current_user.username]}},
        sort=[("upload_date", 1)]
    )
    
    if not document:
        raise HTTPException(status_code=404, detail="No unretrieved documents found")
    
    await pdf_collection.update_one(
        {"_id": document["_id"]},
        {"$push": {"retrieved_by": current_user.username}}
    )
    
    return FileResponse(document["path"], filename=document["filename"])

@app.get("/lookup/{document_id}")
async def lookup_pdf(
    document_id: str,
    current_user: User = Depends(get_current_user)
):
    logger.info(f"Looking up PDF for user: {current_user.username}")
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)