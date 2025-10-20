# main.py

# Standard library imports
from datetime import datetime, timedelta, UTC
import os
import sys
import json
import secrets
import base64
import re
import uuid
import logging
import hmac
import hashlib
import asyncio
import warnings
from typing import Optional, List
from contextlib import asynccontextmanager
# Defer litellm import to avoid event loop warnings
# import litellm

# Suppress Pydantic deprecation warnings
warnings.filterwarnings("ignore", category=DeprecationWarning, module="pydantic")

# Set up the path first, before other imports
cwd = os.path.dirname(os.path.abspath(__file__))
sys.path.append(f"{cwd}/..")

# Third-party imports
from fastapi import (
    FastAPI, File, UploadFile, HTTPException, Query, 
    Depends, status, Body, Security, Response, 
    BackgroundTasks, Request
)
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import FileResponse, StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from jose import JWTError, jwt
from bcrypt import hashpw, gensalt
from dotenv import load_dotenv
from jsonschema import validate, ValidationError, Draft7Validator
from fastapi.encoders import jsonable_encoder
import httpx
from urllib.parse import urlparse

# Local imports
from docrouter_app import email_utils, startup, organizations, users, limits
from docrouter_app.auth import (
    get_current_user,
    get_admin_user,
    get_session_user,
    get_org_user,
    is_system_admin,
    is_organization_admin,
    is_organization_member,
    get_org_id_from_token
)
from docrouter_app.models import (
    User, AccessToken, ListAccessTokensResponse,
    CreateAccessTokenRequest,
    AWSConfig,
    UserCreate, UserUpdate, UserResponse, ListUsersResponse,
    OrganizationMember,
    OrganizationCreate,
    OrganizationUpdate,
    Organization,
    ListOrganizationsResponse,
    InvitationResponse,
    CreateInvitationRequest,
    ListInvitationsResponse,
    AcceptInvitationRequest,
    OAuthSignInRequest,
    OAuthSignInResponse,
)
from docrouter_app.routes.payments import payments_router, SPUCreditException
from docrouter_app.routes.payments import (
    init_payments,
    sync_customer,
    delete_payments_customer,
)
from docrouter_app.routes.documents import documents_router
from docrouter_app.routes.ocr import ocr_router
from docrouter_app.routes.llm import llm_router
from docrouter_app.routes.prompts import prompts_router
from docrouter_app.routes.schemas import schemas_router
from docrouter_app.routes.tags import tags_router
from docrouter_app.routes.forms import forms_router
import analytiq_data as ad
from analytiq_data.common.doc import get_mime_type

# Set up the environment variables. This reads the .env file.
ad.common.setup()

# Environment variables
ENV = os.getenv("ENV", "dev")
NEXTAUTH_URL = os.getenv("NEXTAUTH_URL")
FASTAPI_ROOT_PATH = os.getenv("FASTAPI_ROOT_PATH", "/")
MONGODB_URI = os.getenv("MONGODB_URI")
SES_FROM_EMAIL = os.getenv("SES_FROM_EMAIL")

logger = logging.getLogger(__name__)

logger.info(f"ENV: {ENV}")
logger.info(f"NEXTAUTH_URL: {NEXTAUTH_URL}")
logger.info(f"FASTAPI_ROOT_PATH: {FASTAPI_ROOT_PATH}")
logger.info(f"MONGODB_URI: {MONGODB_URI}")
logger.info(f"SES_FROM_EMAIL: {SES_FROM_EMAIL}")
# JWT settings
NEXTAUTH_SECRET = os.getenv("NEXTAUTH_SECRET")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Define MongoDB connection check function to be used in lifespan
async def check_mongodb_connection(uri):
    try:
        # Create a MongoDB client
        mongo_client = AsyncIOMotorClient(uri)
        
        # The ismaster command is cheap and does not require auth
        await mongo_client.admin.command('ismaster')
        logger.info(f"MongoDB connection successful at {uri}")
        return True
    except Exception as e:
        logger.error(f"Failed to connect to MongoDB at {uri}: {e}")
        return False

UPLOAD_DIR = "data"


@asynccontextmanager
async def lifespan(app):
    # Startup code (previously in @app.on_event("startup"))
    
    # Check MongoDB connectivity first
    await check_mongodb_connection(MONGODB_URI)
    
    analytiq_client = ad.common.get_analytiq_client()
    await startup.setup_admin(analytiq_client)
    await startup.setup_api_creds(analytiq_client)
    
    # Initialize payments
    db = ad.common.get_async_db(analytiq_client)
    await init_payments(db)
    
    yield  # This is where the app runs
    
    # Shutdown code (if any) would go here
    # For example: await some_client.close()

# Create the FastAPI app with the lifespan
app = FastAPI(
    root_path=FASTAPI_ROOT_PATH,
    lifespan=lifespan
)
security = HTTPBearer()

# CORS allowed origins
CORS_ORIGINS_DEF = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://host.docker.internal:3000",
]

# Only add NEXTAUTH_URL if it's not None
if NEXTAUTH_URL:
    CORS_ORIGINS_DEF.append(NEXTAUTH_URL)

cors_origins = os.getenv("CORS_ORIGINS", ",".join(CORS_ORIGINS_DEF)).split(",")
logger.info(f"CORS allowed origins: {cors_origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"] # Needed to expose the Content-Disposition header to the frontend
)

# Organization-level access tokens
@app.post("/v0/orgs/{organization_id}/access_tokens", response_model=AccessToken, tags=["access_tokens"])
async def create_org_token(
    organization_id: str,
    request: CreateAccessTokenRequest,
    current_user: User = Depends(get_current_user)
):
    """Create an organization-level API token"""
    # Verify organization membership
    is_sys_admin = await is_system_admin(current_user.user_id)
    is_org_member = await is_organization_member(organization_id, current_user.user_id)

    if not is_sys_admin and not is_org_member:
        raise HTTPException(status_code=403, detail="You are not authorized to create an organization-level API token")
    
    db = ad.common.get_async_db()
    
    # Generate a globally unique token
    max_attempts = 10
    for attempt in range(max_attempts):
        token = f"org_{secrets.token_urlsafe(32)}"
        encrypted_token = ad.crypto.encrypt_token(token)
        
        # Check if token already exists
        existing_token = await db.access_tokens.find_one({"token": encrypted_token})
        if not existing_token:
            break
    else:
        raise HTTPException(status_code=500, detail="Failed to generate unique token after multiple attempts")
    
    new_token = {
        "user_id": current_user.user_id,
        "organization_id": organization_id,
        "name": request.name,
        "token": encrypted_token,
        "created_at": datetime.now(UTC),
        "lifetime": request.lifetime
    }
    try:
        result = await db.access_tokens.insert_one(new_token)
    except Exception as e:
        # Handle potential duplicate key error from database unique constraint
        if "duplicate key" in str(e).lower() or "duplicate" in str(e).lower():
            raise HTTPException(status_code=500, detail="Token collision detected. Please try again.")
        raise

    new_token["token"] = token  # Return plaintext token to user
    new_token["id"] = str(result.inserted_id)
    return new_token

@app.get("/v0/orgs/{organization_id}/access_tokens", response_model=ListAccessTokensResponse, tags=["access_tokens"])
async def list_org_tokens(
    organization_id: str,
    current_user: User = Depends(get_current_user)
):
    """List organization-level API tokens"""
    # Verify organization membership
    is_sys_admin = await is_system_admin(current_user.user_id)
    is_org_member = await is_organization_member(organization_id, current_user.user_id)

    if not is_sys_admin and not is_org_member:
        raise HTTPException(status_code=403, detail="You are not authorized to list organization-level API tokens")
    
    db = ad.common.get_async_db()
    cursor = db.access_tokens.find({
        "user_id": current_user.user_id,
        "organization_id": organization_id
    })
    tokens = await cursor.to_list(length=None)
    ret = [
        {
            "id": str(token["_id"]),
            "user_id": token["user_id"],
            "organization_id": token["organization_id"],
            "name": token["name"],
            "token": token["token"],
            "created_at": token["created_at"],
            "lifetime": token["lifetime"]
        }
        for token in tokens
    ]
    return ListAccessTokensResponse(access_tokens=ret)

@app.delete("/v0/orgs/{organization_id}/access_tokens/{token_id}", tags=["access_tokens"])
async def delete_org_token(
    organization_id: str,
    token_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete an organization-level API token"""
    # Verify organization membership
    is_sys_admin = await is_system_admin(current_user.user_id)
    is_org_member = await is_organization_member(organization_id, current_user.user_id)

    if not is_sys_admin and not is_org_member:
        raise HTTPException(status_code=403, detail="You are not authorized to delete an organization-level API token")
    
    db = ad.common.get_async_db()
    result = await db.access_tokens.delete_one({
        "_id": ObjectId(token_id),
        "user_id": current_user.user_id,
        "organization_id": organization_id
    })
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Token not found")
    return {"message": "Token deleted successfully"}



















    org_prompts = await db.prompts.find(prompts_query).to_list(None)
    
    if not org_prompts:
        return ListPromptsResponse(prompts=[], total_count=0, skip=skip)
    
    # Extract prompt IDs
    prompt_ids = [prompt["_id"] for prompt in org_prompts]
    prompt_id_to_name = {str(prompt["_id"]): prompt["name"] for prompt in org_prompts}
    
    # Build pipeline for prompt_revisions
    pipeline = [
        {
            "$match": {"prompt_id": {"$in": [str(pid) for pid in prompt_ids]}}
        }
    ]

    pipeline.extend([
        {
            "$sort": {"_id": -1}
        },
        {
            "$group": {
                "_id": "$prompt_id",
                "doc": {"$first": "$$ROOT"}
            }
        },
        {
            "$replaceRoot": {"newRoot": "$doc"}
        },
        {
            "$sort": {"_id": -1}
        }
    ])

    # Add document tag filtering if document_id is provided
    if document_id:
        document = await db.docs.find_one({
            "_id": ObjectId(document_id),
            "organization_id": organization_id  # Ensure document belongs to org
        })
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        
        document_tag_ids = document.get("tag_ids", [])
        if document_tag_ids:
            pipeline.append({
                "$match": {"tag_ids": {"$in": document_tag_ids}}
            })
        else:
            # Only return the default prompt if no tags
            pipeline.append({
                "$match": {"name": "Default Prompt"}
            })
    # Add direct tag filtering if tag_ids are provided
    if tag_ids:
        document_tag_ids = [tid.strip() for tid in tag_ids.split(",")]
        pipeline.append({
            "$match": {"tag_ids": {"$all": document_tag_ids}}
        })

    pipeline.extend([
        {
            "$facet": {
                "total": [{"$count": "count"}],
                "prompts": [
                    {"$skip": skip},
                    {"$limit": limit}
                ]
            }
        }
    ])
    
    result = await db.prompt_revisions.aggregate(pipeline).to_list(length=1)
    result = result[0]
    
    total_count = result["total"][0]["count"] if result["total"] else 0
    prompts = result["prompts"]

    # Convert _id to id in each prompt and add name from prompts collection
    for prompt in prompts:
        prompt['prompt_revid'] = str(prompt.pop('_id'))
        prompt['name'] = prompt_id_to_name.get(prompt['prompt_id'], "Unknown")
    
    ret = ListPromptsResponse(
        prompts=prompts,
        total_count=total_count,
        skip=skip
    )
    return ret

    # Check if the prompt exists
    existing_prompt = await db.prompts.find_one({
        "_id": ObjectId(prompt_id),
        "organization_id": organization_id
    })
    if not existing_prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")
    
    # Only verify schema if one is specified
    schema = await validate_and_resolve_schema(prompt)

    # Validate model exists
    found = False
    for provider in await db.llm_providers.find({}).to_list(None):
        if prompt.model in provider["litellm_models_enabled"]:
            found = True
            break
    if not found:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid model: {prompt.model}"
        )
    
    # Validate tag IDs if provided
    if prompt.tag_ids:
        tags_cursor = db.tags.find({
            "_id": {"$in": [ObjectId(tag_id) for tag_id in prompt.tag_ids]},
            "organization_id": organization_id
        })
        existing_tags = await tags_cursor.to_list(None)
        existing_tag_ids = {str(tag["_id"]) for tag in existing_tags}
        
        invalid_tags = set(prompt.tag_ids) - existing_tag_ids
        if invalid_tags:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid tag IDs: {list(invalid_tags)}"
            ) 

    # Get the latest prompt revision
    latest_prompt_revision = await db.prompt_revisions.find_one(
        {"prompt_id": prompt_id},
        sort=[("prompt_version", -1)]
    )
    if not latest_prompt_revision:
        raise HTTPException(status_code=404, detail="Prompt not found or not in this organization")

    # Check if only the name has changed
    only_name_changed = (
        prompt.name != existing_prompt["name"] and
        prompt.content == latest_prompt_revision["content"] and
        prompt.schema_id == latest_prompt_revision.get("schema_id") and
        prompt.schema_version == latest_prompt_revision.get("schema_version") and
        prompt.model == latest_prompt_revision["model"] and
        set(prompt.tag_ids or []) == set(latest_prompt_revision.get("tag_ids") or [])
    )
    
    if prompt.name != existing_prompt["name"]:
        # Update the name in the prompts collection
        result = await db.prompts.update_one(
            {"_id": ObjectId(prompt_id)},
            {"$set": {"name": prompt.name}}
        )

        if only_name_changed:
            if result.modified_count > 0:
                # Return the updated prompt
                updated_revision = latest_prompt_revision.copy()
                updated_revision["prompt_revid"] = str(updated_revision.pop("_id"))
                updated_revision["name"] = prompt.name
                return Prompt(**updated_revision)
            else:
                raise HTTPException(status_code=500, detail="Failed to update prompt name")
    
    # If other fields changed, create a new version
    # Get the next version number using the stable prompt_id
    _, new_prompt_version = await get_prompt_id_and_version(prompt_id)
    
    # Create new version of the prompt in prompt_revisions
    new_prompt = {
        "prompt_id": prompt_id,  # Preserve stable identifier
        "content": prompt.content,
        "schema_id": prompt.schema_id,
        "schema_version": prompt.schema_version,
        "prompt_version": new_prompt_version,
        "created_at": datetime.now(UTC),
        "created_by": current_user.user_id,
        "tag_ids": prompt.tag_ids,
        "model": prompt.model
    }
    
    # Insert new version
    result = await db.prompt_revisions.insert_one(new_prompt)
    
    # Return updated prompt
    new_prompt["prompt_revid"] = str(result.inserted_id)
    new_prompt["name"] = prompt.name  # Add name from the prompts collection
    return Prompt(**new_prompt)

# Add this helper function near the top of the file with other functions


# Tag management endpoints
    new_tag = {
        "name": tag.name,
        "color": tag.color,
        "description": tag.description,
        "created_at": datetime.now(UTC),
        "created_by": current_user.user_id,
        "organization_id": organization_id  # Add organization_id
    }
    
    result = await db.tags.insert_one(new_tag)
    new_tag["id"] = str(result.inserted_id)
    
    return Tag(**new_tag)

    # Get paginated tags with sorting by _id in descending order
    cursor = db.tags.find(tags_query).sort("_id", -1).skip(skip).limit(limit)
    
    tags = await cursor.to_list(length=None)
    
    return ListTagsResponse(
        tags=[
            {
                "id": str(tag["_id"]),
                "name": tag["name"],
                "color": tag.get("color"),
                "description": tag.get("description"),
                "created_at": tag["created_at"],
                "created_by": tag["created_by"]
            }
            for tag in tags
        ],
        total_count=total_count,
        skip=skip
    )

    # Check if tag is used in any prompts
    prompts_with_tag = await db.prompt_revisions.find_one({
        "tag_ids": tag_id
    })
    
    if prompts_with_tag:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete tag '{tag['name']}' because it is assigned to one or more prompts"
        )
    
    result = await db.tags.delete_one({
        "_id": ObjectId(tag_id),
        "organization_id": organization_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Tag not found")
    
    return {"message": "Tag deleted successfully"}

@app.post("/v0/account/auth/token", tags=["account/auth"])
async def create_auth_token(request: Request):
    """
    Create an authentication token.
    Requires HMAC signature in X-Request-Signature header for authentication.
    """
    # Verify request signature
    signature = request.headers.get("X-Request-Signature")
    if not signature:
        raise HTTPException(
            status_code=401,
            detail="Missing X-Request-Signature header"
        )

    if not NEXTAUTH_SECRET:
        logger.error("NEXTAUTH_SECRET not configured")
        raise HTTPException(
            status_code=500,
            detail="Server configuration error"
        )

    # Get raw request body for signature verification
    raw_body = await request.body()

    # Verify signature using HMAC-SHA256 on the raw body
    expected_signature = hmac.new(
        NEXTAUTH_SECRET.encode('utf-8'),
        raw_body,
        hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(signature, expected_signature):
        logger.warning(f"Invalid signature for token request")
        raise HTTPException(
            status_code=401,
            detail="Invalid request signature"
        )

    # Parse request body after signature verification
    try:
        user_data = json.loads(raw_body)
    except json.JSONDecodeError as e:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid JSON: {str(e)}"
        )

    logger.debug(f"create_auth_token(): user_data: {user_data}")

    # Signature is valid, create token
    token = jwt.encode(
        {
            "userId": user_data["id"],
            "userName": user_data["name"],
            "email": user_data["email"]
        },
        NEXTAUTH_SECRET,
        algorithm=ALGORITHM
    )

    logger.debug(f"create_auth_token(): {token}")
    return {"token": token}

@app.post("/v0/account/auth/oauth", response_model=OAuthSignInResponse, tags=["account/auth"])
async def oauth_signin(request: Request):
    """
    Handle OAuth sign-in from NextAuth.
    Creates/links user, account, organization, and syncs with Stripe.
    Requires HMAC signature in X-Request-Signature header for authentication.
    """
    # Verify request signature
    signature = request.headers.get("X-Request-Signature")
    if not signature:
        raise HTTPException(
            status_code=401,
            detail="Missing X-Request-Signature header"
        )

    if not NEXTAUTH_SECRET:
        logger.error("NEXTAUTH_SECRET not configured")
        raise HTTPException(
            status_code=500,
            detail="Server configuration error"
        )

    # Get raw request body for signature verification
    raw_body = await request.body()

    # Verify signature using HMAC-SHA256 on the raw body
    expected_signature = hmac.new(
        NEXTAUTH_SECRET.encode('utf-8'),
        raw_body,
        hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(signature, expected_signature):
        logger.warning(f"Invalid signature for OAuth request")
        raise HTTPException(
            status_code=401,
            detail="Invalid request signature"
        )

    # Parse and validate the request body after signature verification
    try:
        oauth_data = json.loads(raw_body)
        oauth_request = OAuthSignInRequest(**oauth_data)
    except (json.JSONDecodeError, Exception) as e:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid request body: {str(e)}"
        )

    logger.info(f"oauth_signin(): email={oauth_request.email}, provider={oauth_request.provider}")

    # Process OAuth sign-in
    db = ad.common.get_async_db()

    try:
        # Check if user already exists
        existing_user = await db.users.find_one({"email": oauth_request.email})

        if existing_user:
            user_id = str(existing_user["_id"])
            is_new_user = False
            logger.info(f"Existing user found: {user_id}")

            # Check if this OAuth account already exists
            existing_account = await db.accounts.find_one({
                "provider": oauth_request.provider,
                "providerAccountId": oauth_request.provider_account_id
            })

            if not existing_account:
                # Link OAuth account to existing user
                await db.accounts.insert_one({
                    "userId": user_id,
                    "type": oauth_request.account.type,
                    "provider": oauth_request.provider,
                    "providerAccountId": oauth_request.provider_account_id,
                    "access_token": oauth_request.account.access_token,
                    "expires_at": oauth_request.account.expires_at,
                    "token_type": oauth_request.account.token_type,
                    "scope": oauth_request.account.scope,
                    "id_token": oauth_request.account.id_token,
                    "refresh_token": oauth_request.account.refresh_token
                })
                logger.info(f"Linked {oauth_request.provider} account to existing user {user_id}")
        else:
            # Create new user
            is_new_user = True
            user_result = await db.users.insert_one({
                "email": oauth_request.email,
                "name": oauth_request.name,
                "role": "user",
                "email_verified": oauth_request.email_verified,
                "created_at": datetime.now(UTC)
            })
            user_id = str(user_result.inserted_id)
            logger.info(f"Created new user: {user_id}")

            # Create OAuth account record
            await db.accounts.insert_one({
                "userId": user_id,
                "type": oauth_request.account.type,
                "provider": oauth_request.provider,
                "providerAccountId": oauth_request.provider_account_id,
                "access_token": oauth_request.account.access_token,
                "expires_at": oauth_request.account.expires_at,
                "token_type": oauth_request.account.token_type,
                "scope": oauth_request.account.scope,
                "id_token": oauth_request.account.id_token,
                "refresh_token": oauth_request.account.refresh_token
            })
            logger.info(f"Created {oauth_request.provider} account for user {user_id}")

            # Create individual organization using email as name
            org_result = await db.organizations.insert_one({
                "name": oauth_request.email,
                "type": "individual",
                "members": [{
                    "user_id": user_id,
                    "role": "admin"
                }],
                "created_at": datetime.now(UTC),
                "updated_at": datetime.now(UTC)
            })
            org_id = str(org_result.inserted_id)
            logger.info(f"Created organization {org_id} for user {user_id}")

            # Sync with Stripe
            try:
                await sync_customer(db=db, org_id=org_id)
                logger.info(f"Successfully synced organization {org_id} with Stripe")
            except Exception as e:
                logger.warning(f"Failed to sync organization {org_id} with Stripe: {e}")
                # Don't fail the sign-in if Stripe sync fails

        return OAuthSignInResponse(
            success=True,
            user_id=user_id,
            is_new_user=is_new_user
        )

    except Exception as e:
        logger.error(f"Error in oauth_signin: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to process OAuth sign-in: {str(e)}"
        )




@app.post("/v0/account/aws_config", tags=["account/aws_config"])
async def create_aws_config(
    config: AWSConfig,
    current_user: User = Depends(get_admin_user)
):  
    """Create or update AWS configuration (admin only)"""
    db = ad.common.get_async_db()
    # Validate all fields are non-empty
    if not config.access_key_id or not config.access_key_id.strip():
        raise HTTPException(
            status_code=400,
            detail="AWS Access Key ID is required and cannot be empty"
        )
    
    if not config.secret_access_key or not config.secret_access_key.strip():
        raise HTTPException(
            status_code=400,
            detail="AWS Secret Access Key is required and cannot be empty"
        )
    
    if not config.s3_bucket_name or not config.s3_bucket_name.strip():
        raise HTTPException(
            status_code=400,
            detail="S3 Bucket Name is required and cannot be empty"
        )

    # Validate AWS Access Key ID format
    if not re.match(r'^[A-Z0-9]{20}$', config.access_key_id):
        raise HTTPException(
            status_code=400,
            detail="Invalid AWS Access Key ID format. Must be 20 characters long and contain only uppercase letters and numbers."
        )

    # Validate AWS Secret Access Key format
    if not re.match(r'^[A-Za-z0-9+/]{40}$', config.secret_access_key):
        raise HTTPException(
            status_code=400,
            detail="Invalid AWS Secret Access Key format. Must be 40 characters long and contain only letters, numbers, and +/."
        )

    encrypted_access_key = ad.crypto.encrypt_token(config.access_key_id)
    encrypted_secret_key = ad.crypto.encrypt_token(config.secret_access_key)
    
    update_data = {
        "access_key_id": encrypted_access_key,
        "secret_access_key": encrypted_secret_key,
        "s3_bucket_name": config.s3_bucket_name,
        "created_at": datetime.now(UTC)
    }

    await db.aws_config.update_one(
        {"user_id": current_user.user_id},
        {"$set": update_data},
        upsert=True
    )
    
    return {"message": "AWS configuration saved successfully"}

@app.get("/v0/account/aws_config", tags=["account/aws_config"])
async def get_aws_config(current_user: User = Depends(get_admin_user)):
    """Get AWS configuration (admin only)"""
    db = ad.common.get_async_db()
    config = await db.aws_config.find_one({"user_id": current_user.user_id})
    if not config:
        raise HTTPException(status_code=404, detail="AWS configuration not found")
        
    return {
        "access_key_id": ad.crypto.decrypt_token(config["access_key_id"]),
        "secret_access_key": ad.crypto.decrypt_token(config["secret_access_key"]),
        "s3_bucket_name": config.get("s3_bucket_name")
    }

@app.delete("/v0/account/aws_config", tags=["account/aws_config"])
async def delete_aws_config(current_user: User = Depends(get_admin_user)):
    """Delete AWS configuration (admin only)"""
    db = ad.common.get_async_db()
    result = await db.aws_config.delete_one({"user_id": current_user.user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="AWS configuration not found")
    return {"message": "AWS configuration deleted successfully"}

@app.get("/v0/account/organizations", response_model=ListOrganizationsResponse, tags=["account/organizations"])
async def list_organizations(
    user_id: str | None = Query(None, description="Filter organizations by user ID"),
    organization_id: str | None = Query(None, description="Get a specific organization by ID"),
    name_search: str | None = Query(None, description="Case-insensitive search on organization name"),
    member_search: str | None = Query(None, description="Case-insensitive search on member name or email"),
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    current_user: User = Depends(get_current_user)
):
    """
    List organizations or get a specific organization.
    - If organization_id is provided, returns just that organization
    - If user_id is provided, returns organizations for that user
    - Otherwise returns all organizations (admin only)
    - user_id and organization_id are mutually exclusive
    """
    logger.debug(f"list_organizations(): user_id: {user_id} organization_id: {organization_id} current_user: {current_user}")
    db = ad.common.get_async_db()
    is_sys_admin = await is_system_admin(current_user.user_id)

    # user_id and organization_id are mutually exclusive
    if user_id and organization_id:
        raise HTTPException(
            status_code=400,
            detail="Cannot specify both user_id and organization_id"
        )

    # Handle single organization request
    if organization_id:
        try:
            organization = await db.organizations.find_one({"_id": ObjectId(organization_id)})
        except:
            raise HTTPException(status_code=404, detail="Organization not found")
            
        if not organization:
            raise HTTPException(status_code=404, detail="Organization not found")

        # Check permissions
        is_org_admin = await is_organization_admin(organization_id, current_user.user_id)

        if not (is_sys_admin or is_org_admin):
            raise HTTPException(
                status_code=403,
                detail="Not authorized to view this organization"
            )

        return ListOrganizationsResponse(organizations=[
            Organization(**{
                **organization,
                "id": str(organization["_id"]),
                "type": organization["type"]
            })
        ], total_count=1, skip=0)

    # Handle user filter
    if user_id:
        if not is_sys_admin and user_id != current_user.user_id:
            raise HTTPException(
                status_code=403,
                detail="Not authorized to view other users' organizations"
            )
        filter_user_id = user_id
    else:
        filter_user_id = None if is_sys_admin else current_user.user_id

    # Build base filters
    and_filters = []
    if filter_user_id:
        and_filters.append({"members.user_id": filter_user_id})

    # Apply organization name search
    if name_search:
        and_filters.append({"name": {"$regex": name_search, "$options": "i"}})

    # Apply member name/email search
    if member_search:
        # Find users matching by name or email
        user_cursor = db.users.find({
            "$or": [
                {"name": {"$regex": member_search, "$options": "i"}},
                {"email": {"$regex": member_search, "$options": "i"}},
            ]
        }, {"_id": 1})
        matching_users = await user_cursor.to_list(None)
        matching_user_ids = [str(u["_id"]) for u in matching_users]
        if matching_user_ids:
            and_filters.append({"members.user_id": {"$in": matching_user_ids}})
        else:
            # No users matched; return empty result fast
            return ListOrganizationsResponse(organizations=[], total_count=0, skip=skip)

    final_query = {"$and": and_filters} if and_filters else {}

    total_count = await db.organizations.count_documents(final_query)
    cursor = db.organizations.find(final_query).sort("_id", -1).skip(skip).limit(limit)
    organizations = await cursor.to_list(None)

    ret = ListOrganizationsResponse(organizations=[
        Organization(**{
            **org,
            "id": str(org["_id"]),
            "type": org["type"]
        }) for org in organizations
    ], total_count=total_count, skip=skip)
    return ret

@app.post("/v0/account/organizations", response_model=Organization, tags=["account/organizations"])
async def create_organization(
    organization: OrganizationCreate,
    current_user: User = Depends(get_current_user)
):
    """Create a new organization"""
    db = ad.common.get_async_db()

    # Check total organizations limit
    total_orgs = await db.organizations.count_documents({})
    if total_orgs >= limits.MAX_TOTAL_ORGANIZATIONS:
        raise HTTPException(
            status_code=403,
            detail="System limit reached: Maximum number of organizations exceeded"
        )

    # Check user's organization limit
    user_orgs = await db.organizations.count_documents({
        "members.user_id": current_user.user_id
    })
    if user_orgs >= limits.MAX_ORGANIZATIONS_PER_USER:
        raise HTTPException(
            status_code=403,
            detail=f"User limit reached: Cannot be member of more than {limits.MAX_ORGANIZATIONS_PER_USER} organizations"
        )

    # Check for existing organization with same name (case-insensitive)
    existing = await db.organizations.find_one({
        "name": {"$regex": f"^{organization.name}$", "$options": "i"}
    })
    
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"An organization named '{organization.name}' already exists"
        )

    # If creating enterprise organization, verify system admin
    if organization.type == "enterprise":
        if not await is_system_admin(current_user.user_id):
            raise HTTPException(
                status_code=403,
                detail="Only system administrators can create Enterprise organizations"
            )

    organization_doc = {
        "name": organization.name,
        "members": [{
            "user_id": current_user.user_id,
            "role": "admin"
        }],
        "type": organization.type or "team",  # Default to team if not specified
        "created_at": datetime.now(UTC),
        "updated_at": datetime.now(UTC)
    }
    
    result = await db.organizations.insert_one(organization_doc)
    org_id = str(result.inserted_id)

    # Create corresponding payments customer (and Stripe if configured)
    await sync_customer(db=db, org_id=org_id)

    return Organization(**{
        **organization_doc,
        "id": org_id
    })

@app.put("/v0/account/organizations/{organization_id}", response_model=Organization, tags=["account/organizations"])
async def update_organization(
    organization_id: str,
    organization_update: OrganizationUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update an organization (account admin or organization admin)"""
    logger.info(f"Updating organization {organization_id} with {organization_update}")
    db = ad.common.get_async_db()

    organization = await db.organizations.find_one({"_id": ObjectId(organization_id)})
    if not organization:
        logger.error(f"Organization not found: {organization_id}")
        raise HTTPException(status_code=404, detail="Organization not found")

    # Check if user has permission (account admin or organization admin)
    is_sys_admin = await is_system_admin(current_user.user_id)
    is_org_admin = await is_organization_admin(organization_id, current_user.user_id)
    
    if not (is_sys_admin or is_org_admin):
        raise HTTPException(
            status_code=403,
            detail="Not authorized to update this organization"
        )

    # Is the type changing?
    if organization_update.type is not None and organization_update.type != organization["type"]:
        logger.info(f"Updating organization type from {organization['type']} to {organization_update.type}")
        await organizations.update_organization_type(
            db=db,
            organization_id=organization_id,
            update=organization_update,
            current_user_id=current_user.user_id
        )
        # Re-fetch organization after type update to get latest state
        organization = await db.organizations.find_one({"_id": ObjectId(organization_id)})
        if not organization:
            logger.error(f"Organization not found after type update: {organization_id}")
            raise HTTPException(status_code=404, detail="Organization not found")

    update_data = {}
    if organization_update.name is not None:
        update_data["name"] = organization_update.name
    
    if organization_update.members is not None:
        # Ensure at least one admin remains
        if not any(m.role == "admin" for m in organization_update.members):
            logger.error(f"Organization must have at least one admin: {organization_update.members}")
            raise HTTPException(
                status_code=400,
                detail="Organization must have at least one admin"
            )
        update_data["members"] = [m.dict() for m in organization_update.members]

    if update_data:
        update_data["updated_at"] = datetime.now(UTC)
        # Use find_one_and_update instead of update_one to get the updated document atomically
        updated_organization = await db.organizations.find_one_and_update(
            {"_id": ObjectId(organization_id)},
            {"$set": update_data},
            return_document=True  # Return the updated document
        )
        
        if not updated_organization:
            logger.error(f"Organization not found after update: {organization_id}")
            raise HTTPException(status_code=404, detail="Organization not found")
    else:
        # If no updates were needed, just return the current organization
        updated_organization = organization

    # Update the payments customer (and Stripe if configured)
    await sync_customer(db=db, org_id=organization_id)

    return Organization(**{
        "id": str(updated_organization["_id"]),
        "name": updated_organization["name"],
        "members": updated_organization["members"],
        "type": updated_organization["type"],
        "created_at": updated_organization["created_at"],
        "updated_at": updated_organization["updated_at"]
    })

@app.delete("/v0/account/organizations/{organization_id}", tags=["account/organizations"])
async def delete_organization(
    organization_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete an organization (account admin or organization admin)"""
    # Get organization and verify it exists
    db = ad.common.get_async_db()
    organization = await db.organizations.find_one({"_id": ObjectId(organization_id)})
    if not organization:
        raise HTTPException(404, "Organization not found")
    
    # Check if user has permission (account admin or organization admin)
    is_sys_admin = await is_system_admin(current_user.user_id)
    is_org_admin = await is_organization_admin(organization_id, current_user.user_id)
    
    if not (is_sys_admin or is_org_admin):
        raise HTTPException(
            status_code=403,
            detail="Not authorized to delete this organization"
        )

    # Delete the payments customer
    await delete_payments_customer(db=db, org_id=organization_id)
        
    await db.organizations.delete_one({"_id": ObjectId(organization_id)})
    return {"status": "success"}

# Add these new endpoints after the existing ones
@app.get("/v0/account/users", response_model=ListUsersResponse, tags=["account/users"])
async def list_users(
    organization_id: str | None = Query(None, description="Filter users by organization ID"),
    user_id: str | None = Query(None, description="Get a specific user by ID"),
    search_name: str | None = Query(None, description="Case-insensitive search in name or email"),
    skip: int = Query(0, description="Number of users to skip"),
    limit: int = Query(10, description="Number of users to return"),
    current_user: User = Depends(get_current_user)
):
    """
    List users or get a specific user.
    - If user_id is provided, returns just that user (requires proper permissions)
    - If organization_id is provided, returns users from that organization
    - Otherwise returns all users (admin only)
    - user_id and organization_id are mutually exclusive
    """
    logger.debug(f"list_users(): organization_id: {organization_id} user_id: {user_id} current_user: {current_user} skip: {skip} limit: {limit}")
    
    db = ad.common.get_async_db()
    is_sys_admin = await is_system_admin(current_user.user_id)

    # user_id and organization_id are mutually exclusive
    if user_id and organization_id:
        raise HTTPException(
            status_code=400,
            detail="Cannot specify both user_id and organization_id"
        )

    # Build filters and compose final query at the end
    and_filters = []
    
    # Handle single user request
    if user_id:
        try:
            user = await db.users.find_one({"_id": ObjectId(user_id)})
        except:
            raise HTTPException(status_code=404, detail="User not found")
            
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        # Check permissions
        is_self = current_user.user_id == user_id
        
        if not (is_sys_admin or is_self):
            # Check if user is an org admin for any org the target user is in
            user_orgs = await db.organizations.find({
                "members.user_id": user_id
            }).to_list(None)
            
            is_org_admin = any(
                any(m["user_id"] == current_user.user_id and m["role"] == "admin" 
                    for m in org["members"])
                for org in user_orgs
            )
            
            if not is_org_admin:
                raise HTTPException(
                    status_code=403,
                    detail="Not authorized to view this user"
                )
                
        ret = ListUsersResponse(
            users=[UserResponse(
                id=str(user["_id"]),
                email=user["email"],
                name=user.get("name"),
                role=user.get("role", "user"),
                email_verified=user.get("email_verified"),
                created_at=user.get("created_at", datetime.now(UTC)),
                has_password=bool(user.get("password"))
            )],
            total_count=1,
            skip=0
        )
        return ret

    # Handle organization filter
    if organization_id:
        org = await db.organizations.find_one({"_id": ObjectId(organization_id)})
        if not org:
            raise HTTPException(status_code=404, detail="Organization not found")
            
        is_org_admin = any(
            m["user_id"] == current_user.user_id and m["role"] == "admin" 
            for m in org["members"]
        )
        
        if not (is_sys_admin or is_org_admin):
            raise HTTPException(
                status_code=403, 
                detail="Not authorized to view organization users"
            )
            
        member_ids = [m["user_id"] for m in org["members"]]
        and_filters.append({"_id": {"$in": [ObjectId(uid) for uid in member_ids]}})
    elif not is_sys_admin:
        # List all users in organizations the current user is an admin of
        orgs = await db.organizations.find({
            "members.user_id": current_user.user_id,
            "members.role": "admin"
        }).to_list(None)
        member_ids = [m["user_id"] for org in orgs for m in org["members"]]
        
        # Add the current user to the list of users, if they are not already in the list
        if current_user.user_id not in member_ids:
            member_ids.append(current_user.user_id)
        
        and_filters.append({"_id": {"$in": [ObjectId(uid) for uid in member_ids]}})
    else:
        # A system admin can list all users. No need to filter by organization.
        pass

    # Apply search_name filter if provided (search across entire user collection)
    if search_name:
        or_filter = {
            "$or": [
                {"name": {"$regex": search_name, "$options": "i"}},
                {"email": {"$regex": search_name, "$options": "i"}},
            ]
        }
        and_filters.append(or_filter)

    final_query = {"$and": and_filters} if and_filters else {}

    total_count = await db.users.count_documents(final_query)
    users = await db.users.find(final_query).skip(skip).limit(limit).to_list(None)

    ret = ListUsersResponse(
        users=[
            UserResponse(
                id=str(user["_id"]),
                email=user["email"],
                name=user.get("name"),
                role=user.get("role", "user"),
                email_verified=user.get("email_verified"),
                created_at=user.get("created_at", datetime.now(UTC)),
                has_password=bool(user.get("password"))
            )
            for user in users
        ],
        total_count=total_count,
        skip=skip
    )
    return ret

@app.post("/v0/account/users", response_model=UserResponse, tags=["account/users"])
async def create_user(
    user: UserCreate,
    current_user: User = Depends(get_admin_user)
):
    """Create a new user (admin only)"""
    db = ad.common.get_async_db()
    # Check total users limit
    total_users = await db.users.count_documents({})
    if total_users >= limits.MAX_TOTAL_USERS:
        raise HTTPException(
            status_code=403,
            detail="System limit reached: Maximum number of users exceeded"
        )

    # Check if email already exists
    if await db.users.find_one({"email": user.email}):
        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )

    # Check if an organization exists with same name as the user email
    existing_org = await db.organizations.find_one({"name": user.email})
    if existing_org:
        raise HTTPException(
            status_code=400,
            detail=f"An organization with the same name as the user email ({user.email}) already exists"
        )
    
    # Hash password
    hashed_password = hashpw(user.password.encode(), gensalt(12))
    
    # Create user document with default role
    user_doc = {
        "email": user.email,
        "name": user.name,
        "password": hashed_password.decode(),
        "role": "user",  # Always set default role as user
        "email_verified": True,
        "created_at": datetime.now(UTC),
        "has_seen_tour": False
    }
    
    result = await db.users.insert_one(user_doc)
    user_doc["id"] = str(result.inserted_id)
    user_doc["has_password"] = True

    logger.info(f"Created new user {user.email} with id {user_doc['id']}")
    
    # Create default individual organization for new user
    result = await db.organizations.insert_one({
        "name": user.email,
        "members": [{
            "user_id": str(result.inserted_id),
            "role": "admin"
        }],
        "type": "individual",
        "created_at": datetime.now(UTC),
        "updated_at": datetime.now(UTC)
    })

    org_id = str(result.inserted_id)
    logger.info(f"Created new organization {user.email} with id {org_id}")

    # Sync the organization (local and Stripe if configured)
    await sync_customer(db=db, org_id=org_id)
    
    return UserResponse(**user_doc)

@app.put("/v0/account/users/{user_id}", response_model=UserResponse, tags=["account/users"])
async def update_user(
    user_id: str,
    user: UserUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update a user's details (admin or self)"""
    db = ad.common.get_async_db()
    # Check if user has permission (admin or self)
    is_sys_admin = await is_system_admin(current_user.user_id)
    is_self = current_user.user_id == user_id
    
    if not (is_sys_admin or is_self):
        raise HTTPException(
            status_code=403,
            detail="Not authorized to update this user"
        )
    
    # For self-updates, only allow name changes
    update_data = {}
    if is_self and not is_sys_admin:
        if user.name is not None:
            update_data["name"] = user.name
        if user.password is not None:
            update_data["password"] = hashpw(user.password.encode(), gensalt(12)).decode()
        if user.has_seen_tour is not None:
            update_data["has_seen_tour"] = user.has_seen_tour
    else:
        # Admin can update all fields
        update_data = {
            k: v for k, v in user.model_dump().items() 
            if v is not None
        }
        
        # If password is included, hash it
        if "password" in update_data:
            update_data["password"] = hashpw(update_data["password"].encode(), gensalt(12)).decode()
        
        # Don't allow updating the last admin user to non-admin
        if user.role == "user":
            admin_count = await db.users.count_documents({"role": "admin"})
            target_user = await db.users.find_one({"_id": ObjectId(user_id)})
            if admin_count == 1 and target_user and target_user.get("role") == "admin":
                raise HTTPException(
                    status_code=400,
                    detail="Cannot remove admin role from the last admin user"
                )
    
    if not update_data:
        raise HTTPException(
            status_code=400,
            detail="No valid update data provided"
        )
    
    result = await db.users.find_one_and_update(
        {"_id": ObjectId(user_id)},
        {"$set": update_data},
        return_document=True
    )
    
    if not result:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )
    
    return UserResponse(
        id=str(result["_id"]),
        email=result["email"],
        name=result.get("name"),
        role=result.get("role", "user"),
        email_verified=result.get("email_verified"),
        created_at=result.get("created_at", datetime.now(UTC)),
        has_password=bool(result.get("password"))
    )


@app.delete("/v0/account/users/{user_id}", tags=["account/users"])
async def delete_user(
    user_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete a user (admin or self)"""
    db = ad.common.get_async_db()

    # Check if user has permission (admin or self)
    is_sys_admin = await is_system_admin(current_user.user_id)
    is_self = current_user.user_id == user_id
    
    if not (is_sys_admin or is_self):
        raise HTTPException(
            status_code=403,
            detail="Not authorized to delete this user"
        )

    # Is the user an admin of any organization?
    orgs = await db.organizations.find({"members.user_id": user_id}).to_list(None)
    if orgs:
        for org in orgs:
            # Is this a single-user organization?
            members = org["members"]
            if len(members) == 1:
                logger.info(f"Deleting single-user organization {org['_id']}")
                # Delete the organization
                await db.organizations.delete_one({"_id": org["_id"]})
                await delete_payments_customer(db, org_id=org["_id"])
                continue
            
            # Is this the last admin of the organization?
            admin_count = 0
            is_org_admin = False
            for member in members:
                if member["role"] == "admin":
                    admin_count += 1
                    if member["user_id"] == user_id:
                        is_org_admin = True
            if is_org_admin and admin_count == 1:
                raise HTTPException(
                    status_code=400,
                    detail="User is the last admin of an organization and cannot be deleted"
                )
            
            # Remove the user from the organization
            logger.info(f"Removing user {user_id} from organization {org['_id']}")
            await db.organizations.update_one(
                {"_id": org["_id"]},
                {"$pull": {"members": {"user_id": user_id}}}
            )

            # Update the payments customer (and Stripe if configured)
            await sync_customer(db=db, org_id=org["_id"])
    
    # Don't allow deleting the last admin user
    target_user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not target_user:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )
    
    if target_user.get("role") == "admin":
        admin_count = await db.users.count_documents({"role": "admin"})
        if admin_count == 1:
            raise HTTPException(
                status_code=400,
                detail="Cannot delete the last system admin user"
            )
    
    try:
        await users.delete_user(db, user_id)
        return {"message": "User and related data deleted successfully"}
    except Exception as e:
        logger.error(f"Error deleting user {user_id}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to delete user and related data"
        )

@app.post("/v0/account/email/verification/register/{user_id}", tags=["account/email"])
async def send_registration_verification_email(user_id: str):
    """Send verification email for newly registered users (no auth required)"""
    analytiq_client = ad.common.get_analytiq_client()
    db = ad.common.get_async_db(analytiq_client)

    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if user.get("email_verified"):
        raise HTTPException(status_code=400, detail="Email already verified")

    # Generate verification token
    token = f"ver_{secrets.token_urlsafe(32)}"
    expires = (datetime.now(UTC) + timedelta(hours=24)).replace(tzinfo=UTC)
    
    # Store verification token
    await db.email_verifications.update_one(
        {"user_id": user_id},
        {
            "$set": {
                "token": token,
                "expires": expires,
                "email": user["email"]
            }
        },
        upsert=True
    )
        
    verification_url = f"{NEXTAUTH_URL}/auth/verify-email?token={token}"
    
    html_content = email_utils.get_verification_email_content(
        verification_url=verification_url,
        site_url=NEXTAUTH_URL,
        user_name=user.get("name")
    )
        
    # Use the send_email utility function instead of direct SES client call
    await email_utils.send_email(
        analytiq_client,
        to_email=user["email"],
        from_email=SES_FROM_EMAIL,
        subject=email_utils.get_email_subject("verification"),
        content=html_content,
    )
    
    return {"message": "Registration email sent"}


@app.post("/v0/account/email/verification/send/{user_id}", tags=["account/email"])
async def send_verification_email(
    user_id: str,
    current_user: User = Depends(get_admin_user)
):
    """Send verification email (admin only)"""
    analytiq_client = ad.common.get_analytiq_client()
    db = ad.common.get_async_db(analytiq_client)

    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if user.get("email_verified"):
        raise HTTPException(status_code=400, detail="Email already verified")

    # Generate verification token
    token = f"ver_{secrets.token_urlsafe(32)}"
    # Ensure expiration time is stored with UTC timezone
    expires = (datetime.now(UTC) + timedelta(hours=24)).replace(tzinfo=UTC)
    
    # Store verification token
    await db.email_verifications.update_one(
        {"user_id": user_id},
        {
            "$set": {
                "token": token,
                "expires": expires,
                "email": user["email"]
            }
        },
        upsert=True
    )
        
    verification_url = f"{NEXTAUTH_URL}/auth/verify-email?token={token}"
    
    # Get email content from template
    html_content = email_utils.get_verification_email_content(
        verification_url=verification_url,
        site_url=NEXTAUTH_URL,
        user_name=user.get("name")
    )
        
    # Use the send_email utility function instead of direct SES client call
    await email_utils.send_email(
        analytiq_client,
        to_email=user["email"],
        from_email=SES_FROM_EMAIL,
        subject=email_utils.get_email_subject("verification"),
        content=html_content,
    )

    return {"message": "Verification email sent"}

@app.post("/v0/account/email/verification/{token}", tags=["account/email"])
async def verify_email(token: str, background_tasks: BackgroundTasks):
    """Verify email address using token"""
    logger.info(f"Verifying email with token: {token}")
    db = ad.common.get_async_db()

    # Find verification record
    verification = await db.email_verifications.find_one({"token": token})
    if not verification:
        logger.info(f"No verification record found for token: {token}")
        raise HTTPException(status_code=400, detail="Invalid verification token")
        
    # Check if token expired
    # Convert stored expiration to UTC for comparison
    stored_expiry = verification["expires"].replace(tzinfo=UTC)
    if stored_expiry < datetime.now(UTC):
        logger.info(f"Verification token expired: {stored_expiry} < {datetime.now(UTC)}")
        raise HTTPException(status_code=400, detail="Verification token expired")
    
    # Update user's email verification status
    updated_user = await db.users.find_one_and_update(
        {"_id": ObjectId(verification["user_id"])},
        {"$set": {"email_verified": True}},
        return_document=True
    )

    if not updated_user:
        logger.info(f"Failed to verify email for user {verification['user_id']}")
        raise HTTPException(status_code=404, detail="User not found")

    # Ensure a default individual organization exists for the verified user
    # If none exists, create one and sync payments customer
    existing_org = await db.organizations.find_one({
        "members.user_id": str(updated_user["_id"]),
        "type": "individual"
    })
    if not existing_org:
        org_insert_result = await db.organizations.insert_one({
            "name": updated_user.get("email"),
            "members": [{
                "user_id": str(updated_user["_id"]),
                "role": "admin"
            }],
            "type": "individual",
            "created_at": datetime.now(UTC),
            "updated_at": datetime.now(UTC)
        })
        logger.info(f"Created default individual organization for user {updated_user['_id']}")
        try:
            await sync_customer(db=db, org_id=str(org_insert_result.inserted_id))
        except Exception as e:
            logger.warning(f"Failed to sync payments customer for org {org_insert_result.inserted_id}: {e}")
    else:
        logger.info(f"Default individual organization already exists for user {updated_user['_id']}")

    # Allow the user to re-verify their email for 1 minute
    logger.info(f"Scheduling deletion of verification record for token: {token}")
    async def delete_verification_later():
        await asyncio.sleep(60)  # Wait 60 seconds
        await db.email_verifications.delete_one({"token": token})
        logger.info(f"Deleted verification record for token: {token}")

    background_tasks.add_task(delete_verification_later)
    
    return {"message": "Email verified successfully"}

@app.post("/v0/account/email/invitations", response_model=InvitationResponse, tags=["account/email"])
async def create_invitation(
    invitation: CreateInvitationRequest,
    current_user: User = Depends(get_admin_user)
):
    """Create a new invitation (admin only)"""
    logger.info(f"Got invitation request: {invitation}")
    analytiq_client = ad.common.get_analytiq_client()
    db = ad.common.get_async_db(analytiq_client)

    # Check if email already registered, if so, set user_exists to True
    existing_user = await db.users.find_one({"email": invitation.email})
    if existing_user:
        user_exists = True
    else:
        user_exists = False
    
    if user_exists:
        if invitation.organization_id:
            # Check if user is already in the organization
            org = await db.organizations.find_one({
                "_id": ObjectId(invitation.organization_id),
                "members.user_id": existing_user["_id"]
            })
            if org:
                raise HTTPException(status_code=400, detail="User is already a member of this organization")
        else:
            # User already exists, and this is not an org invitation
            raise HTTPException(status_code=400, detail="User already exists")

    if await db.users.find_one({"email": invitation.email}):
        raise HTTPException(
            status_code=400,
            detail="Email already registered for invitation"
        )
        
    # If there's an existing pending invitation for the same organization, invalidate it
    query = {
        "email": invitation.email,
        "status": "pending",
        "expires": {"$gt": datetime.now(UTC)}
    }
    
    # Only add organization_id to query if it exists
    if invitation.organization_id:
        query["organization_id"] = invitation.organization_id
    else:
        # If this is not an org invitation, only invalidate other non-org invitations
        query["organization_id"] = {"$exists": False}

    await db.invitations.update_many(
        query,
        {"$set": {"status": "invalidated"}}
    )

    # Generate invitation token
    token = f"inv_{secrets.token_urlsafe(32)}"
    expires = datetime.now(UTC) + timedelta(hours=24)
    
    # Create invitation document
    invitation_doc = {
        "email": invitation.email,
        "token": token,
        "status": "pending",
        "expires": expires,
        "created_by": current_user.user_id,
        "created_at": datetime.now(UTC),
        "user_exists": user_exists
    }
    
    # Get organization name if this is an org invitation
    organization_name = None
    if invitation.organization_id:
        invitation_doc["organization_id"] = invitation.organization_id
        
        org = await db.organizations.find_one({"_id": ObjectId(invitation.organization_id)})
        if org:
            organization_name = org["name"]
    
    result = await db.invitations.insert_one(invitation_doc)
    invitation_doc["id"] = str(result.inserted_id)
    
    # Send invitation email
    invitation_url = f"{NEXTAUTH_URL}/auth/accept-invitation?token={token}"
    html_content = email_utils.get_invitation_email_content(
        invitation_url=invitation_url,
        site_url=NEXTAUTH_URL,
        expires=expires,
        organization_name=organization_name
    )
    
    try:
        # Send invitation email using the email_utils.send_email() utility function
        await email_utils.send_email(
            analytiq_client,
            to_email=invitation.email,
            from_email=SES_FROM_EMAIL,
            subject=email_utils.get_email_subject("invitation"),
            content=html_content,
        )
        return InvitationResponse(**invitation_doc)
    except Exception as e:
        logger.error(f"Failed to send invitation email: {str(e)}")
        # Delete invitation if email fails
        await db.invitations.delete_one({"_id": result.inserted_id})
        raise HTTPException(
            status_code=500,
            detail=f"Failed to send invitation email: {str(e)}"
        )

@app.get("/v0/account/email/invitations", response_model=ListInvitationsResponse, tags=["account/email"])
async def list_invitations(
    skip: int = Query(0),
    limit: int = Query(10),
    current_user: User = Depends(get_admin_user)
):
    """List all invitations (admin only)"""
    db = ad.common.get_async_db()
    query = {}
    total_count = await db.invitations.count_documents(query)
    cursor = db.invitations.find(query).skip(skip).limit(limit)
    invitations = await cursor.to_list(None)
    
    return ListInvitationsResponse(
        invitations=[
            InvitationResponse(
                id=str(inv["_id"]),
                email=inv["email"],
                status=inv["status"],
                expires=inv["expires"],
                created_by=inv["created_by"],
                created_at=inv["created_at"],
                organization_id=inv.get("organization_id"),
                organization_role=inv.get("organization_role")
            )
            for inv in invitations
        ],
        total_count=total_count,
        skip=skip
    )

@app.get("/v0/account/email/invitations/{token}", response_model=InvitationResponse, tags=["account/email"])
async def get_invitation(token: str):
    """Get invitation details by token"""
    db = ad.common.get_async_db()
    invitation = await db.invitations.find_one({
        "token": token,
        "status": "pending"
    })
    
    if not invitation:
        raise HTTPException(
            status_code=404,
            detail="Invalid or expired invitation"
        )
        
    # Ensure both datetimes are timezone-aware for comparison
    invitation_expires = invitation["expires"].replace(tzinfo=UTC)
    if invitation_expires < datetime.now(UTC):
        await db.invitations.update_one(
            {"_id": invitation["_id"]},
            {"$set": {"status": "expired"}}
        )
        raise HTTPException(
            status_code=400,
            detail="Invitation has expired"
        )

    # Check if user already exists
    user_exists = await db.users.find_one({"email": invitation["email"]}) is not None

    # Get organization name if this is an org invitation
    organization_name = None
    if invitation.get("organization_id"):
        org = await db.organizations.find_one({"_id": ObjectId(invitation["organization_id"])})
        if org:
            organization_name = org["name"]
    
    return InvitationResponse(
        id=str(invitation["_id"]),
        email=invitation["email"],
        status=invitation["status"],
        expires=invitation["expires"],
        created_by=invitation["created_by"],
        created_at=invitation["created_at"],
        organization_id=invitation.get("organization_id"),
        organization_name=organization_name,  # Add organization name
        user_exists=user_exists  # Add user existence status
    )

@app.post("/v0/account/email/invitations/{token}/accept", tags=["account/email"])
async def accept_invitation(
    token: str,
    data: AcceptInvitationRequest = Body(...)  # Change to use AcceptInvitationRequest
):
    """Accept an invitation and create user account if needed"""
    logger.info(f"Accepting invitation with token: {token}")
    db = ad.common.get_async_db()
    # Find and validate invitation
    invitation = await db.invitations.find_one({
        "token": token,
        "status": "pending"
    })
    
    if not invitation:
        raise HTTPException(
            status_code=400,
            detail="Invalid or expired invitation"
        )
        
    # Ensure both datetimes are timezone-aware for comparison
    invitation_expires = invitation["expires"].replace(tzinfo=UTC)
    if invitation_expires < datetime.now(UTC):
        await db.invitations.update_one(
            {"_id": invitation["_id"]},
            {"$set": {"status": "expired"}}
        )
        raise HTTPException(
            status_code=400,
            detail="Invitation has expired"
        )
    
    # Check if user already exists
    existing_user = await db.users.find_one({"email": invitation["email"]})
    
    if existing_user:
        user_id = str(existing_user["_id"])
        
        # If this is an organization invitation, add user to the organization
        if invitation.get("organization_id"):
            # Check if user is already in the organization
            org = await db.organizations.find_one({
                "_id": ObjectId(invitation["organization_id"]),
                "members.user_id": user_id
            })
            
            if org:
                raise HTTPException(
                    status_code=400,
                    detail="User is already a member of this organization"
                )
            
            # Add user to organization
            await db.organizations.update_one(
                {"_id": ObjectId(invitation["organization_id"])},
                {
                    "$push": {
                        "members": {
                            "user_id": user_id,
                            "role": "user"  # Default all invited users to regular member role
                        }
                    }
                }
            )
        
        # Mark invitation as accepted
        await db.invitations.update_one(
            {"_id": invitation["_id"]},
            {"$set": {"status": "accepted"}}
        )
        
        return {"message": "User added to organization successfully"}
    
    # Create new user account if they don't exist
    if not data.name or not data.password:
        raise HTTPException(
            status_code=400,
            detail="Name and password are required for new accounts"
        )

    hashed_password = hashpw(data.password.encode(), gensalt(12))
    user_doc = {
        "email": invitation["email"],
        "name": data.name,
        "password": hashed_password.decode(),
        "role": "user",  # Default all invited users to regular user role
        "email_verified": True,  # Auto-verify since it's from invitation
        "created_at": datetime.now(UTC)
    }
    
    try:
        result = await db.users.insert_one(user_doc)
        user_id = str(result.inserted_id)
        
        # If organization invitation, add to organization
        if invitation.get("organization_id"):
            org_id = invitation["organization_id"]
            await db.organizations.update_one(
                {"_id": ObjectId(org_id)},
                {
                    "$push": {
                        "members": {
                            "user_id": user_id,
                            "role": "user"  # Default all invited users to regular member role
                        }
                    }
                }
            )
        else:
            # Create default individual organization
            result = await db.organizations.insert_one({
                "name": invitation["email"],
                "members": [{
                    "user_id": user_id,
                    "role": "admin"  # User is admin of their individual org
                }],
                "type": "individual",
                "created_at": datetime.now(UTC),
                "updated_at": datetime.now(UTC)
            })

            org_id = str(result.inserted_id)

        # Sync the organization (local and Stripe if configured)
        await sync_customer(db=db, org_id=org_id)
        
        # Mark invitation as accepted
        await db.invitations.update_one(
            {"_id": invitation["_id"]},
            {"$set": {"status": "accepted"}}
        )
        
        return {"message": "Account created successfully"}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create account: {str(e)}"
        )

# Account-level access tokens
@app.post("/v0/account/access_tokens", response_model=AccessToken, tags=["account/access_tokens"])
async def create_account_token(
    request: CreateAccessTokenRequest,
    current_user: User = Depends(get_current_user)
):
    """Create an account-level API token"""
    logger.debug(f"Creating account token for user: {current_user} request: {request}")
    db = ad.common.get_async_db()

    # Generate a globally unique token
    max_attempts = 10
    for attempt in range(max_attempts):
        token = f"acc_{secrets.token_urlsafe(32)}"
        encrypted_token = ad.crypto.encrypt_token(token)
        
        # Check if token already exists
        existing_token = await db.access_tokens.find_one({"token": encrypted_token})
        if not existing_token:
            break
    else:
        raise HTTPException(status_code=500, detail="Failed to generate unique token after multiple attempts")
    
    new_token = {
        "user_id": current_user.user_id,
        "organization_id": None,  # Explicitly set to None for account-level tokens
        "name": request.name,
        "token": encrypted_token,
        "created_at": datetime.now(UTC),
        "lifetime": request.lifetime
    }
    try:
        result = await db.access_tokens.insert_one(new_token)
    except Exception as e:
        # Handle potential duplicate key error from database unique constraint
        if "duplicate key" in str(e).lower() or "duplicate" in str(e).lower():
            raise HTTPException(status_code=500, detail="Token collision detected. Please try again.")
        raise

    new_token["token"] = token  # Return plaintext token to user
    new_token["id"] = str(result.inserted_id)
    return new_token

@app.get("/v0/account/access_tokens", response_model=ListAccessTokensResponse, tags=["account/access_tokens"])
async def list_account_tokens(
    current_user: User = Depends(get_current_user)
):
    """List account-level API tokens"""
    db = ad.common.get_async_db()
    
    cursor = db.access_tokens.find({
        "user_id": current_user.user_id,
        "organization_id": None  # Only get account-level tokens
    })
    tokens = await cursor.to_list(length=None)
    ret = [
        {
            "id": str(token["_id"]),
            "user_id": token["user_id"],
            "organization_id": None,
            "name": token["name"],
            "token": token["token"],
            "created_at": token["created_at"],
            "lifetime": token["lifetime"]
        }
        for token in tokens
    ]
    return ListAccessTokensResponse(access_tokens=ret)

@app.delete("/v0/account/access_tokens/{token_id}", tags=["account/access_tokens"])
async def delete_account_token(
    token_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete an account-level API token"""
    db = ad.common.get_async_db()
    
    result = await db.access_tokens.delete_one({
        "_id": ObjectId(token_id),
        "user_id": current_user.user_id,
        "organization_id": None  # Only delete account-level tokens
    })
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Token not found")
    return {"message": "Token deleted successfully"}

@app.get("/v0/account/token/organization", tags=["account/auth"])
async def get_organization_from_token(
    token: str = Query(..., description="The API token to resolve to organization ID")
):
    """
    Get the organization ID associated with an API token.
    
    Returns the organization ID for org-specific tokens, 
    or null for account-level tokens.
    """
    try:
        org_id = await get_org_id_from_token(token)
        return {"organization_id": org_id}
    except HTTPException as e:
        raise HTTPException(status_code=401, detail="Invalid token")

app.include_router(payments_router)
app.include_router(documents_router)
app.include_router(ocr_router)
app.include_router(llm_router)
app.include_router(prompts_router)
app.include_router(schemas_router)
app.include_router(tags_router)
app.include_router(forms_router)
