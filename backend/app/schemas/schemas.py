from pydantic import BaseModel
from datetime import datetime
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