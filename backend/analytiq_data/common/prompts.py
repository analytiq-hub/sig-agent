from datetime import datetime, UTC
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient

import analytiq_data as ad

async def get_prompt_id(analytiq_client, prompt_name: str) -> str:
    """
    Get a prompt ID by its name

    Args:
        analytiq_client: AnalytiqClient
            The analytiq client
        prompt_name: str
            Prompt name

    Returns:
        str
            Prompt ID
    """
    db_name = analytiq_client.env
    db = analytiq_client.mongodb_async[db_name]
    collection = db["prompt_revisions"]
    elem = await collection.find_one({"name": prompt_name})
    if elem is None:
        raise ValueError(f"Prompt {prompt_name} not found")
    return str(elem["_id"])

async def get_prompt_name(analytiq_client, prompt_id: str) -> str:
    """
    Get a prompt name by its ID
    """
    db_name = analytiq_client.env
    db = analytiq_client.mongodb_async[db_name]
    collection = db["prompt_revisions"]
    elem = await collection.find_one({"_id": ObjectId(prompt_id)})
    if elem is None:
        raise ValueError(f"Prompt {prompt_id} not found")
    return elem["name"]

async def get_default_prompt_content(analytiq_client) -> str:
    """
    Get the default prompt content

    Args:
        analytiq_client: AnalytiqClient
            The analytiq client

    Returns:
        str
            Prompt content
    """
    prompt = f"""Extract the document type, company name and address from the following text. 
    Return the result in JSON format.
    
    Examples:
    Input: "INVOICE ABC Corp. 123 Business St, New York, NY 10001 Invoice #12345"
    Output: {{
        "document_type": "invoice",
        "company_name": "ABC Corp.",
        "address": "123 Business St, New York, NY 10001"
    }}
    
    Input: "Purchase Order XYZ Industries 456 Industrial Ave, Chicago, IL 60601"
    Output: {{
        "document_type": "purchase_order",
        "company_name": "XYZ Industries",
        "address": "456 Industrial Ave, Chicago, IL 60601"
    }}
    
    Input: "Statement of Account Global Trading Co. 789 Commerce Rd, Los Angeles, CA 90001"
    Output: {{
        "document_type": "statement",
        "company_name": "Global Trading Co.",
        "address": "789 Commerce Rd, Los Angeles, CA 90001"
    }}
    """
    return prompt
async def get_prompt_content(analytiq_client, prompt_id: str) -> str:
    """
    Get a prompt content by its ID
    
    Args:
        analytiq_client: AnalytiqClient
            The analytiq client
        prompt_id: str
            Prompt ID

    Returns:
        str
            Prompt content
    """
    # Special case for the default prompt
    if prompt_id == "default":
        return await get_default_prompt_content(analytiq_client)

    # Get the prompt content
    db_name = analytiq_client.env
    db = analytiq_client.mongodb_async[db_name]
    collection = db["prompt_revisions"]
    
    elem = await collection.find_one({"_id": ObjectId(prompt_id)})
    if elem is None:
        raise ValueError(f"Prompt {prompt_id} not found")
    return elem["content"]

async def get_prompt_response_format(analytiq_client, prompt_id: str) -> dict:
    """
    Get a prompt response format by its ID
    
    Returns:
        dict: The schema in JSON Schema format
    """
    db_name = analytiq_client.env
    db = analytiq_client.mongodb_async[db_name]
    collection = db["prompt_revisions"]
    elem = await collection.find_one({"_id": ObjectId(prompt_id)})
    if elem is None:
        raise ValueError(f"Prompt {prompt_id} not found")
    schema_id = elem.get("schema_id", None)
    schema_version = elem.get("schema_version", None)
    if schema_id is None or schema_version is None:
        return None

    # Get the schema from the name and version
    collection = db["schema_revisions"]
    elem = await collection.find_one({"schema_id": schema_id, "schema_version": schema_version})
    if elem is None:
        raise ValueError(f"Prompt {prompt_id}: Schema {schema_id} version {schema_version} not found")
    return elem["response_format"]

async def get_prompt_tag_ids(analytiq_client, prompt_id: str) -> list[str]:
    """
    Get a prompt tag IDs by its ID

    Args:
        analytiq_client: AnalytiqClient
            The analytiq client
        prompt_id: str
            Prompt ID

    Returns:
        list[str]
            Prompt tag IDs
    """
    db_name = analytiq_client.env
    db = analytiq_client.mongodb_async[db_name]
    collection = db["prompt_revisions"]
    elem = await collection.find_one({"_id": ObjectId(prompt_id)})
    return elem["tag_ids"]

async def get_prompt_ids_by_tag_ids(analytiq_client, tag_ids: list[str], latest_version: bool = True) -> list[str]:
    """
    Get prompt IDs by tag IDs

    Args:
        analytiq_client: AnalytiqClient
            The analytiq client
        tag_ids: list[str]
            Tag IDs

    Returns:
        list[str]
            Prompt IDs
    """
    db_name = analytiq_client.env
    db = analytiq_client.mongodb_async[db_name]
    collection = db["prompt_revisions"]
    elems = await collection.find({"tag_ids": {"$in": tag_ids}}).to_list(length=None)

    if not latest_version:
        # Return all prompt IDs
        prompt_ids = [str(elem["_id"]) for elem in elems]
    else:
        # Return only the latest version of each prompt
        collection2 = db["prompts"]
        prompt_names = [elem["name"] for elem in elems]

        # Initialize the list of prompt IDs
        prompt_ids = []

        # Get the latest version of each prompt
        elems2 = await collection2.find({"_id": {"$in": prompt_names}}).to_list(length=None)
        for elem in elems2:
            # Get the prompt name and version
            prompt_name = elem["_id"]
            prompt_version = elem["prompt_version"]
            # Look for the prompt name and version in the list of prompts
            for elem in elems:
                if elem["name"] == prompt_name and elem["prompt_version"] == prompt_version:
                    prompt_ids.append(str(elem["_id"]))
                    break
    
    return prompt_ids