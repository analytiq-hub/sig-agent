from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class DocumentUpload(BaseModel):
    name: str
    content: str
    tag_ids: List[str] = []

class DocumentsUpload(BaseModel):
    documents: List[DocumentUpload]

class DocumentMetadata(BaseModel):
    id: str
    document_name: str
    upload_date: datetime
    uploaded_by: str
    state: str
    tag_ids: List[str] = []

class DocumentResponse(BaseModel):
    metadata: DocumentMetadata
    content: str

class DocumentUpdate(BaseModel):
    document_name: Optional[str] = None
    tag_ids: List[str] = []

class ListDocumentsResponse(BaseModel):
    documents: List[DocumentMetadata]
    total_count: int
    skip: int