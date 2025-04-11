from analytiq_client import AnalytiqClient

# Initialize the client
client = AnalytiqClient(
    base_url="http://localhost:8000",  # Replace with your API URL
    api_token="your_api_token"         # Replace with your API token
)

# Example: List documents
organization_id = "your_organization_id"  # Replace with your organization ID
documents = client.documents.list(organization_id)
print(f"Found {documents.total_count} documents")

# Example: List tags
tags = client.tags.list(organization_id)
print(f"Found {tags.total_count} tags")

# Example: List available LLM models
models = client.llm.list_models()
print(f"Available LLM models: {[model.name for model in models.models]}")
