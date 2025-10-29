# SigAgent Client Examples

This directory contains examples demonstrating how to use the SigAgent Client API.

## Basic Usage Example

The `basic_usage.py` example shows how to:
- Initialize the SigAgent client
- List documents, tags, and LLM models
- Handle errors gracefully

### Running the Example

```bash
# Set your API credentials as environment variables
export SIGAGENT_URL="https://app.sigagent.ai/fastapi"
# export SIGAGENT_URL="http://localhost:8000" # for local development
export SIGAGENT_API_TOKEN="your_actual_token_here"
export SIGAGENT_ORGANIZATION_ID="your_actual_org_id_here"

# Then run the example
./basic_sigagent_client.py
```