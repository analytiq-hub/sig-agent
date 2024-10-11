from pydantic import BaseModel
from datetime import datetime
from typing import List

# Pydantic models
class User(BaseModel):
    user_id: str
    user_name: str
    token_type: str

class ApiToken(BaseModel):
    id: str
    user_id: str
    name: str
    token: str
    created_at: datetime
    lifetime: int
    
class CreateApiTokenRequest(BaseModel):
    name: str
    lifetime: int

# Response model for the PDF documents
class PDFMetadata(BaseModel):
    id: str
    filename: str
    upload_date: datetime
    uploaded_by: str
    retrieved_by: List[str]

class ListPDFsResponse(BaseModel):
    pdfs: List[PDFMetadata]
    total_count: int
    skip: int