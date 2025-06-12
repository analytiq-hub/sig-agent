import os
import logging
from bson import ObjectId
import logging
from typing import List

from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi import APIRouter, Depends, HTTPException, Request, Body, BackgroundTasks, Security

import analytiq_data as ad

# Configure logger
logger = logging.getLogger(__name__)

FASTAPI_SECRET = os.getenv("FASTAPI_SECRET")
ALGORITHM = os.getenv("ALGORITHM")

security = HTTPBearer()

# Modify get_current_user to validate based on context
async def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security), request: Request = None):
    """
    Validate user based on JWT or API token, considering the API context.
    Account APIs only accept account-level tokens.
    Organization APIs only accept org-specific tokens for that organization.
    """
    db = ad.common.get_async_db()
    token = credentials.credentials
    
    # Get API context
    context_type, org_id = get_api_context(request.url.path)
    
    try:
        # First, try to validate as JWT (always valid for both contexts)
        payload = jwt.decode(token, FASTAPI_SECRET, algorithms=[ALGORITHM])
        userId: str = payload.get("userId")
        userName: str = payload.get("userName")
        email: str = payload.get("email")
        
        if userName is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
        
        # Validate that userId exists in database
        user = await db.users.find_one({"_id": ObjectId(userId)})
        if not user:
            raise HTTPException(status_code=401, detail="User not found in database")

        # TO DO: Validate that the user is a member of the organization
        # if org_id:
        #     org_member = await db.org_members.find_one({
        #         "user_id": userId,
        #         "organization_id": org_id
        #     })
        #     if not org_member:
        #         raise HTTPException(status_code=401, detail="User not a member of organization")
            
        return User(
            user_id=userId,
            user_name=userName,
            token_type="jwt"
        )
                   
    except JWTError:
        # If JWT validation fails, check if it's an API token
        encrypted_token = ad.crypto.encrypt_token(token)
        logger.info(f"token: {token}")
        logger.info(f"encrypted_token: {encrypted_token}")
        logger.info(f"context_type: {context_type}")
        logger.info(f"org_id: {org_id}")
        
        # Build query based on context
        token_query = {"token": encrypted_token}
        
        if context_type == "account":
            # For account APIs, only accept account-level tokens
            token_query["organization_id"] = None
        elif context_type == "organization" and org_id:
            # For org APIs, only accept tokens for that specific org
            token_query["organization_id"] = org_id
        else:
            raise HTTPException(status_code=401, detail="Invalid API context")
            
        stored_token = await db.access_tokens.find_one(token_query)
        logger.info(f"stored_token: {stored_token}")
        
        if stored_token:
            # Validate that user_id from stored token exists in database
            user = await db.users.find_one({"_id": ObjectId(stored_token["user_id"])})
            if not user:
                raise HTTPException(status_code=401, detail="User not found in database")
                
            return User(
                user_id=stored_token["user_id"],
                user_name=stored_token["name"],
                token_type="api"
            )
                
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")

# Add this helper function to check admin status
async def get_admin_user(credentials: HTTPAuthorizationCredentials = Security(security), request: Request = None):
    user = await get_current_user(credentials, request)
    db = ad.common.get_async_db()

    # Check if user has admin role in database
    db_user = await db.users.find_one({"_id": ObjectId(user.user_id)})
    if not db_user or db_user.get("role") != "admin":
        raise HTTPException(
            status_code=403,
            detail="Admin access required"
        )
    return user

async def delete_user(db, user_id: str) -> bool:
    """
    Delete a single user and clean up all associated data.
    Removes user from all organizations and deletes organizations where they were the last member.
    
    Args:
        db: MongoDB database instance
        user_id: ID of the user to delete
        
    Returns:
        bool: True if user was deleted, False if user was not found
    """
    try:
        # Find all organizations where user is a member
        async for org in db.organizations.find({"members.user_id": user_id}):
            if len(org["members"]) == 1:
                # If user is the only member, delete the organization
                await db.organizations.delete_one({"_id": org["_id"]})
                logging.info(f"Deleted organization {org['_id']} as user was the last member")
            else:
                # Otherwise, remove user from organization
                await db.organizations.update_one(
                    {"_id": org["_id"]},
                    {"$pull": {"members": {"user_id": user_id}}}
                )
                logging.info(f"Removed user {user_id} from organization {org['_id']}")

        # Delete user's OAuth accounts
        await db.accounts.delete_many({"userId": user_id})
        
        # Delete user's sessions
        await db.sessions.delete_many({"userId": user_id})
        
        # Delete the user
        result = await db.users.delete_one({"_id": ObjectId(user_id)})
        
        if result.deleted_count == 0:
            logging.warning(f"User {user_id} not found")
            return False
            
        logging.info(f"Successfully deleted user {user_id} and all associated data")
        return True
        
    except Exception as e:
        logging.error(f"Error deleting user {user_id}: {str(e)}")
        raise