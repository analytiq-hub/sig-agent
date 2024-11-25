from pydantic import BaseModel
from datetime import datetime
from typing import List, Literal

# Pydantic models
class User(BaseModel):
    user_id: str
    user_name: str
    token_type: str

class AccessToken(BaseModel):
    id: str
    user_id: str
    name: str
    token: str
    created_at: datetime
    lifetime: int

class ListAccessTokensResponse(BaseModel):
    access_tokens: List[AccessToken]
    
class CreateAccessTokenRequest(BaseModel):
    name: str
    lifetime: int

class FileUpload(BaseModel):
    name: str
    content: str

class FilesUpload(BaseModel):
    files: List[FileUpload]

# Response model for the PDF documents
class PDFMetadata(BaseModel):
    id: str
    file_name: str
    upload_date: datetime
    uploaded_by: str
    state: str

class ListPDFsResponse(BaseModel):
    pdfs: List[PDFMetadata]
    total_count: int
    skip: int

class LLMToken(BaseModel):
    id: str
    user_id: str
    llm_vendor: Literal["OpenAI", "Anthropic", "Groq"]
    token: str
    created_at: datetime

class CreateLLMTokenRequest(BaseModel):
    llm_vendor: Literal["OpenAI", "Anthropic", "Groq"]
    token: str

class ListLLMTokensResponse(BaseModel):
    llm_tokens: List[LLMToken]

class AWSCredentials(BaseModel):
    access_key_id: str
    secret_access_key: str
