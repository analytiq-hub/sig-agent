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

from docrouter_sdk import DocRouterClient

logging.basicConfig(level=logging.WARNING)  # Only show WARNING and above (ERROR, CRITICAL)

DOCROUTER_URL = os.getenv("DOCROUTER_URL")
DOCROUTER_ORG_ID = os.getenv("DOCROUTER_ORG_ID")
DOCROUTER_ORG_API_TOKEN = os.getenv("DOCROUTER_ORG_API_TOKEN")

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

# ---- DATA RESOURCES ----

# @mcp.resource("data://users")
# def get_users() -> str:
#     """Get all users"""
#     ctx = get_context()
#     users = ctx.request_context.lifespan_context.db.query_users()
#     return json.dumps(users, indent=2)

# @mcp.resource("data://users/{user_id}")
# def get_user(user_id: int) -> str:
#     """Get user by ID"""
#     ctx = get_context()
#     user = ctx.request_context.lifespan_context.db.get_user(user_id)
#     if not user:
#         return f"User with ID {user_id} not found"
#     return json.dumps(user, indent=2)

# @mcp.resource("data://products")
# def get_products() -> str:
#     """Get all products"""
#     ctx = get_context()
#     products = ctx.request_context.lifespan_context.db.query_products()
#     return json.dumps(products, indent=2)

# @mcp.resource("data://products/{product_id}")
# def get_product(product_id: int) -> str:
#     """Get product by ID"""
#     ctx = get_context()
#     product = ctx.request_context.lifespan_context.db.get_product(product_id)
#     if not product:
#         return f"Product with ID {product_id} not found"
#     return json.dumps(product, indent=2)

# ---- TOOLS ----

# @mcp.tool()
# def search_users(name: str) -> str:
#     """Search users by name"""
#     ctx = get_context()
#     users = ctx.request_context.lifespan_context.db.query_users()
#     results = [user for user in users if name.lower() in user["name"].lower()]
    
#     ctx.info(f"Found {len(results)} users matching '{name}'")
    
#     if not results:
#         return f"No users found matching '{name}'"
#     return json.dumps(results, indent=2)

# @mcp.tool()
# def calculate_total_price(product_ids: List[int]) -> str:
#     """Calculate total price for given products"""
#     ctx = get_context()
#     db = ctx.request_context.lifespan_context.db
#     total = 0.0
#     products_found = []
    
#     for pid in product_ids:
#         product = db.get_product(pid)
#         if product:
#             total += product["price"]
#             products_found.append(product["name"])
    
#     ctx.info(f"Calculated price for {len(products_found)} products")
    
#     if not products_found:
#         return "No valid products found"
    
#     return f"Total price for {', '.join(products_found)}: ${total:.2f}"

@mcp.tool()
def get_current_time() -> str:
    """Get the current server time"""
    return f"Current time: {datetime.now().isoformat()}"

@mcp.tool()
def get_env(key: str) -> str:
    """Get the environment variable for the given key"""
    return os.environ[key]

# ---- PROMPTS ----

# @mcp.prompt()
# def help_prompt() -> str:
#     """Help information about using this API"""
#     return """
#     Welcome to the Data API Server!
    
#     This server provides access to user and product data along with helpful tools.
    
#     Available resources:
#     - data://users - List all users
#     - data://users/{user_id} - Get user by ID
#     - data://products - List all products
#     - data://products/{product_id} - Get product by ID
    
#     Available tools:
#     - search_users - Search users by name
#     - calculate_total_price - Calculate total price for given products
#     - get_current_time - Get the current server time
    
#     Try accessing these resources or using these tools!
#     """

# @mcp.prompt()
# def product_info_prompt(product_id: int) -> str:
#     """Generate a prompt to ask about a specific product"""
#     return f"""
#     Please provide information about the product with ID {product_id}.
#     You can use the data://products/{product_id} resource to fetch this information.
    
#     Suggested questions:
#     1. What is the name of this product?
#     2. How much does this product cost?
#     3. Are there any similar products available?
#     """

# @mcp.prompt()
# def user_search_prompt(search_term: str) -> str:
#     """Generate a prompt to search for users"""
#     return f"""
#     Please help me find users matching the term "{search_term}".
#     You can use the search_users tool to find matching users.
    
#     After finding the users, I might want to get more details about them using
#     the data://users/{{user_id}} resource.
#     """

# ---- DOCROUTER RESOURCES ----

@mcp.resource("data://docrouter/documents", mime_type="application/json")
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

@mcp.resource("data://docrouter/documents/{document_id}")
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

@mcp.resource("data://docrouter/documents/{document_id}/ocr")
def get_docrouter_document_ocr(document_id: str) -> str:
    """Get OCR text for a document from DocRouter"""
    ctx = get_context()
    docrouter_client = ctx.request_context.lifespan_context.docrouter_client
    
    try:
        ocr_text = docrouter_client.ocr.get_text(DOCROUTER_ORG_ID, document_id)
        return ocr_text
    except Exception as e:
        ctx.error(f"Error fetching OCR for document {document_id}: {str(e)}")
        return json.dumps({"error": str(e)}, indent=2)

@mcp.resource("data://docrouter/documents/{document_id}/ocr/page/{page_num}")
def get_docrouter_document_ocr_page(document_id: str, page_num: int) -> str:
    """Get OCR text for a specific page of a document from DocRouter"""
    ctx = get_context()
    docrouter_client = ctx.request_context.lifespan_context.docrouter_client
    
    try:
        ocr_text = docrouter_client.ocr.get_text(DOCROUTER_ORG_ID, document_id, page_num=page_num)
        return ocr_text
    except Exception as e:
        ctx.error(f"Error fetching OCR for document {document_id} page {page_num}: {str(e)}")
        return json.dumps({"error": str(e)}, indent=2)

@mcp.resource("data://docrouter/documents/{document_id}/ocr/metadata", mime_type="application/json")
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

@mcp.resource("data://docrouter/tags", mime_type="application/json")
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

@mcp.resource("data://docrouter/tags/{tag_id}", mime_type="application/json")
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

@mcp.resource("data://docrouter/prompts", mime_type="application/json")
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

@mcp.resource("data://docrouter/prompts/{prompt_id}", mime_type="application/json")
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

@mcp.resource("data://docrouter/documents/{document_id}/extractions/{prompt_id}", mime_type="application/json")
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

# ---- DOCROUTER TOOLS ----

@mcp.tool()
def search_docrouter_documents(query: str, tag_ids: str = None) -> str:
    """
    Search documents in DocRouter
    
    Args:
        query: Search term to look for in document names
        tag_ids: Comma-separated list of tag IDs to filter by
    """
    ctx = get_context()
    docrouter_client = ctx.request_context.lifespan_context.docrouter_client
    
    try:
        # Convert tag_ids string to list if provided
        tag_id_list = tag_ids.split(",") if tag_ids else None
        
        # Get all documents
        documents = docrouter_client.documents.list(DOCROUTER_ORG_ID, tag_ids=tag_id_list)
        
        # Filter by query term
        results = [doc for doc in documents.documents if query.lower() in doc.document_name.lower()]
        
        ctx.info(f"Found {len(results)} documents matching '{query}'")
        
        if not results:
            return f"No documents found matching '{query}'"
        
        # Convert to dictionaries and use custom encoder for datetime objects
        return json.dumps({
            "documents": [doc.dict() for doc in results],
            "count": len(results)
        }, indent=2, cls=DateTimeEncoder)
    except Exception as e:
        ctx.error(f"Error searching documents: {str(e)}")
        return json.dumps({"error": str(e)}, indent=2)

@mcp.tool()
def search_docrouter_prompts(query: str) -> str:
    """
    Search prompts in DocRouter
    
    Args:
        query: Search term to look for in prompt names or content
    """
    ctx = get_context()
    docrouter_client = ctx.request_context.lifespan_context.docrouter_client
    
    try:
        # Get all prompts
        prompts = docrouter_client.prompts.list(DOCROUTER_ORG_ID)
        
        # Filter by query term
        results = [
            prompt for prompt in prompts.prompts 
            if query.lower() in prompt.name.lower() or query.lower() in prompt.content.lower()
        ]
        
        ctx.info(f"Found {len(results)} prompts matching '{query}'")
        
        if not results:
            return f"No prompts found matching '{query}'"
        
        return json.dumps({
            "prompts": [prompt.dict() for prompt in results],
            "count": len(results)
        }, indent=2, cls=DateTimeEncoder)
    except Exception as e:
        ctx.error(f"Error searching prompts: {str(e)}")
        return json.dumps({"error": str(e)}, indent=2)

@mcp.tool()
def search_docrouter_tags(query: str) -> str:
    """
    Search tags in DocRouter
    
    Args:
        query: Search term to look for in tag names or descriptions
    """
    ctx = get_context()
    docrouter_client = ctx.request_context.lifespan_context.docrouter_client
    
    try:
        # Get all tags
        tags = docrouter_client.tags.list(DOCROUTER_ORG_ID)
        
        # Filter by query term
        results = [
            tag for tag in tags.tags 
            if (query.lower() in tag.name.lower() or 
                (tag.description and query.lower() in tag.description.lower()))
        ]
        
        ctx.info(f"Found {len(results)} tags matching '{query}'")
        
        if not results:
            return f"No tags found matching '{query}'"
        
        return json.dumps({
            "tags": [tag.dict() for tag in results],
            "count": len(results)
        }, indent=2, cls=DateTimeEncoder)
    except Exception as e:
        ctx.error(f"Error searching tags: {str(e)}")
        return json.dumps({"error": str(e)}, indent=2)

@mcp.tool()
def run_docrouter_extraction(document_id: str, prompt_id: str, force: bool = False) -> str:
    """
    Run extraction on a document using a specific prompt
    
    Args:
        document_id: ID of the document to analyze
        prompt_id: ID of the prompt to use
        force: Whether to force a new extraction even if results exist
    """
    ctx = get_context()
    docrouter_client = ctx.request_context.lifespan_context.docrouter_client
    
    try:
        result = docrouter_client.llm.run(DOCROUTER_ORG_ID, document_id, prompt_id, force)
        return json.dumps(result.dict(), indent=2, cls=DateTimeEncoder)
    except Exception as e:
        ctx.error(f"Error running extraction: {str(e)}")
        return json.dumps({"error": str(e)}, indent=2)

# ---- DOCROUTER PROMPTS ----

@mcp.prompt()
def docrouter_help_prompt() -> str:
    """Help information about using the DocRouter API"""

    ctx = get_context()
    ctx.request_context.session.send_log_message(
        level="info",
        data="Executing docrouter_help_prompt()"
    )

    return """
    # DocRouter API Help
    
    This server provides access to DocRouter resources and tools.
    
    ## Available Resources
    
    ### Documents
    - `data://docrouter/documents` - List all documents
    - `data://docrouter/documents/{document_id}` - Get document by ID
    - `data://docrouter/documents/{document_id}/ocr` - Get OCR text for a document
    - `data://docrouter/documents/{document_id}/ocr/page/{page_num}` - Get OCR text for a specific page
    - `data://docrouter/documents/{document_id}/ocr/metadata` - Get OCR metadata for a document
    - `data://docrouter/documents/{document_id}/extractions/{prompt_id}` - Get extraction results
    
    ### Tags
    - `data://docrouter/tags` - List all tags
    - `data://docrouter/tags/{tag_id}` - Get tag by ID
    
    ### Prompts
    - `data://docrouter/prompts` - List all prompts
    - `data://docrouter/prompts/{prompt_id}` - Get prompt by ID
    
    ## Available Tools
    
    - `search_docrouter_documents` - Search documents by name
    - `search_docrouter_prompts` - Search prompts by name or content
    - `search_docrouter_tags` - Search tags by name or description
    - `run_docrouter_extraction` - Run extraction on a document using a specific prompt
    
    ## Example Workflows
    
    1. Find documents related to invoices:
       ```
       search_docrouter_documents("invoice")
       ```
    
    2. Get OCR text for a document:
       ```
       data://docrouter/documents/doc123/ocr
       ```
    
    3. Run extraction on a document:
       ```
       run_docrouter_extraction("doc123", "prompt456")
       ```
    
    4. View extraction results:
       ```
       data://docrouter/documents/doc123/extractions/prompt456
       ```
    """

@mcp.prompt()
def docrouter_document_analysis_prompt(document_id: str) -> str:
    """Generate a prompt to analyze a specific document"""
    
    return f"""
    # Document Analysis
    
    I'd like to analyze the document with ID `{document_id}`.
    
    First, let's get the document details:
    ```
    data://docrouter/documents/{document_id}
    ```
    
    Then, let's get the OCR text:
    ```
    data://docrouter/documents/{document_id}/ocr
    ```
    
    Now, let's see what prompts are available:
    ```
    data://docrouter/prompts
    ```
    
    Based on the document content, please suggest which prompt would be most appropriate for analyzing this document.
    
    After selecting a prompt (let's call its ID `prompt_id`), we can run an extraction:
    ```
    run_docrouter_extraction("{document_id}", "prompt_id")
    ```
    
    And then view the results:
    ```
    data://docrouter/documents/{document_id}/extractions/prompt_id
    ```
    
    Please help me understand the key information in this document.
    """

# Run the server
if __name__ == "__main__":
    mcp.run(transport='stdio')