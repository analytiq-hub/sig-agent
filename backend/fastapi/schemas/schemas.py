from pydantic import BaseModel, Field
from datetime import datetime
from typing import List, Literal, Optional

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
    tag_ids: List[str] = []  # Optional list of tag IDs

class DocumentsUpload(BaseModel):
    files: List[DocumentUpload]

class DocumentMetadata(BaseModel):
    id: str
    document_name: str
    upload_date: datetime
    uploaded_by: str
    state: str
    tag_ids: List[str] = []  # List of tag IDs

class DocumentResponse(BaseModel):
    metadata: DocumentMetadata
    content: str  # Changed from bytes to str since we're using base64 encoded string

    class Config:
        arbitrary_types_allowed = True  # This allows bytes type in Pydantic

class ListDocumentsResponse(BaseModel):
    documents: List[DocumentMetadata]
    total_count: int
    skip: int

# Add this new model after the DocumentMetadata class
class DocumentUpdate(BaseModel):
    """Schema for updating document metadata"""
    tag_ids: List[str] = Field(
        default=[],
        description="List of tag IDs associated with the document"
    )

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
    total_count: int
    skip: int

# Add these new models
class PromptCreate(BaseModel):
    name: str
    content: str
    schema_name: Optional[str] = None
    schema_version: Optional[int] = None
    tag_ids: List[str] = []

class Prompt(BaseModel):
    id: str
    name: str
    content: str
    schema_name: str
    schema_version: int
    version: int
    created_at: datetime
    created_by: str
    tag_ids: List[str] = []

class ListPromptsResponse(BaseModel):
    prompts: List[Prompt]
    total_count: int
    skip: int

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
    total_count: int
    skip: int

# Add to schemas.py
class WorkspaceMember(BaseModel):
    user_id: str
    role: Literal["owner", "admin", "member"]

class WorkspaceCreate(BaseModel):
    name: str

class WorkspaceUpdate(BaseModel):
    name: str | None = None
    members: List[WorkspaceMember] | None = None

class Workspace(BaseModel):
    id: str
    name: str
    owner_id: str
    members: List[WorkspaceMember]
    created_at: datetime
    updated_at: datetime

class ListWorkspacesResponse(BaseModel):
    workspaces: List[Workspace]

# Add these new models after the existing ones
class UserCreate(BaseModel):
    email: str
    name: str
    password: str
    isAdmin: bool = False

class UserUpdate(BaseModel):
    name: str | None = None
    isAdmin: bool | None = None
    emailVerified: bool | None = None

class UserResponse(BaseModel):
    id: str
    email: str
    name: str | None
    isAdmin: bool
    emailVerified: bool | None
    createdAt: datetime

class ListUsersResponse(BaseModel):
    users: List[UserResponse]
    total_count: int
    skip: int
