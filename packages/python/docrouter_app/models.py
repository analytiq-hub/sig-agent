from pydantic import BaseModel, Field, constr, ConfigDict, field_validator, model_validator
from datetime import datetime
from typing import List, Literal, Optional, Any, Dict, Union, ForwardRef
from enum import Enum

# Pydantic models
class User(BaseModel):
    user_id: str
    user_name: str
    token_type: str




# Add these new models after the existing ones
class UserCreate(BaseModel):
    email: str
    name: str
    password: str

class UserUpdate(BaseModel):
    name: str | None = None
    password: str | None = None
    role: str | None = None  # Replace isAdmin with role
    email_verified: bool | None = None
    has_seen_tour: bool | None = None

class UserResponse(BaseModel):
    id: str
    email: str
    name: str | None
    role: str
    email_verified: bool | None
    created_at: datetime
    has_password: bool
    has_seen_tour: bool | None = None

class ListUsersResponse(BaseModel):
    users: List[UserResponse]
    total_count: int
    skip: int

class InvitationStatus(str, Enum):
    pending = "pending"
    accepted = "accepted"
    expired = "expired"

class CreateInvitationRequest(BaseModel):
    email: str
    organization_id: Optional[str] = None  # For future use

class InvitationResponse(BaseModel):
    id: str
    email: str
    status: InvitationStatus
    expires: datetime
    created_by: str
    created_at: datetime
    organization_id: Optional[str] = None
    organization_name: Optional[str] = None
    user_exists: Optional[bool] = None

class ListInvitationsResponse(BaseModel):
    invitations: list[InvitationResponse]
    total_count: int
    skip: int


class AcceptInvitationRequest(BaseModel):
    name: Optional[str] = None
    password: Optional[str] = None
