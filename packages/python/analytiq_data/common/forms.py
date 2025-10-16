from typing import Optional, List
from analytiq_data.common.client import AnalytiqClient


async def get_form_id(analytiq_client: AnalytiqClient, form_name: str, organization_id: str) -> str:
    """
    Get form ID by name and organization.
    
    Args:
        analytiq_client: The AnalytiqClient instance
        form_name: Name of the form
        organization_id: Organization ID
        
    Returns:
        Form ID if found, None otherwise
    """
    forms = await analytiq_client.list_forms(organization_id, limit=1000)
    
    for form in forms["forms"]:
        if form["name"] == form_name:
            return form["form_id"]
    
    return None


async def get_form_rev_id(analytiq_client: AnalytiqClient,
                          form_id: str,
                          form_version: int) -> str:
    """
    Get form revision ID by form ID and version.
    
    Args:
        analytiq_client: The AnalytiqClient instance
        form_id: Form ID
        form_version: Form version
        
    Returns:
        Form revision ID if found, None otherwise
    """
    forms = await analytiq_client.list_forms(organization_id=None, limit=1000)
    
    for form in forms["forms"]:
        if form["form_id"] == form_id and form["form_version"] == form_version:
            return form["_id"]
    
    return None


async def get_form_name(analytiq_client: AnalytiqClient, form_id: str) -> str:
    """
    Get form name by form ID.
    
    Args:
        analytiq_client: The AnalytiqClient instance
        form_id: Form ID
        
    Returns:
        Form name if found, None otherwise
    """
    forms = await analytiq_client.list_forms(organization_id=None, limit=1000)
    
    for form in forms["forms"]:
        if form["form_id"] == form_id:
            return form["name"]
    
    return None


async def get_form_tag_ids(analytiq_client: AnalytiqClient, form_id: str) -> List[str]:
    """
    Get tag IDs associated with a form.
    
    Args:
        analytiq_client: The AnalytiqClient instance
        form_id: Form ID
        
    Returns:
        List of tag IDs associated with the form
    """
    forms = await analytiq_client.list_forms(organization_id=None, limit=1000)
    
    for form in forms["forms"]:
        if form["form_id"] == form_id:
            return form.get("tag_ids", [])
    
    return []


async def get_form_revision_ids_by_tag_ids(analytiq_client: AnalytiqClient, 
                                           tag_ids: List[str], 
                                           latest_version: bool = True) -> List[str]:
    """
    Get form revision IDs filtered by tag IDs.
    
    Args:
        analytiq_client: The AnalytiqClient instance
        tag_ids: List of tag IDs to filter by
        latest_version: If True, return only the latest version of each form that matches tag criteria
        
    Returns:
        List of form revision IDs that match the tag criteria
    """
    forms = await analytiq_client.list_forms(organization_id=None, limit=1000)
    
    # Group forms by form_id to handle versioning
    form_groups = {}
    for form in forms["forms"]:
        form_id = form["form_id"]
        if form_id not in form_groups:
            form_groups[form_id] = []
        form_groups[form_id].append(form)
    
    matching_form_rev_ids = []
    
    for form_id, form_versions in form_groups.items():
        # Sort by version to get the latest
        form_versions.sort(key=lambda x: x["form_version"])
        
        if latest_version:
            # Get the latest version and check if it matches tag criteria
            latest_form = form_versions[-1]
            form_tag_ids = latest_form.get("tag_ids", [])
            
            # Only include if the latest version matches the tag criteria
            if any(tag_id in form_tag_ids for tag_id in tag_ids):
                matching_form_rev_ids.append(latest_form["_id"])
        else:
            # Get all versions that match
            for form_version in form_versions:
                form_tag_ids = form_version.get("tag_ids", [])
                if any(tag_id in form_tag_ids for tag_id in tag_ids):
                    matching_form_rev_ids.append(form_version["_id"])
    
    return matching_form_rev_ids
