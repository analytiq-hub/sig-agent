from datetime import datetime, UTC
from bson import ObjectId
from typing import List
import logging

from fastapi import HTTPException
import users

async def update_organization_type(
    db, 
    organization_id: str, 
    new_type: str,
    members: List[dict] | None = None,
    user_id: str | None = None
) -> None:
    """
    Update an organization's type and handle member management.
    
    Args:
        db: MongoDB database instance
        organization_id: ID of the organization to update
        new_type: New organization type ('personal', 'team', or 'enterprise')
        members: List of new member objects with user_id and role (required for team/enterprise)
        user_id: ID of the user who will own the personal organization (required for personal)
    """
    # Get the organization
    organization = await db.organizations.find_one({"_id": ObjectId(organization_id)})
    if not organization:
        raise HTTPException(status_code=404, detail="Organization not found")

    # Validate parameters based on new type
    if new_type == "personal":
        if not user_id:
            raise HTTPException(status_code=400, detail="user_id required for personal organizations")
        # Get user details for setting organization name
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
            
        # Delete personal organizations of the user
        await db.organizations.delete_many({
            "members.user_id": user_id,
            "type": "personal"
        })
        
        # Set up personal organization data
        update_data = {
            "type": "personal",
            "name": user["email"],
            "members": [{
                "user_id": user_id,
                "role": "admin"
            }]
        }
    else:  # team or enterprise
        if not members:
            raise HTTPException(status_code=400, detail="members required for team/enterprise organizations")
        if not any(m["role"] == "admin" for m in members):
            raise HTTPException(status_code=400, detail="Organization must have at least one admin")
            
        # Delete personal organizations of all new team members
        member_ids = [m["user_id"] for m in members]
        if member_ids:
            result = await db.organizations.delete_many({
                "members.user_id": {"$in": member_ids},
                "type": "personal"
            })
            logging.info(f"Deleted {result.deleted_count} personal organizations")
            
        # Set up team/enterprise organization data
        update_data = {
            "type": new_type,
            "members": members
        }

    # Update the organization
    update_data["updated_at"] = datetime.now(UTC)
    await db.organizations.update_one(
        {"_id": ObjectId(organization_id)},
        {"$set": update_data}
    )
    
    logging.info(f"Updated organization {organization_id} to type {new_type}")