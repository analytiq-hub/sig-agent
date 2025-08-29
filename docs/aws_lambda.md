# AWS Lambda Integration Implementation Plan

## Overview

This document outlines the implementation plan for AWS Lambda function support in DocRouter. Lambda functions will follow the same versioning pattern as prompts, with additional support for AWS `$LATEST` versions for draft testing from the UI.

## Architecture Overview

### Core Components

1. **Lambda Management System** - CRUD operations for Lambda functions
2. **Execution Engine** - Run Lambda functions against documents  
3. **Callback System** - Handle Lambda-to-DocRouter API calls
4. **UI Components** - Frontend for Lambda function management

### Key Design Decisions

- Follow existing prompt versioning pattern (stable IDs + version numbers)
- Support both versioned deployments and `$LATEST` for draft testing
- Use DocRouter SDK as Lambda layer for API access
- Implement secure callback mechanism for Lambda-to-DocRouter communication

## Data Models

### Backend Models (`packages/docrouter_app/models.py`)

```python
class LambdaConfig(BaseModel):
    name: str
    description: Optional[str] = None
    handler: str = "lambda_function.lambda_handler"
    runtime: str = "python3.11" 
    timeout: int = Field(default=300, ge=1, le=900)  # 5 min default, 15 min max
    memory_size: int = Field(default=512, ge=128, le=10240)  # MB
    environment_variables: Dict[str, str] = Field(default_factory=dict)
    function_code: str  # Python source code
    tag_ids: List[str] = Field(default_factory=list)
    layers: List[str] = Field(default_factory=list)  # ARNs of Lambda layers
    vpc_config: Optional[Dict[str, Any]] = None
    
class Lambda(LambdaConfig):
    lambda_revid: str           # MongoDB _id for this revision
    lambda_id: str              # Stable identifier across versions  
    lambda_version: int         # Version number
    aws_function_name: Optional[str] = None  # AWS Lambda function name
    aws_function_arn: Optional[str] = None   # AWS Lambda function ARN
    aws_version_arn: Optional[str] = None    # Specific version ARN
    deployment_status: str = "draft"  # draft, deploying, deployed, failed
    deployment_error: Optional[str] = None
    created_at: datetime
    created_by: str
    organization_id: str

class ListLambdasResponse(BaseModel):
    lambdas: List[Lambda]
    total_count: int
    skip: int

class LambdaRunResponse(BaseModel):
    status: str
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    execution_time_ms: Optional[int] = None
    
class LambdaResult(BaseModel):
    lambda_result_id: str
    lambda_revid: str
    document_id: str
    organization_id: str
    result: Dict[str, Any]
    original_result: Dict[str, Any]  # Immutable original
    updated_result: Dict[str, Any]   # User-editable version
    is_edited: bool = False
    is_verified: bool = False
    execution_time_ms: Optional[int] = None
    created_at: datetime
    updated_at: datetime

class UpdateLambdaResultRequest(BaseModel):
    updated_result: Dict[str, Any]
    is_verified: bool = False
```

### Frontend Types (`frontend/src/types/lambda.ts`)

```typescript
export interface LambdaConfig {
  name: string;
  description?: string;
  handler: string;
  runtime: string;
  timeout: number;
  memory_size: number;
  environment_variables: Record<string, string>;
  function_code: string;
  tag_ids: string[];
  layers: string[];
  vpc_config?: Record<string, any>;
}

export interface Lambda extends LambdaConfig {
  lambda_revid: string;
  lambda_id: string;
  lambda_version: number;
  aws_function_name?: string;
  aws_function_arn?: string;
  aws_version_arn?: string;
  deployment_status: 'draft' | 'deploying' | 'deployed' | 'failed';
  deployment_error?: string;
  created_at: string;
  created_by: string;
  organization_id: string;
}

export interface CreateLambdaParams {
  organizationId: string;
  lambda: LambdaConfig;
}

export interface RunLambdaParams {
  organizationId: string;
  documentId: string;
  lambdaRevId: string;
  draft?: boolean;  // Use $LATEST version
  force?: boolean;
}
```

## API Endpoints

### Lambda Management APIs (`packages/docrouter_app/main.py`)

```python
# Lambda CRUD Operations
@app.post("/v0/orgs/{organization_id}/lambdas", response_model=Lambda, tags=["lambdas"])
async def create_lambda(organization_id: str, lambda_config: LambdaConfig, current_user: User = Depends(get_org_user))

@app.get("/v0/orgs/{organization_id}/lambdas", response_model=ListLambdasResponse, tags=["lambdas"])  
async def list_lambdas(organization_id: str, skip: int = 0, limit: int = 10, tag_ids: str = None, current_user: User = Depends(get_org_user))

@app.get("/v0/orgs/{organization_id}/lambdas/{lambda_id}", response_model=Lambda, tags=["lambdas"])
async def get_lambda(organization_id: str, lambda_id: str, current_user: User = Depends(get_org_user))

@app.put("/v0/orgs/{organization_id}/lambdas/{lambda_id}", response_model=Lambda, tags=["lambdas"])
async def update_lambda(organization_id: str, lambda_id: str, lambda_config: LambdaConfig, current_user: User = Depends(get_org_user))

@app.delete("/v0/orgs/{organization_id}/lambdas/{lambda_id}", tags=["lambdas"])
async def delete_lambda(organization_id: str, lambda_id: str, current_user: User = Depends(get_org_user))

# Lambda Deployment APIs
@app.post("/v0/orgs/{organization_id}/lambdas/{lambda_revid}/deploy", tags=["lambdas"])
async def deploy_lambda(organization_id: str, lambda_revid: str, current_user: User = Depends(get_org_user))

@app.get("/v0/orgs/{organization_id}/lambdas/{lambda_revid}/deployment-status", tags=["lambdas"])
async def get_deployment_status(organization_id: str, lambda_revid: str, current_user: User = Depends(get_org_user))

# Lambda Execution APIs  
@app.post("/v0/orgs/{organization_id}/lambda/run/{document_id}", response_model=LambdaRunResponse, tags=["lambda-execution"])
async def run_lambda(organization_id: str, document_id: str, lambda_revid: str = Query(...), draft: bool = Query(False), force: bool = Query(False), current_user: User = Depends(get_org_user))

@app.get("/v0/orgs/{organization_id}/lambda/result/{document_id}", response_model=LambdaResult, tags=["lambda-execution"])
async def get_lambda_result(organization_id: str, document_id: str, lambda_revid: str = Query(...), latest: bool = Query(False), current_user: User = Depends(get_org_user))

@app.put("/v0/orgs/{organization_id}/lambda/result/{document_id}", response_model=LambdaResult, tags=["lambda-execution"])
async def update_lambda_result(organization_id: str, document_id: str, lambda_revid: str = Query(...), update: UpdateLambdaResultRequest = Body(...), current_user: User = Depends(get_org_user))

@app.delete("/v0/orgs/{organization_id}/lambda/result/{document_id}", tags=["lambda-execution"])
async def delete_lambda_result(organization_id: str, document_id: str, lambda_revid: str = Query(...), current_user: User = Depends(get_org_user))
```

### Frontend API Functions (`frontend/src/utils/api.ts`)

```typescript
// Lambda Management APIs
export const createLambdaApi = async (params: CreateLambdaParams): Promise<Lambda> => {
  const { organizationId, lambda } = params;
  const response = await api.post<Lambda>(`/v0/orgs/${organizationId}/lambdas`, lambda);
  return response.data;
};

export const listLambdasApi = async (params: ListLambdasParams): Promise<ListLambdasResponse> => {
  const { organizationId, ...rest } = params;
  const response = await api.get<ListLambdasResponse>(`/v0/orgs/${organizationId}/lambdas`, {
    params: {
      skip: rest?.skip || 0,
      limit: rest?.limit || 10,
      tag_ids: rest?.tag_ids
    }
  });
  return response.data;
};

export const runLambdaApi = async (params: RunLambdaParams) => {
  const { organizationId, documentId, lambdaRevId, draft, force } = params;
  const response = await api.post<LambdaRunResponse>(
    `/v0/orgs/${organizationId}/lambda/run/${documentId}`,
    {},
    {
      params: {
        lambda_revid: lambdaRevId,
        draft: draft,
        force: force
      }
    }
  );
  return response.data;
};
```

## Lambda Execution Architecture

### 1. DocRouter SDK Lambda Layer

Create a Lambda layer containing:
- DocRouter SDK (`packages/docrouter_sdk/`)
- Common dependencies (requests, boto3, etc.)
- Callback utilities

**Layer structure:**
```
python/
  docrouter_sdk/
    __init__.py
    api/
      client.py
      documents.py
      # ... other API modules
    models/
      # ... model definitions
  callback_utils.py  # Helper functions for DocRouter callbacks
```

### 2. Lambda Function Template

**Default function template:**
```python
import json
import os
from docrouter_sdk import DocRouterClient
from callback_utils import get_callback_credentials

def lambda_handler(event, context):
    """
    Default DocRouter Lambda handler
    
    Event structure:
    {
        "document_id": "doc_123",
        "organization_id": "org_456", 
        "callback_url": "https://docrouter.example.com",
        "callback_token": "encrypted_token",
        "user_data": {...}  # Additional user-provided data
    }
    """
    
    # Extract event data
    document_id = event['document_id']
    organization_id = event['organization_id']
    callback_url = event['callback_url']
    callback_token = event['callback_token']
    
    # Initialize DocRouter client with callback credentials
    client = DocRouterClient(
        base_url=callback_url,
        api_token=callback_token
    )
    
    try:
        # Get document data
        document = client.documents.get(organization_id, document_id)
        
        # Get OCR text
        ocr_text = client.ocr.get_text(organization_id, document_id)
        
        # User's custom processing logic goes here
        result = process_document(document, ocr_text, event.get('user_data', {}))
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'status': 'success',
                'result': result
            })
        }
        
    except Exception as e:
        return {
            'statusCode': 500,
            'body': json.dumps({
                'status': 'error',
                'error': str(e)
            })
        }

def process_document(document, ocr_text, user_data):
    """
    Override this function with your custom processing logic
    """
    return {
        "message": "Hello from Lambda!",
        "document_name": document['metadata']['document_name'],
        "text_length": len(ocr_text)
    }
```

### 3. Callback Security

**Temporary Token Generation:**
```python
# In DocRouter backend
async def generate_callback_token(organization_id: str, lambda_revid: str) -> str:
    """Generate temporary token for Lambda callbacks"""
    payload = {
        'organization_id': organization_id,
        'lambda_revid': lambda_revid, 
        'exp': datetime.utcnow() + timedelta(minutes=15),  # 15 min expiry
        'scope': 'lambda_callback'
    }
    return jwt.encode(payload, FASTAPI_SECRET, algorithm=ALGORITHM)

# Callback token validation middleware
async def validate_callback_token(token: str):
    """Validate callback token and extract permissions"""
    try:
        payload = jwt.decode(token, FASTAPI_SECRET, algorithms=[ALGORITHM])
        if payload.get('scope') != 'lambda_callback':
            raise HTTPException(status_code=401, detail="Invalid token scope")
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid callback token")
```

## Database Schema

### Collections

**`lambdas` collection** (similar to `prompts`):
```javascript
{
  _id: ObjectId,
  name: String,
  organization_id: String,
  lambda_version: Number  // Auto-incremented
}
```

**`lambda_revisions` collection** (similar to `prompt_revisions`):
```javascript
{
  _id: ObjectId,  // This becomes lambda_revid
  lambda_id: String,  // References lambdas._id
  lambda_version: Number,
  name: String,
  description: String,
  handler: String,
  runtime: String,
  timeout: Number,
  memory_size: Number,
  environment_variables: Object,
  function_code: String,
  tag_ids: Array,
  layers: Array,
  vpc_config: Object,
  aws_function_name: String,
  aws_function_arn: String,
  aws_version_arn: String,
  deployment_status: String,
  deployment_error: String,
  created_at: Date,
  created_by: String,
  organization_id: String
}
```

**`lambda_results` collection**:
```javascript
{
  _id: ObjectId,
  lambda_revid: String,
  document_id: String,
  organization_id: String,
  original_result: Object,
  updated_result: Object,
  is_edited: Boolean,
  is_verified: Boolean,
  execution_time_ms: Number,
  created_at: Date,
  updated_at: Date
}
```

## Frontend UI Components

### 1. Lambda List Page (`src/app/[orgId]/lambdas/page.tsx`)

Similar to prompts page with:
- List of Lambda functions with deployment status
- Create new Lambda button
- Filter by tags
- Deployment status indicators

### 2. Lambda Editor (`src/app/[orgId]/lambdas/[lambdaId]/edit/page.tsx`)

**Tabbed interface:**

**Tab 1: Function Code**
- Monaco editor for Python code
- Syntax highlighting and error checking
- Code template selection

**Tab 2: Configuration**  
- Handler function name
- Runtime version selection
- Memory and timeout settings
- Environment variables editor (key-value pairs)

**Tab 3: Layers & Dependencies**
- Lambda layers ARNs
- VPC configuration (optional)
- Tags selection

**Tab 4: Deployment**
- Deploy to AWS button
- Deployment status and logs
- Test with draft version toggle

### 3. Lambda Execution Panel

Similar to prompt execution with:
- Run Lambda button
- Draft mode toggle (uses $LATEST)
- Execution results viewer
- Result editing capabilities

## Implementation Phases

### Phase 1: Core Infrastructure
1. Add Lambda data models to `models.py`
2. Implement database helper functions
3. Create basic CRUD API endpoints
4. Add frontend API functions

### Phase 2: UI Components  
1. Create Lambda list page
2. Build Lambda editor with tabbed interface
3. Implement code editor with syntax highlighting
4. Add tag selection and filtering

### Phase 3: AWS Integration
1. Create DocRouter SDK Lambda layer
2. Implement AWS Lambda deployment logic
3. Add deployment status tracking
4. Create callback token system

### Phase 4: Execution Engine
1. Implement Lambda execution APIs
2. Add result storage and management
3. Create result editing UI
4. Add draft mode support

### Phase 5: Security & Polish
1. Implement callback security
2. Add error handling and logging  
3. Create comprehensive tests
4. Add monitoring and metrics

## Security Considerations

1. **Callback Tokens**: Short-lived JWTs for Lambda-to-DocRouter communication
2. **Code Validation**: Syntax checking and import restrictions
3. **Resource Limits**: Memory, timeout, and execution quotas per organization
4. **Network Security**: VPC configuration support for enterprise deployments
5. **Audit Logging**: Track all Lambda deployments and executions

## Callback Communication Solution

The tricky callback issue can be solved with:

1. **Temporary Callback URLs**: Generate unique callback URLs per execution
2. **Reverse Proxy**: Use AWS API Gateway or Application Load Balancer
3. **VPN/Private Links**: For on-premise DocRouter installations
4. **Webhook Queues**: Use SQS for async communication if direct callbacks fail

**Recommended approach**: Generate temporary callback tokens and use public endpoints with IP allowlisting for security.

<function_calls>
<invoke name="TodoWrite">
<parameter name="todos">[{"content": "Analyze current prompt implementation pattern", "status": "completed", "activeForm": "Analyzing current prompt implementation pattern"}, {"content": "Design Lambda data models and API structure", "status": "completed", "activeForm": "Designing Lambda data models and API structure"}, {"content": "Plan Lambda execution and callback architecture", "status": "completed", "activeForm": "Planning Lambda execution and callback architecture"}, {"content": "Design frontend UI components", "status": "completed", "activeForm": "Designing frontend UI components"}, {"content": "Create comprehensive implementation plan", "status": "completed", "activeForm": "Creating comprehensive implementation plan"}]