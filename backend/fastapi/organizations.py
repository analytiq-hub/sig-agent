from datetime import datetime, UTC
from bson import ObjectId
from typing import List
import logging

from fastapi import HTTPException
import users
from schemas import OrganizationUpdate

def validate_organization_type_upgrade(current_type: str, new_type: str) -> bool:
    """
    Validate if the organization type upgrade is allowed.
    
    Args:
        current_type: Current organization type
        new_type: Requested new organization type
    
    Returns:
        bool: True if upgrade is valid, False otherwise
    """
    valid_upgrades = {
        "individual": ["individual", "team", "enterprise"],
        "team": ["team", "enterprise"],
        "enterprise": ["enterprise"]
    }
    return new_type in valid_upgrades.get(current_type, [])

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
    logging.info(f"Updating organization {organization_id} to type {update.type}")

    # Get the organization
    organization = await db.organizations.find_one({"_id": ObjectId(organization_id)})
    if not organization:
        raise HTTPException(status_code=404, detail="Organization not found")

    if update.type is None:
        raise HTTPException(status_code=400, detail="New organization type is required")

    # Validate organization type upgrade
    current_type = organization["type"]
    if not validate_organization_type_upgrade(current_type, update.type):
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid organization type upgrade. Cannot change from {current_type} to {update.type}"
        )

    # Find the first admin in the current organization
    first_admin = next((m for m in organization["members"] if m["role"] == "admin"), None)
    if not first_admin:
        raise HTTPException(status_code=400, detail="Organization must have at least one admin")

    # Validate parameters based on new type
    if update.type in ["team", "enterprise"]:
        if not update.members:
            raise HTTPException(status_code=400, detail="members required for team/enterprise organizations")
        if not any(m.role == "admin" for m in update.members):
            raise HTTPException(status_code=400, detail="Organization must have at least one admin")
  
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