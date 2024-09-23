from fastapi import FastAPI, HTTPException, Depends, status, File, UploadFile
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel
from typing import List
import os
import logging
import bcrypt

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# MongoDB connection
MONGO_URL = "mongodb://localhost:27017"
client = AsyncIOMotorClient(MONGO_URL)
db = client.doc_proxy

# JWT settings
SECRET_KEY = "your-secret-key"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# OAuth2 scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# Models
class User(BaseModel):
    username: str
    email: str
    hashed_password: str

class UserCreate(BaseModel):
    username: str
    email: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: str = None

class PDFDocument(BaseModel):
    id: str
    filename: str
    upload_date: datetime
    retrieved_by: List[str] = []

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
    user = await db.users.find_one({"username": username})
    if user:
        return User(**user)

async def authenticate_user(username: str, password: str):
    user = await get_user(username)
    if not user:
        return False
    if not verify_password(password, user.hashed_password):
        return False
    return user

def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = TokenData(username=username)
    except JWTError:
        raise credentials_exception
    user = await get_user(username=token_data.username)
    if user is None:
        raise credentials_exception
    return user

# Routes
@app.post("/register", response_model=User)
async def register_user(user: UserCreate):
    logger.info(f"Registering user: {user.username}")
    existing_user = await get_user(user.username)
    if existing_user:
        logger.warning(f"Registration failed: Username {user.username} already exists")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )
    hashed_password = get_password_hash(user.password)
    new_user = User(username=user.username, email=user.email, hashed_password=hashed_password)
    await db.users.insert_one(new_user.dict())
    logger.info(f"User {user.username} registered successfully")
    return new_user

@app.post("/token", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    logger.info(f"Login user: {form_data}")

    user = await authenticate_user(form_data.username, form_data.password)
    if not user:
        logger.warning(f"Login failed: Invalid credentials for user {form_data.username}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    logger.info(f"User {form_data.username} logged in successfully")
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/upload")
async def upload_pdf(file: UploadFile = File(...), current_user: User = Depends(get_current_user)):
    content = await file.read()
    pdf_id = ObjectId()
    await db.pdfs.insert_one({
        "_id": pdf_id,
        "filename": file.filename,
        "content": content,
        "upload_date": datetime.utcnow(),
        "retrieved_by": []
    })
    logger.info(f"User {current_user.username} uploaded document: {file.filename}")
    return {"document_id": str(pdf_id)}

@app.get("/documents", response_model=List[PDFDocument])
async def get_documents(current_user: User = Depends(get_current_user)):
    cursor = db.pdfs.find({"retrieved_by": {"$nin": [current_user.username]}}).sort("upload_date", 1)
    documents = []
    async for doc in cursor:
        documents.append(PDFDocument(
            id=str(doc["_id"]),
            filename=doc["filename"],
            upload_date=doc["upload_date"],
            retrieved_by=doc["retrieved_by"]
        ))
        await db.pdfs.update_one(
            {"_id": doc["_id"]},
            {"$addToSet": {"retrieved_by": current_user.username}}
        )
    logger.info(f"User {current_user.username} retrieved {len(documents)} documents")
    return documents

@app.get("/document/{document_id}")
async def get_document(document_id: str, current_user: User = Depends(get_current_user)):
    doc = await db.pdfs.find_one({"_id": ObjectId(document_id)})
    if not doc:
        logger.warning(f"Document not found: {document_id}")
        raise HTTPException(status_code=404, detail="Document not found")
    logger.info(f"User {current_user.username} retrieved document: {doc['filename']}")
    return PDFDocument(
        id=str(doc["_id"]),
        filename=doc["filename"],
        upload_date=doc["upload_date"],
        retrieved_by=doc["retrieved_by"]
    )

@app.get("/list_documents")
async def list_documents(current_user: User = Depends(get_current_user)):
    cursor = db.pdfs.find().sort("upload_date", -1)
    documents = []
    async for doc in cursor:
        documents.append(PDFDocument(
            id=str(doc["_id"]),
            filename=doc["filename"],
            upload_date=doc["upload_date"],
            retrieved_by=doc["retrieved_by"]
        ))
    logger.info(f"User {current_user.username} listed all documents")
    return documents

if __name__ == "__main__":
    import uvicorn
    logger.info("Starting the application")
    uvicorn.run(app, host="0.0.0.0", port=8000)