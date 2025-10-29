# SigAgent Python SDK Installation and Usage Guide

## Overview

The SigAgent Python SDK provides a Python client library for interacting with the SigAgent API. It enables developers to integrate document processing, OCR, LLM operations, and organization management into their Python applications.

## Installation

### Prerequisites

- **Python 3.8+**
- **pip** package manager
- **SigAgent API access** with organization credentials

### Install from PyPI

```bash
pip install sigagent-sdk
```

### Local Development Installation

```bash
cd packages/python/sdk
pip install -e .
```

## Basic Usage

### Initialize the Client

```python
from sigagent_sdk import SigAgentClient

# Initialize the client
client = SigAgentClient(
    base_url="https://app.sigagent.ai/fastapi",  # SigAgent API URL
    api_token="your_organization_api_token"       # Your organization API token
)

# Your organization ID (found in the URL: https://app.sigagent.ai/orgs/<org_id>)
organization_id = "your_organization_id"
```

### Environment Variables

```bash
export SIGAGENT_URL="https://app.sigagent.ai/fastapi"
export SIGAGENT_ORG_ID="your_organization_id"
export SIGAGENT_ORG_API_TOKEN="your_organization_api_token"
```

```python
import os
from sigagent_sdk import SigAgentClient

client = SigAgentClient(
    base_url=os.getenv("SIGAGENT_URL"),
    api_token=os.getenv("SIGAGENT_ORG_API_TOKEN")
)

organization_id = os.getenv("SIGAGENT_ORG_ID")
```

## Example: Upload Document with Tag

```python
import base64
from sigagent_sdk import SigAgentClient

# Initialize the client
client = SigAgentClient(
    base_url="https://app.sigagent.ai/fastapi",
    api_token="your_organization_api_token"
)

organization_id = "your_organization_id"

# First, create a tag
tag_config = {
    "name": "Invoices",
    "color": "#FF5733",
    "description": "All invoice documents"
}

tag = client.tags.create(organization_id, tag_config)
print(f"Created tag: {tag.tag_id}")

# Upload a document with the tag
with open("invoice.pdf", "rb") as f:
    content = base64.b64encode(f.read()).decode("utf-8")

result = client.documents.upload(organization_id, [{
    "name": "invoice.pdf",
    "content": content,
    "tag_ids": [tag.tag_id]
}])

print(f"Uploaded document ID: {result['documents'][0]['document_id']}")
```

## Additional Examples

For more comprehensive examples and usage patterns, see the unit tests and examples in the GitHub repository:

- **GitHub Repository**: [https://github.com/analytiq/sig-agent](https://github.com/analytiq/sig-agent)
- **Unit Tests**: `packages/python/sdk/tests/`
- **Examples**: `packages/python/sdk/examples/`

## Package Information

- **Package Name**: `sigagent-sdk`
- **Current Version**: 0.1.5
- **Python Requirement**: >=3.8
- **License**: Apache-2.0
- **Dependencies**: requests>=2.31.0, pydantic>=2.0.0
