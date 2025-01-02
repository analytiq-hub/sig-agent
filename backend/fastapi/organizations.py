from datetime import datetime, UTC
from bson import ObjectId
from typing import List
import logging

from fastapi import HTTPException
import users

async def update_organization_to_team(db, organization_id: str, members: List[dict]) -> None:
    """
    Convert an organization from personal to team and handle member cleanup.
    
    Args:
        db: MongoDB database instance
        organization_id: ID of the organization to convert
        members: List of new member objects with user_id and role
    """
    # Get the organization
    organization = await db.organizations.find_one({"_id": ObjectId(organization_id)})
    if not organization:
        raise HTTPException(status_code=404, detail="Organization not found")

    if not organization.get("isPersonal", False):
        logging.info(f"Organization {organization_id} is already a team organization")
        return

    # Get all new member IDs
    new_member_ids = {m["user_id"] for m in members}

    # Delete personal organizations of all new team members
    if new_member_ids:
        result = await db.organizations.delete_many({
            "members.user_id": {"$in": list(new_member_ids)},
            "isPersonal": True
        })
        logging.info(f"Deleted {result.deleted_count} personal organizations")

    # Update the organization to team type
    await db.organizations.update_one(
        {"_id": ObjectId(organization_id)},
        {
            "$set": {
                "isPersonal": False,
                "members": members,
                "updated_at": datetime.now(UTC)
            }
        }
    )

async def update_organization_to_personal(db, organization_id: str, user_id: str) -> None:
    """
    Convert an organization from team to personal for a specific user.
    Removes all other members, deletes their user accounts, and updates organization properties.
    
    Args:
        db: MongoDB database instance
        organization_id: ID of the organization to convert
        user_id: ID of the user who will own the personal organization
    """
    # Get the organization
    organization = await db.organizations.find_one({"_id": ObjectId(organization_id)})
    if not organization:
        raise HTTPException(status_code=404, detail="Organization not found")

    if organization.get("isPersonal", False):
        logging.info(f"Organization {organization_id} is already a personal organization")
        return

    # Get user details for setting organization name
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Get all other member IDs
    other_member_ids = [
        m["user_id"] for m in organization["members"] 
        if m["user_id"] != user_id
    ]

    # Update the organization to personal type
    await db.organizations.update_one(
        {"_id": ObjectId(organization_id)},
        {
            "$set": {
                "isPersonal": True,
                "name": user["email"],  # Set name to user's email
                "members": [{
                    "user_id": user_id,
                    "role": "admin"
                }],
                "updated_at": datetime.now(UTC)
            }
        }
    )

    deleted_count = 0
    for user_id in other_member_ids:
        # Delete user if not a member of any other organizations
        if not await db.organizations.find_one({"members.user_id": user_id}):
            await users.delete_user(db, user_id)
            deleted_count += 1

    if deleted_count > 0:
        logging.info(f"Deleted {deleted_count} user accounts not in other organizations")