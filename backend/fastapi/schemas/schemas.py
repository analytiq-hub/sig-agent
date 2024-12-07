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

class DocumentUpload(BaseModel):
    name: str
    content: str

class DocumentsUpload(BaseModel):
    files: List[DocumentUpload]

# Response model for the PDF documents
class DocumentMetadata(BaseModel):
    id: str
    document_name: str
    upload_date: datetime
    uploaded_by: str
    state: str

class ListDocumentsResponse(BaseModel):
    documents: List[DocumentMetadata]
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

class OCRMetadataResponse(BaseModel):
    n_pages: int
    ocr_date: str

class LLMRunResponse(BaseModel):
    status: str
    result: dict

class LLMResult(BaseModel):
    prompt_id: str
    document_id: str
    llm_result: dict

# Schema management models
FieldType = Literal["str", "int", "float", "bool", "datetime"]

class SchemaField(BaseModel):
    name: str
    type: FieldType

class SchemaCreate(BaseModel):
    name: str
    fields: List[SchemaField]

class Schema(SchemaCreate):
    id: str
    version: int
    created_at: datetime
    created_by: str

class ListSchemasResponse(BaseModel):
    schemas: List[Schema]

# Add these new models
class PromptCreate(BaseModel):
    name: str
    content: str
    schema_name: str | None = None
    schema_version: int | None = None

class Prompt(PromptCreate):
    id: str
    version: int
    created_at: datetime
    created_by: str

class ListPromptsResponse(BaseModel):
    prompts: List[Prompt]

# Add these new models for tag management
class TagCreate(BaseModel):
    name: str
    color: str | None = None  # Optional hex color code for UI display
    description: str | None = None

class Tag(TagCreate):
    id: str
    created_at: datetime
    created_by: str

class ListTagsResponse(BaseModel):
    tags: List[Tag]
