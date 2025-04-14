"""
FastMCP Server with APIs for data, prompts, and tools
"""

from mcp.server.fastmcp import FastMCP, Context
from typing import Dict, List, Any
import json
from contextlib import asynccontextmanager
from datetime import datetime

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
    def __init__(self, db: Database):
        self.db = db

# Create lifespan context manager for database connection
@asynccontextmanager
async def app_lifespan(server: FastMCP):
    # Initialize resources on startup
    db = await Database().connect()
    
    try:
        yield AppContext(db=db)
    finally:
        # Cleanup on shutdown
        await db.disconnect()

# Create the FastMCP server with lifespan
mcp = FastMCP(
    "Data API Server", 
    instructions="A server providing APIs for data, prompts, and tools",
    lifespan=app_lifespan
)

# ---- DATA RESOURCES ----

@mcp.resource("data://users")
def get_users(ctx: Context) -> str:
    """Get all users"""
    users = ctx.request_context.lifespan_context.db.query_users()
    return json.dumps(users, indent=2)

@mcp.resource("data://users/{user_id}")
def get_user(user_id: int, ctx: Context) -> str:
    """Get user by ID"""
    user = ctx.request_context.lifespan_context.db.get_user(user_id)
    if not user:
        return f"User with ID {user_id} not found"
    return json.dumps(user, indent=2)

@mcp.resource("data://products")
def get_products(ctx: Context) -> str:
    """Get all products"""
    products = ctx.request_context.lifespan_context.db.query_products()
    return json.dumps(products, indent=2)

@mcp.resource("data://products/{product_id}")
def get_product(product_id: int, ctx: Context) -> str:
    """Get product by ID"""
    product = ctx.request_context.lifespan_context.db.get_product(product_id)
    if not product:
        return f"Product with ID {product_id} not found"
    return json.dumps(product, indent=2)

# ---- TOOLS ----

@mcp.tool()
def search_users(name: str, ctx: Context) -> str:
    """Search users by name"""
    users = ctx.request_context.lifespan_context.db.query_users()
    results = [user for user in users if name.lower() in user["name"].lower()]
    
    ctx.info(f"Found {len(results)} users matching '{name}'")
    
    if not results:
        return f"No users found matching '{name}'"
    return json.dumps(results, indent=2)

@mcp.tool()
def calculate_total_price(product_ids: List[int], ctx: Context) -> str:
    """Calculate total price for given products"""
    db = ctx.request_context.lifespan_context.db
    total = 0.0
    products_found = []
    
    for pid in product_ids:
        product = db.get_product(pid)
        if product:
            total += product["price"]
            products_found.append(product["name"])
    
    ctx.info(f"Calculated price for {len(products_found)} products")
    
    if not products_found:
        return "No valid products found"
    
    return f"Total price for {', '.join(products_found)}: ${total:.2f}"

@mcp.tool()
def get_current_time() -> str:
    """Get the current server time"""
    return f"Current time: {datetime.now().isoformat()}"

# ---- PROMPTS ----

@mcp.prompt()
def help_prompt() -> str:
    """Help information about using this API"""
    return """
    Welcome to the Data API Server!
    
    This server provides access to user and product data along with helpful tools.
    
    Available resources:
    - data://users - List all users
    - data://users/{user_id} - Get user by ID
    - data://products - List all products
    - data://products/{product_id} - Get product by ID
    
    Available tools:
    - search_users - Search users by name
    - calculate_total_price - Calculate total price for given products
    - get_current_time - Get the current server time
    
    Try accessing these resources or using these tools!
    """

@mcp.prompt()
def product_info_prompt(product_id: int) -> str:
    """Generate a prompt to ask about a specific product"""
    return f"""
    Please provide information about the product with ID {product_id}.
    You can use the data://products/{product_id} resource to fetch this information.
    
    Suggested questions:
    1. What is the name of this product?
    2. How much does this product cost?
    3. Are there any similar products available?
    """

@mcp.prompt()
def user_search_prompt(search_term: str) -> str:
    """Generate a prompt to search for users"""
    return f"""
    Please help me find users matching the term "{search_term}".
    You can use the search_users tool to find matching users.
    
    After finding the users, I might want to get more details about them using
    the data://users/{{user_id}} resource.
    """

# Run the server
if __name__ == "__main__":
    mcp.run()