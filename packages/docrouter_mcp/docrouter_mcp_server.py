"""
FastMCP Server with APIs for data, prompts, and tools
"""

import os
from mcp.server.fastmcp import FastMCP, Context # type: ignore
from typing import Dict, List, Any, Annotated
import json
from contextlib import asynccontextmanager
from datetime import datetime
import inspect
from functools import wraps
import logging
import argparse  # Add this import

from docrouter_sdk import DocRouterClient

logging.basicConfig(level=logging.WARNING)  # Only show WARNING and above (ERROR, CRITICAL)

# Add command line argument parsing
parser = argparse.ArgumentParser(description='DocRouter MCP Server')
parser.add_argument('--url', help='DocRouter URL. Also accepts DOCROUTER_URL environment variable.')
parser.add_argument('--org-id', help='DocRouter Organization ID. Also accepts DOCROUTER_ORG_ID environment variable.')
parser.add_argument('--org-api-token', help='DocRouter Organization API Token. Also accepts DOCROUTER_ORG_API_TOKEN environment variable.')
args = parser.parse_args()

# Use command line args if provided, otherwise fall back to environment variables
DOCROUTER_URL = args.url or os.getenv("DOCROUTER_URL")
DOCROUTER_ORG_ID = args.org_id or os.getenv("DOCROUTER_ORG_ID")
DOCROUTER_ORG_API_TOKEN = args.org_api_token or os.getenv("DOCROUTER_ORG_API_TOKEN")

# Add this class near the top of the file with other imports
class DateTimeEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)

# Mock database for demonstration
class Database:
    def __init__(self):
        self.data = {
            "users": [
                {"id": 1, "name": "John Doe", "email": "john@example.com"},
                {"id": 2, "name": "Jane Smith", "email": "jane@example.com"}
            ],
            "products": [
                {"id": 101, "name": "Laptop", "price": 999.99},
                {"id": 102, "name": "Smartphone", "price": 499.99}
            ]
        }
    
    async def connect(self):
        # Simulate connection
        return self
    
    async def disconnect(self):
        # Simulate disconnection
        pass
    
    def query_users(self):
        return self.data["users"]
    
    def query_products(self):
        return self.data["products"]
    
    def get_user(self, user_id: int):
        for user in self.data["users"]:
            if user["id"] == user_id:
                return user
        return None
    
    def get_product(self, product_id: int):
        for product in self.data["products"]:
            if product["id"] == product_id:
                return product
        return None

# Application context for dependency injection
class AppContext:
    def __init__(self, db: Database, docrouter_client: DocRouterClient):
        self.db = db
        self.docrouter_client = docrouter_client

# Create lifespan context manager for database connection
@asynccontextmanager
async def app_lifespan(server: FastMCP):
    # Initialize resources on startup
    db = await Database().connect()
    docrouter_client = DocRouterClient(
        base_url=DOCROUTER_URL,
        api_token=DOCROUTER_ORG_API_TOKEN
    )
    
    try:
        yield AppContext(db=db, docrouter_client=docrouter_client)
    finally:
        # Cleanup on shutdown
        await db.disconnect()

# Create the FastMCP server with lifespan
mcp = FastMCP(
    "DocRouter Server", 
    instructions="A DocRouter server providing APIs for data, prompts, and tools",
    lifespan=app_lifespan
)

# Helper function to get context
def get_context() -> Context:
    return mcp.get_context()

# ---- DOCROUTER RESOURCES ----

@mcp.tool()
def get_docrouter_documents() -> str:
    """Get all documents from DocRouter"""
    ctx = get_context()
    docrouter_client = ctx.request_context.lifespan_context.docrouter_client
    
    try:
        documents = docrouter_client.documents.list(DOCROUTER_ORG_ID)
        # Convert documents to proper Python dictionaries instead of JSON strings
        result = {
            "documents": [doc.dict() for doc in documents.documents],
            "total_count": documents.total_count
        }
        
        # Return JSON string with custom encoder
        return json.dumps(result, cls=DateTimeEncoder)
    except Exception as e:
        ctx.error(f"Error fetching documents: {str(e)}")
        return json.dumps({"error": str(e)})

@mcp.tool()
def get_docrouter_document(document_id: str) -> str:
    """Get document by ID from DocRouter"""
    ctx = get_context()
    docrouter_client = ctx.request_context.lifespan_context.docrouter_client
    
    try:
        document = docrouter_client.documents.get(DOCROUTER_ORG_ID, document_id)
        return json.dumps(document.dict(), indent=2, cls=DateTimeEncoder)
    except Exception as e:
        ctx.error(f"Error fetching document {document_id}: {str(e)}")
        return json.dumps({"error": str(e)}, indent=2)

@mcp.tool()
def get_docrouter_document_ocr(document_id: str) -> str:
    """
    Get the raw OCR text for a document from DocRouter.
    
    This endpoint returns the plain text extracted from the document.
    Use this when you need to see the raw text content of a document.
    Do NOT use run_docrouter_extraction() for this purpose.

    Args:
        document_id: ID of the document to get OCR text for
    """
    ctx = get_context()
    docrouter_client = ctx.request_context.lifespan_context.docrouter_client
    
    try:
        ocr_text = docrouter_client.ocr.get_text(DOCROUTER_ORG_ID, document_id)
        return ocr_text
    except Exception as e:
        ctx.error(f"Error fetching OCR for document {document_id}: {str(e)}")
        return json.dumps({"error": str(e)}, indent=2)

@mcp.tool()
def get_docrouter_document_ocr_page(document_id: str, page_num: int) -> str:
    """
    Get OCR text for a specific page of a document from DocRouter
    
    This endpoint returns the plain text extracted from the specified page of the document.
    Use this when you need to see the raw text content of a specific page of a document.
    Do NOT use run_docrouter_extraction() for this purpose.

    Args:
        document_id: ID of the document to get OCR text for
        page_num: Page number to get OCR text for
    """
    ctx = get_context()
    docrouter_client = ctx.request_context.lifespan_context.docrouter_client
    
    try:
        ocr_text = docrouter_client.ocr.get_text(DOCROUTER_ORG_ID, document_id, page_num=page_num)
        return ocr_text
    except Exception as e:
        ctx.error(f"Error fetching OCR for document {document_id} page {page_num}: {str(e)}")
        return json.dumps({"error": str(e)}, indent=2)

@mcp.tool()
def get_docrouter_document_ocr_metadata(document_id: str) -> str:
    """Get OCR metadata for a document from DocRouter"""
    ctx = get_context()
    docrouter_client = ctx.request_context.lifespan_context.docrouter_client
    
    try:
        metadata = docrouter_client.ocr.get_metadata(DOCROUTER_ORG_ID, document_id)
        return json.dumps(metadata, indent=2, cls=DateTimeEncoder)
    except Exception as e:
        ctx.error(f"Error fetching OCR metadata for document {document_id}: {str(e)}")
        return json.dumps({"error": str(e)}, indent=2)

@mcp.tool()
def get_docrouter_tags() -> str:
    """Get all tags from DocRouter"""
    ctx = get_context()
    docrouter_client = ctx.request_context.lifespan_context.docrouter_client
    
    try:
        tags = docrouter_client.tags.list(DOCROUTER_ORG_ID)
        return json.dumps({
            "tags": [tag.dict() for tag in tags.tags],
            "total_count": tags.total_count
        }, indent=2, cls=DateTimeEncoder)
    except Exception as e:
        ctx.error(f"Error fetching tags: {str(e)}")
        return json.dumps({"error": str(e)}, indent=2)

@mcp.tool()
def get_docrouter_tag(tag_id: str) -> str:
    """Get tag by ID from DocRouter"""
    ctx = get_context()
    docrouter_client = ctx.request_context.lifespan_context.docrouter_client
    
    try:
        tag = docrouter_client.tags.get(DOCROUTER_ORG_ID, tag_id)
        return json.dumps(tag.dict(), indent=2, cls=DateTimeEncoder)
    except Exception as e:
        ctx.error(f"Error fetching tag {tag_id}: {str(e)}")
        return json.dumps({"error": str(e)}, indent=2)

@mcp.tool()
def get_docrouter_prompts() -> str:
    """Get all prompts from DocRouter"""
    ctx = get_context()
    docrouter_client = ctx.request_context.lifespan_context.docrouter_client
    
    try:
        prompts = docrouter_client.prompts.list(DOCROUTER_ORG_ID)
        return json.dumps({
            "prompts": [prompt.dict() for prompt in prompts.prompts],
            "total_count": prompts.total_count
        }, indent=2, cls=DateTimeEncoder)
    except Exception as e:
        ctx.error(f"Error fetching prompts: {str(e)}")
        return json.dumps({"error": str(e)}, indent=2)

@mcp.tool()
def get_docrouter_prompt(prompt_id: str) -> str:
    """Get prompt by ID from DocRouter"""
    ctx = get_context()
    docrouter_client = ctx.request_context.lifespan_context.docrouter_client
    
    try:
        prompt = docrouter_client.prompts.get(DOCROUTER_ORG_ID, prompt_id)
        
        # If the prompt has a schema, fetch the schema details
        schema_info = {}
        if prompt.schema_id:
            try:
                schema = docrouter_client.schemas.get(DOCROUTER_ORG_ID, prompt.schema_id)
                schema_info = schema.dict()
            except Exception as schema_err:
                ctx.warning(f"Error fetching schema {prompt.schema_id}: {str(schema_err)}")
        
        # Combine prompt with schema info
        result = prompt.dict()
        result["schema_details"] = schema_info
        
        return json.dumps(result, indent=2, cls=DateTimeEncoder)
    except Exception as e:
        ctx.error(f"Error fetching prompt {prompt_id}: {str(e)}")
        return json.dumps({"error": str(e)}, indent=2)

@mcp.tool()
def get_docrouter_extraction(document_id: str, prompt_id: str) -> str:
    """Get extraction results for a document using a specific prompt"""
    ctx = get_context()
    docrouter_client = ctx.request_context.lifespan_context.docrouter_client
    
    try:
        result = docrouter_client.llm.get_result(DOCROUTER_ORG_ID, document_id, prompt_id)
        return json.dumps(result.dict(), indent=2, cls=DateTimeEncoder)
    except Exception as e:
        ctx.error(f"Error fetching extraction for document {document_id} with prompt {prompt_id}: {str(e)}")
        return json.dumps({"error": str(e)}, indent=2)

# ---- DOCROUTER TOOLS (CONVERTED FROM RESOURCES) ----

@mcp.tool()
def get_docrouter_documents() -> str:
    """
    Get all documents from DocRouter
    
    Returns a JSON string containing all documents in the organization.
    """
    ctx = get_context()
    docrouter_client = ctx.request_context.lifespan_context.docrouter_client
    
    try:
        documents = docrouter_client.documents.list(DOCROUTER_ORG_ID)
        # Convert documents to proper Python dictionaries instead of JSON strings
        result = {
            "documents": [doc.dict() for doc in documents.documents],
            "total_count": documents.total_count
        }
        
        # Return JSON string with custom encoder
        return json.dumps(result, cls=DateTimeEncoder)
    except Exception as e:
        ctx.error(f"Error fetching documents: {str(e)}")
        return json.dumps({"error": str(e)})

@mcp.tool()
def get_docrouter_document(document_id: str) -> str:
    """
    Get document by ID from DocRouter
    
    Args:
        document_id: ID of the document to retrieve
    """
    ctx = get_context()
    docrouter_client = ctx.request_context.lifespan_context.docrouter_client
    
    try:
        document = docrouter_client.documents.get(DOCROUTER_ORG_ID, document_id)
        return json.dumps(document.dict(), indent=2, cls=DateTimeEncoder)
    except Exception as e:
        ctx.error(f"Error fetching document {document_id}: {str(e)}")
        return json.dumps({"error": str(e)}, indent=2)

@mcp.tool()
def get_docrouter_document_ocr(document_id: str) -> str:
    """
    Get the raw OCR text for a document from DocRouter.
    
    This tool returns the plain text extracted from the document.
    Use this when you need to see the raw text content of a document.
    Do NOT use run_docrouter_extraction() for this purpose.

    Args:
        document_id: ID of the document to get OCR text for
    """
    ctx = get_context()
    docrouter_client = ctx.request_context.lifespan_context.docrouter_client
    
    try:
        ocr_text = docrouter_client.ocr.get_text(DOCROUTER_ORG_ID, document_id)
        return ocr_text
    except Exception as e:
        ctx.error(f"Error fetching OCR for document {document_id}: {str(e)}")
        return json.dumps({"error": str(e)}, indent=2)

@mcp.tool()
def get_docrouter_document_ocr_page(document_id: str, page_num: int) -> str:
    """
    Get OCR text for a specific page of a document from DocRouter
    
    This tool returns the plain text extracted from the specified page of the document.
    Use this when you need to see the raw text content of a specific page of a document.
    Do NOT use run_docrouter_extraction() for this purpose.

    Args:
        document_id: ID of the document to get OCR text for
        page_num: Page number to get OCR text for
    """
    ctx = get_context()
    docrouter_client = ctx.request_context.lifespan_context.docrouter_client
    
    try:
        ocr_text = docrouter_client.ocr.get_text(DOCROUTER_ORG_ID, document_id, page_num=page_num)
        return ocr_text
    except Exception as e:
        ctx.error(f"Error fetching OCR for document {document_id} page {page_num}: {str(e)}")
        return json.dumps({"error": str(e)}, indent=2)

@mcp.tool()
def get_docrouter_document_ocr_metadata(document_id: str) -> str:
    """
    Get OCR metadata for a document from DocRouter
    
    Args:
        document_id: ID of the document to get OCR metadata for
    """
    ctx = get_context()
    docrouter_client = ctx.request_context.lifespan_context.docrouter_client
    
    try:
        metadata = docrouter_client.ocr.get_metadata(DOCROUTER_ORG_ID, document_id)
        return json.dumps(metadata, indent=2, cls=DateTimeEncoder)
    except Exception as e:
        ctx.error(f"Error fetching OCR metadata for document {document_id}: {str(e)}")
        return json.dumps({"error": str(e)}, indent=2)

@mcp.tool()
def get_docrouter_tags() -> str:
    """Get all tags from DocRouter"""
    ctx = get_context()
    docrouter_client = ctx.request_context.lifespan_context.docrouter_client
    
    try:
        tags = docrouter_client.tags.list(DOCROUTER_ORG_ID)
        return json.dumps({
            "tags": [tag.dict() for tag in tags.tags],
            "total_count": tags.total_count
        }, indent=2, cls=DateTimeEncoder)
    except Exception as e:
        ctx.error(f"Error fetching tags: {str(e)}")
        return json.dumps({"error": str(e)}, indent=2)

@mcp.tool()
def get_docrouter_tag(tag_id: str) -> str:
    """
    Get tag by ID from DocRouter
    
    Args:
        tag_id: ID of the tag to retrieve
    """
    ctx = get_context()
    docrouter_client = ctx.request_context.lifespan_context.docrouter_client
    
    try:
        tag = docrouter_client.tags.get(DOCROUTER_ORG_ID, tag_id)
        return json.dumps(tag.dict(), indent=2, cls=DateTimeEncoder)
    except Exception as e:
        ctx.error(f"Error fetching tag {tag_id}: {str(e)}")
        return json.dumps({"error": str(e)}, indent=2)

@mcp.tool()
def get_docrouter_prompts() -> str:
    """Get all prompts from DocRouter"""
    ctx = get_context()
    docrouter_client = ctx.request_context.lifespan_context.docrouter_client
    
    try:
        prompts = docrouter_client.prompts.list(DOCROUTER_ORG_ID)
        return json.dumps({
            "prompts": [prompt.dict() for prompt in prompts.prompts],
            "total_count": prompts.total_count
        }, indent=2, cls=DateTimeEncoder)
    except Exception as e:
        ctx.error(f"Error fetching prompts: {str(e)}")
        return json.dumps({"error": str(e)}, indent=2)

@mcp.tool()
def get_docrouter_prompt(prompt_id: str) -> str:
    """
    Get prompt by ID from DocRouter
    
    Args:
        prompt_id: ID of the prompt to retrieve
    """
    ctx = get_context()
    docrouter_client = ctx.request_context.lifespan_context.docrouter_client
    
    try:
        prompt = docrouter_client.prompts.get(DOCROUTER_ORG_ID, prompt_id)
        
        # If the prompt has a schema, fetch the schema details
        schema_info = {}
        if prompt.schema_id:
            try:
                schema = docrouter_client.schemas.get(DOCROUTER_ORG_ID, prompt.schema_id)
                schema_info = schema.dict()
            except Exception as schema_err:
                ctx.warning(f"Error fetching schema {prompt.schema_id}: {str(schema_err)}")
        
        # Combine prompt with schema info
        result = prompt.dict()
        result["schema_details"] = schema_info
        
        return json.dumps(result, indent=2, cls=DateTimeEncoder)
    except Exception as e:
        ctx.error(f"Error fetching prompt {prompt_id}: {str(e)}")
        return json.dumps({"error": str(e)}, indent=2)

@mcp.tool()
def get_docrouter_extraction(document_id: str, prompt_id: str) -> str:
    """
    Get extraction results for a document using a specific prompt
    
    Args:
        document_id: ID of the document
        prompt_id: ID of the prompt used for extraction
    """
    ctx = get_context()
    docrouter_client = ctx.request_context.lifespan_context.docrouter_client
    
    try:
        result = docrouter_client.llm.get_result(DOCROUTER_ORG_ID, document_id, prompt_id)
        return json.dumps(result.dict(), indent=2, cls=DateTimeEncoder)
    except Exception as e:
        ctx.error(f"Error fetching extraction for document {document_id} with prompt {prompt_id}: {str(e)}")
        return json.dumps({"error": str(e)}, indent=2)

@mcp.tool()
def search_docrouter_documents(query: str, tag_ids: List[str] = None) -> str:
    """
    Search documents by name or content
    
    Args:
        query: Search query string
        tag_ids: Optional list of tag IDs to filter by
    """
    ctx = get_context()
    docrouter_client = ctx.request_context.lifespan_context.docrouter_client
    
    try:
        documents = docrouter_client.documents.list(DOCROUTER_ORG_ID, query=query, tag_ids=tag_ids)
        result = {
            "documents": [doc.dict() for doc in documents.documents],
            "total_count": documents.total_count
        }
        return json.dumps(result, indent=2, cls=DateTimeEncoder)
    except Exception as e:
        ctx.error(f"Error searching documents with query '{query}': {str(e)}")
        return json.dumps({"error": str(e)}, indent=2)

@mcp.tool()
def search_docrouter_prompts(query: str) -> str:
    """
    Search prompts by name or content
    
    Args:
        query: Search query string
    """
    ctx = get_context()
    docrouter_client = ctx.request_context.lifespan_context.docrouter_client
    
    try:
        prompts = docrouter_client.prompts.list(DOCROUTER_ORG_ID, query=query)
        result = {
            "prompts": [prompt.dict() for prompt in prompts.prompts],
            "total_count": prompts.total_count
        }
        return json.dumps(result, indent=2, cls=DateTimeEncoder)
    except Exception as e:
        ctx.error(f"Error searching prompts with query '{query}': {str(e)}")
        return json.dumps({"error": str(e)}, indent=2)

@mcp.tool()
def search_docrouter_tags(query: str) -> str:
    """
    Search tags by name or description
    
    Args:
        query: Search query string
    """
    ctx = get_context()
    docrouter_client = ctx.request_context.lifespan_context.docrouter_client
    
    try:
        tags = docrouter_client.tags.list(DOCROUTER_ORG_ID, query=query)
        result = {
            "tags": [tag.dict() for tag in tags.tags],
            "total_count": tags.total_count
        }
        return json.dumps(result, indent=2, cls=DateTimeEncoder)
    except Exception as e:
        ctx.error(f"Error searching tags with query '{query}': {str(e)}")
        return json.dumps({"error": str(e)}, indent=2)

@mcp.tool()
def run_docrouter_extraction(document_id: str, prompt_id: str, force: bool = False) -> str:
    """
    Run AI extraction on a document using a specific prompt
    
    This tool triggers a new extraction using the specified prompt on the document.
    Use this when you need to extract structured data from a document.
    
    Args:
        document_id: ID of the document to extract from
        prompt_id: ID of the prompt to use for extraction
        force: Whether to force re-extraction even if results already exist
    """
    ctx = get_context()
    docrouter_client = ctx.request_context.lifespan_context.docrouter_client
    
    try:
        result = docrouter_client.llm.run(DOCROUTER_ORG_ID, document_id, prompt_id, force=force)
        return json.dumps(result.dict(), indent=2, cls=DateTimeEncoder)
    except Exception as e:
        ctx.error(f"Error running extraction for document {document_id} with prompt {prompt_id}: {str(e)}")
        return json.dumps({"error": str(e)}, indent=2)

# ---- DOCROUTER TOOLS (CONVERTED FROM PROMPTS) ----

@mcp.tool()
def docrouter_help() -> str:
    """Get help information about using the DocRouter API"""

    ctx = get_context()
    ctx.request_context.session.send_log_message(
        level="info",
        data="Executing docrouter_help()"
    )

    return """
    # DocRouter API Help
    
    This server provides access to DocRouter resources and tools.
    
    ## Available Tools
    
    ### Document Tools
    - `get_docrouter_documents()` - List all documents
    - `get_docrouter_document(document_id)` - Get document by ID
    - `get_docrouter_document_ocr(document_id)` - Get raw OCR text for a document (use this to see document content)
    - `get_docrouter_document_ocr_page(document_id, page_num)` - Get OCR text for a specific page
    - `get_docrouter_document_ocr_metadata(document_id)` - Get OCR metadata for a document
    - `get_docrouter_extraction(document_id, prompt_id)` - Get extraction results
    
    ### Tag Tools
    - `get_docrouter_tags()` - List all tags
    - `get_docrouter_tag(tag_id)` - Get tag by ID
    
    ### Prompt Tools
    - `get_docrouter_prompts()` - List all prompts
    - `get_docrouter_prompt(prompt_id)` - Get prompt by ID
    
    ### Search and Extraction Tools
    - `search_docrouter_documents(query, tag_ids)` - Search documents by name
    - `search_docrouter_prompts(query)` - Search prompts by name or content
    - `search_docrouter_tags(query)` - Search tags by name or description
    - `run_docrouter_extraction(document_id, prompt_id, force)` - Run AI extraction on a document using a specific prompt
    
    ## Example Workflows
    
    1. Find documents related to invoices:
       ```
       search_docrouter_documents("invoice")
       ```
    
    2. Get OCR text for a document (to see the document content):
       ```
       get_docrouter_document_ocr("doc123")
       ```
    
    3. Run AI extraction on a document (requires a prompt):
       ```
       run_docrouter_extraction("doc123", "prompt456")
       ```
    
    4. View extraction results:
       ```
       get_docrouter_extraction("doc123", "prompt456")
       ```
    """

@mcp.tool()
def docrouter_document_analysis_guide(document_id: str) -> str:
    """
    Generate a guide to analyze a specific document
    
    Args:
        document_id: ID of the document to analyze
    """
    
    return f"""
    # Document Analysis Guide for Document {document_id}
    
    Here's a step-by-step guide to analyze this document:
    
    ## 1. Get Document Details
    First, get the document details:
    ```
    get_docrouter_document("{document_id}")
    ```
    
    ## 2. View Document Content
    Get the OCR text to see the document content:
    ```
    get_docrouter_document_ocr("{document_id}")
    ```
    
    ## 3. Find Available Prompts
    See what prompts are available:
    ```
    get_docrouter_prompts()
    ```
    
    ## 4. Select an Appropriate Prompt
    Based on the document content, select a prompt that would be most appropriate.
    Let's say you choose a prompt with ID "prompt_id".
    
    ## 5. Run Extraction
    Run an extraction with the selected prompt:
    ```
    run_docrouter_extraction("{document_id}", "prompt_id")
    ```
    
    ## 6. View Results
    View the extraction results:
    ```
    get_docrouter_extraction("{document_id}", "prompt_id")
    ```
    
    ## 7. Analyze Results
    Analyze the extracted information to understand the key details in this document.
    """

# Run the server
if __name__ == "__main__":
    mcp.run(transport='stdio')