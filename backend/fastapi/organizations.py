from datetime import datetime, UTC
from bson import ObjectId
from typing import List
import logging

from fastapi import HTTPException
import users
from schemas import OrganizationUpdate

async def update_organization_type(
    db, 
    organization_id: str, 
    update: OrganizationUpdate
) -> None:
    """
    Update an organization's type and handle member management.
    
    Args:
        db: MongoDB database instance
        organization_id: ID of the organization to update
        update: OrganizationUpdate model containing new type and optional members
    """
    # Get the organization
    organization = await db.organizations.find_one({"_id": ObjectId(organization_id)})
    if not organization:
        raise HTTPException(status_code=404, detail="Organization not found")

    if update.type is None:
        raise HTTPException(status_code=400, detail="New organization type is required")

    # Find the first admin in the current organization
    first_admin = next((m for m in organization["members"] if m["role"] == "admin"), None)
    if not first_admin:
        raise HTTPException(status_code=400, detail="Organization must have at least one admin")

    # Validate parameters based on new type
    if update.type == "personal":
        # Get user details for setting organization name
        user = await db.users.find_one({"_id": ObjectId(first_admin["user_id"])})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
            
        # Delete personal organizations of the user
        await db.organizations.delete_many({
            "members.user_id": first_admin["user_id"],
            "type": "personal"
        })
        
        # Set up personal organization data
        update_data = {
            "type": "personal",
            "name": user["email"],
            "members": [{
                "user_id": first_admin["user_id"],
                "role": "admin"
            }]
        }

        logging.info(f"Updated organization {organization_id} to type {update.type} for first admin user {first_admin['user_id']}")
    else:  # team or enterprise
        if not update.members:
            raise HTTPException(status_code=400, detail="members required for team/enterprise organizations")
        if not any(m.role == "admin" for m in update.members):
            raise HTTPException(status_code=400, detail="Organization must have at least one admin")
            
        # Delete personal organizations of all new team members
        member_ids = [m.user_id for m in update.members]
        if member_ids:
            result = await db.organizations.delete_many({
                "members.user_id": {"$in": member_ids},
                "type": "personal"
            })
            logging.info(f"Deleted {result.deleted_count} personal organizations")
            
        # Set up team/enterprise organization data
        update_data = {
            "type": update.type,
            "members": [m.dict() for m in update.members]
        }

    # Update the organization
    update_data["updated_at"] = datetime.now(UTC)
    await db.organizations.update_one(
        {"_id": ObjectId(organization_id)},
        {"$set": update_data}
    )
    
    logging.info(f"Updated organization {organization_id} to type {update.type}")