#! /usr/bin/env python3

import os
from sigagent_sdk import SigAgentClient

SIGAGENT_ORG_ID = os.getenv("SIGAGENT_ORG_ID")
if not SIGAGENT_ORG_ID:
    raise ValueError("SIGAGENT_ORG_ID is not set")

SIGAGENT_URL = os.getenv("SIGAGENT_URL", "http://localhost:8000")
if not SIGAGENT_URL:
    raise ValueError("SIGAGENT_URL is not set")

SIGAGENT_ORG_API_TOKEN = os.getenv("SIGAGENT_ORG_API_TOKEN")
if not SIGAGENT_ORG_API_TOKEN:
    raise ValueError("SIGAGENT_ORG_API_TOKEN is not set")

# Initialize the client
client = SigAgentClient(
    base_url=SIGAGENT_URL,            # Replace with your SigAgent URL
    api_token=SIGAGENT_ORG_API_TOKEN  # Replace with your organization API token
)

# Example: List documents
organization_id = SIGAGENT_ORG_ID  # Replace with your organization ID
documents = client.documents.list(organization_id)
print(f"Found {documents.total_count} documents")

# Example: List tags
tags = client.tags.list(organization_id)
print(f"Found {tags.total_count} tags")
