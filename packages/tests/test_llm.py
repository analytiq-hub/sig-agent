import pytest
import json
import secrets
import base64
import asyncio
from unittest.mock import patch, AsyncMock, Mock
from datetime import datetime, UTC
from bson import ObjectId
from tests.test_utils import client, get_token_headers
import analytiq_data as ad


class MockLLMResponse:
    """Mock LLM response object that mimics litellm response structure"""
    def __init__(self, content="Test response from mocked LLM", finish_reason="stop"):
        self.id = "chatcmpl-test123"
        self.object = "chat.completion"
        self.choices = [MockChoice(content, finish_reason)]
        self.usage = MockUsage()


class MockChoice:
    """Mock choice object"""
    def __init__(self, content, finish_reason="stop"):
        self.message = MockMessage(content)
        self.finish_reason = finish_reason


class MockMessage:
    """Mock message object"""
    def __init__(self, content):
        self.role = "assistant"
        self.content = content


class MockUsage:
    """Mock usage object"""
    def __init__(self):
        self.prompt_tokens = 10
        self.completion_tokens = 20
        self.total_tokens = 30


class MockStreamChunk:
    """Mock streaming chunk that mimics litellm streaming response"""
    def __init__(self, content, finish_reason=None):
        self.choices = [MockStreamChoice(content, finish_reason)]


class MockStreamChoice:
    """Mock streaming choice"""
    def __init__(self, content, finish_reason=None):
        self.delta = MockStreamDelta(content)
        self.finish_reason = finish_reason


class MockStreamDelta:
    """Mock streaming delta"""
    def __init__(self, content):
        self.content = content


async def mock_stream_generator(test_chunks):
    """Generate mock streaming chunks"""
    for chunk in test_chunks:
        yield MockStreamChunk(chunk)
    # Final chunk with empty content to signal completion
    yield MockStreamChunk("", "stop")


class MockTextractResponse:
    """Mock response for Textract run_textract function"""
    def __init__(self, blocks=None):
        self.blocks = blocks or [
            {
                'Id': 'block-1',
                'BlockType': 'LINE',
                'Text': 'Sample extracted text',
                'Page': 1,
                'Confidence': 99.5
            },
            {
                'Id': 'block-2',
                'BlockType': 'WORD',
                'Text': 'Sample',
                'Page': 1,
                'Confidence': 99.8
            }
        ]


async def mock_run_textract(analytiq_client, blob, feature_types=[], query_list=None):
    """Mock implementation of ad.aws.textract.run_textract"""
    return MockTextractResponse().blocks


class MockLiteLLMFileResponse:
    """Mock response for litellm file creation"""
    def __init__(self, file_id="file-test123"):
        self.id = file_id
        self.object = "file"
        self.purpose = "assistants"
        self.filename = "test_file.txt"
        self.bytes = 1024
        self.created_at = 1700000000


async def mock_litellm_acreate_file_with_retry(file, purpose, custom_llm_provider, api_key):
    """Mock implementation of _litellm_acreate_file_with_retry"""
    return MockLiteLLMFileResponse()


async def mock_litellm_acompletion_with_retry(model, messages, api_key, temperature=0.1, response_format=None, aws_access_key_id=None, aws_secret_access_key=None, aws_region_name=None):
    """Mock implementation of _litellm_acompletion_with_retry"""
    return MockLLMResponse("Mocked LLM response from retry function")


@pytest.mark.asyncio
async def test_llm_chat_admin_only_access(org_and_users, setup_test_models, test_db):
    """Test that only admins can access the LLM chat endpoint"""
    org_id = org_and_users["org_id"]
    admin = org_and_users["admin"]
    member = org_and_users["member"]
    outsider = org_and_users["outsider"]

    # Test request payload
    chat_request = {
        "model": "gpt-4o-mini",
        "messages": [
            {"role": "user", "content": "Hello, how are you?"}
        ],
        "temperature": 0.7,
        "stream": False
    }

    # Test admin access (should work)
    with patch('litellm.acompletion', new_callable=AsyncMock) as mock_llm:
        mock_llm.return_value = MockLLMResponse("Hello! I'm doing well, thank you for asking.")
        
        resp = client.post("/v0/account/llm/run", json=chat_request, headers=get_token_headers(admin["account_token"]))
        assert resp.status_code == 200, f"Admin should be able to access LLM chat, got {resp.status_code}: {resp.text}"
        
        response_data = resp.json()
        assert "choices" in response_data
        assert response_data["choices"][0]["message"]["content"] == "Hello! I'm doing well, thank you for asking."

    # Test member access (should be forbidden - admin only endpoint)
    resp = client.post("/v0/account/llm/run", json=chat_request, headers=get_token_headers(member["account_token"]))
    assert resp.status_code == 403, f"Member should NOT be able to access LLM chat, got {resp.status_code}: {resp.text}"

    # Test outsider access (should be forbidden)
    resp = client.post("/v0/account/llm/run", json=chat_request, headers=get_token_headers(outsider["account_token"]))
    assert resp.status_code == 403, f"Outsider should NOT be able to access LLM chat, got {resp.status_code}: {resp.text}"

    # Test unauthenticated access
    resp = client.post("/v0/account/llm/run", json=chat_request)
    assert resp.status_code == 403, f"Unauthenticated request should be rejected, got {resp.status_code}: {resp.text}"


@pytest.mark.asyncio
async def test_llm_chat_non_streaming_response(org_and_users, setup_test_models, test_db):
    """Test non-streaming LLM chat response"""
    admin = org_and_users["admin"]

    chat_request = {
        "model": "gpt-4o-mini",
        "messages": [
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": "What is 2 + 2?"}
        ],
        "temperature": 0.3,
        "max_tokens": 100,
        "stream": False
    }

    with patch('litellm.acompletion', new_callable=AsyncMock) as mock_llm:
        mock_response = MockLLMResponse("2 + 2 equals 4.", "stop")
        mock_llm.return_value = mock_response
        
        resp = client.post("/v0/account/llm/run", json=chat_request, headers=get_token_headers(admin["account_token"]))
        assert resp.status_code == 200
        
        response_data = resp.json()
        
        # Verify response structure
        assert "id" in response_data
        assert response_data["object"] == "chat.completion"
        assert "created" in response_data
        assert response_data["model"] == "gpt-4o-mini"
        
        # Verify choices
        assert len(response_data["choices"]) == 1
        choice = response_data["choices"][0]
        assert choice["index"] == 0
        assert choice["message"]["role"] == "assistant"
        assert choice["message"]["content"] == "2 + 2 equals 4."
        assert choice["finish_reason"] == "stop"
        
        # Verify usage stats
        assert "usage" in response_data
        usage = response_data["usage"]
        assert usage["prompt_tokens"] == 10
        assert usage["completion_tokens"] == 20
        assert usage["total_tokens"] == 30
        
        # Verify the mock was called with correct parameters
        mock_llm.assert_called_once()
        call_args = mock_llm.call_args[1]
        assert call_args["model"] == "gpt-4o-mini"
        assert call_args["temperature"] == 0.3
        assert call_args["max_tokens"] == 100
        assert len(call_args["messages"]) == 2
        assert call_args["messages"][0]["role"] == "system"
        assert call_args["messages"][1]["role"] == "user"


@pytest.mark.asyncio
async def test_llm_chat_streaming_response(org_and_users, setup_test_models, test_db):
    """Test streaming LLM chat response"""
    admin = org_and_users["admin"]

    chat_request = {
        "model": "gpt-4o-mini",
        "messages": [
            {"role": "user", "content": "Count to 3"}
        ],
        "temperature": 0.7,
        "stream": True
    }

    test_chunks = ["1", ", ", "2", ", ", "3"]

    with patch('litellm.acompletion', new_callable=AsyncMock) as mock_llm:
        mock_llm.return_value = mock_stream_generator(test_chunks)
        
        resp = client.post("/v0/account/llm/run", json=chat_request, headers=get_token_headers(admin["account_token"]))
        assert resp.status_code == 200
        
        # Verify streaming response headers
        assert resp.headers["content-type"] == "text/plain; charset=utf-8"
        assert "cache-control" in resp.headers
        assert resp.headers["cache-control"] == "no-cache"
        
        # Parse streaming response
        response_text = resp.text
        lines = response_text.strip().split('\n\n')
        
        # Verify we get the expected chunks
        received_chunks = []
        done_received = False
        
        for line in lines:
            if line.startswith('data: '):
                try:
                    data = json.loads(line[6:])  # Remove 'data: ' prefix
                    if data.get('done'):
                        done_received = True
                    elif 'chunk' in data:
                        received_chunks.append(data['chunk'])
                except json.JSONDecodeError:
                    pass
        
        # Verify we received all expected chunks
        assert received_chunks == test_chunks, f"Expected {test_chunks}, got {received_chunks}"
        assert done_received, "Should receive a 'done' signal"
        
        # Verify the mock was called with streaming enabled
        mock_llm.assert_called_once()
        call_args = mock_llm.call_args[1]
        assert call_args["stream"] is True


@pytest.mark.asyncio
async def test_llm_chat_streaming_error_handling(org_and_users, setup_test_models, test_db):
    """Test error handling in streaming responses"""
    admin = org_and_users["admin"]

    chat_request = {
        "model": "gpt-4o-mini",
        "messages": [
            {"role": "user", "content": "This should cause an error"}
        ],
        "stream": True
    }

    with patch('litellm.acompletion', new_callable=AsyncMock) as mock_llm:
        # Make the mock raise an exception
        mock_llm.side_effect = Exception("Mocked LLM error")
        
        resp = client.post("/v0/account/llm/run", json=chat_request, headers=get_token_headers(admin["account_token"]))
        assert resp.status_code == 200  # Streaming responses return 200 even with errors
        
        # Parse streaming response to check for error
        response_text = resp.text
        lines = response_text.strip().split('\n\n')
        
        error_received = False
        for line in lines:
            if line.startswith('data: '):
                try:
                    data = json.loads(line[6:])
                    if 'error' in data:
                        error_received = True
                        assert "Mocked LLM error" in data['error']
                except json.JSONDecodeError:
                    pass
        
        assert error_received, "Should receive an error in streaming response"


@pytest.mark.asyncio
async def test_llm_chat_invalid_model(org_and_users, setup_test_models, test_db):
    """Test error handling for invalid model"""
    admin = org_and_users["admin"]

    chat_request = {
        "model": "invalid-model-that-does-not-exist",
        "messages": [
            {"role": "user", "content": "Hello"}
        ],
        "stream": False
    }

    resp = client.post("/v0/account/llm/run", json=chat_request, headers=get_token_headers(admin["account_token"]))
    assert resp.status_code == 400
    
    response_data = resp.json()
    assert "Invalid model" in response_data["detail"]


@pytest.mark.asyncio
async def test_llm_chat_missing_messages(org_and_users, setup_test_models, test_db):
    """Test validation for missing required fields"""
    admin = org_and_users["admin"]

    # Missing messages field
    chat_request = {
        "model": "gpt-4o-mini",
        "stream": False
    }

    resp = client.post("/v0/account/llm/run", json=chat_request, headers=get_token_headers(admin["account_token"]))
    assert resp.status_code == 422  # Validation error


@pytest.mark.asyncio
async def test_llm_chat_empty_messages(org_and_users, setup_test_models, test_db):
    """Test validation for empty messages array"""
    admin = org_and_users["admin"]

    chat_request = {
        "model": "gpt-4o-mini",
        "messages": [],
        "stream": False
    }

    resp = client.post("/v0/account/llm/run", json=chat_request, headers=get_token_headers(admin["account_token"]))
    assert resp.status_code == 500  # LLM provider validation error


@pytest.mark.asyncio
async def test_llm_chat_with_all_parameters(org_and_users, setup_test_models, test_db):
    """Test LLM chat with all optional parameters"""
    admin = org_and_users["admin"]

    chat_request = {
        "model": "gpt-4o-mini",
        "messages": [
            {"role": "system", "content": "You are a concise assistant."},
            {"role": "user", "content": "Tell me about Python"}
        ],
        "max_tokens": 50,
        "temperature": 0.2,
        "stream": False
    }

    with patch('litellm.acompletion', new_callable=AsyncMock) as mock_llm:
        mock_llm.return_value = MockLLMResponse("Python is a programming language.")
        
        resp = client.post("/v0/account/llm/run", json=chat_request, headers=get_token_headers(admin["account_token"]))
        assert resp.status_code == 200
        
        # Verify all parameters were passed to litellm
        mock_llm.assert_called_once()
        call_args = mock_llm.call_args[1]
        assert call_args["model"] == "gpt-4o-mini"
        assert call_args["max_tokens"] == 50
        assert call_args["temperature"] == 0.2


@pytest.mark.asyncio
async def test_llm_chat_non_streaming_error_handling(org_and_users, setup_test_models, test_db):
    """Test error handling in non-streaming responses"""
    admin = org_and_users["admin"]

    chat_request = {
        "model": "gpt-4o-mini",
        "messages": [
            {"role": "user", "content": "This should cause an error"}
        ],
        "stream": False
    }

    with patch('litellm.acompletion', new_callable=AsyncMock) as mock_llm:
        mock_llm.side_effect = Exception("Mocked LLM error")
        
        resp = client.post("/v0/account/llm/run", json=chat_request, headers=get_token_headers(admin["account_token"]))
        assert resp.status_code == 500
        
        response_data = resp.json()
        assert "Error processing LLM request" in response_data["detail"]
        assert "Mocked LLM error" in response_data["detail"]


@pytest.mark.asyncio
async def test_llm_chat_conversation_context(org_and_users, setup_test_models, test_db):
    """Test LLM chat with conversation context (multiple messages)"""
    admin = org_and_users["admin"]

    chat_request = {
        "model": "gpt-4o-mini",
        "messages": [
            {"role": "user", "content": "My name is Alice"},
            {"role": "assistant", "content": "Hello Alice! Nice to meet you."},
            {"role": "user", "content": "What's my name?"}
        ],
        "stream": False
    }

    with patch('litellm.acompletion', new_callable=AsyncMock) as mock_llm:
        mock_llm.return_value = MockLLMResponse("Your name is Alice.")
        
        resp = client.post("/v0/account/llm/run", json=chat_request, headers=get_token_headers(admin["account_token"]))
        assert resp.status_code == 200
        
        # Verify all messages were passed to litellm
        mock_llm.assert_called_once()
        call_args = mock_llm.call_args[1]
        assert len(call_args["messages"]) == 3
        assert call_args["messages"][0]["content"] == "My name is Alice"
        assert call_args["messages"][1]["content"] == "Hello Alice! Nice to meet you."
        assert call_args["messages"][2]["content"] == "What's my name?"


# Organization-level LLM Chat Tests
@pytest.mark.asyncio
async def test_llm_chat_org_admin_only_access(org_and_users, setup_test_models, test_db):
    """Test that only admins can access the organization-level LLM chat endpoint"""
    org_id = org_and_users["org_id"]
    admin = org_and_users["admin"]
    member = org_and_users["member"]
    outsider = org_and_users["outsider"]

    # Test request payload
    chat_request = {
        "model": "gpt-4o-mini",
        "messages": [
            {"role": "user", "content": "Hello, organization LLM!"}
        ],
        "temperature": 0.7,
        "stream": False
    }

    # Test admin access (should work)
    with patch('litellm.acompletion', new_callable=AsyncMock) as mock_llm:
        mock_llm.return_value = MockLLMResponse("Hello from organization LLM!")
        
        resp = client.post(f"/v0/orgs/{org_id}/llm/run", json=chat_request, headers=get_token_headers(admin["token"]))
        assert resp.status_code == 200, f"Admin should be able to access org LLM chat, got {resp.status_code}: {resp.text}"
        
        response_data = resp.json()
        assert "choices" in response_data
        assert response_data["choices"][0]["message"]["content"] == "Hello from organization LLM!"

    # Test member access (should be forbidden - admin only endpoint)
    resp = client.post(f"/v0/orgs/{org_id}/llm/run", json=chat_request, headers=get_token_headers(member["token"]))
    assert resp.status_code == 403, f"Member should NOT be able to access org LLM chat, got {resp.status_code}: {resp.text}"

    # Test outsider access (should be forbidden)
    resp = client.post(f"/v0/orgs/{org_id}/llm/run", json=chat_request, headers=get_token_headers(outsider["token"]))
    assert resp.status_code == 403, f"Outsider should NOT be able to access org LLM chat, got {resp.status_code}: {resp.text}"

    # Test unauthenticated access
    resp = client.post(f"/v0/orgs/{org_id}/llm/run", json=chat_request)
    assert resp.status_code == 403, f"Unauthenticated request should be rejected, got {resp.status_code}: {resp.text}"


@pytest.mark.asyncio
async def test_llm_chat_org_streaming_response(org_and_users, setup_test_models, test_db):
    """Test streaming LLM chat response via organization endpoint"""
    org_id = org_and_users["org_id"]
    admin = org_and_users["admin"]

    chat_request = {
        "model": "gpt-4o-mini",
        "messages": [
            {"role": "user", "content": "Count to 5 via org endpoint"}
        ],
        "temperature": 0.7,
        "stream": True
    }

    test_chunks = ["1", ", ", "2", ", ", "3", ", ", "4", ", ", "5"]

    with patch('litellm.acompletion', new_callable=AsyncMock) as mock_llm:
        mock_llm.return_value = mock_stream_generator(test_chunks)
        
        resp = client.post(f"/v0/orgs/{org_id}/llm/run", json=chat_request, headers=get_token_headers(admin["token"]))
        assert resp.status_code == 200
        
        # Verify streaming response headers
        assert resp.headers["content-type"] == "text/plain; charset=utf-8"
        assert resp.headers["cache-control"] == "no-cache"
        
        # Parse streaming response
        response_text = resp.text
        lines = response_text.strip().split('\n\n')
        
        # Verify we get the expected chunks
        received_chunks = []
        done_received = False
        
        for line in lines:
            if line.startswith('data: '):
                try:
                    data = json.loads(line[6:])  # Remove 'data: ' prefix
                    if data.get('done'):
                        done_received = True
                    elif 'chunk' in data:
                        received_chunks.append(data['chunk'])
                except json.JSONDecodeError:
                    pass
        
        # Verify we received all expected chunks
        assert received_chunks == test_chunks, f"Expected {test_chunks}, got {received_chunks}"
        assert done_received, "Should receive a 'done' signal"
        
        # Verify the mock was called with streaming enabled
        mock_llm.assert_called_once()
        call_args = mock_llm.call_args[1]
        assert call_args["stream"] is True


@pytest.mark.asyncio
async def test_llm_chat_org_invalid_model(org_and_users, setup_test_models, test_db):
    """Test error handling for invalid model via organization endpoint"""
    org_id = org_and_users["org_id"]
    admin = org_and_users["admin"]

    chat_request = {
        "model": "invalid-org-model",
        "messages": [
            {"role": "user", "content": "Hello"}
        ],
        "stream": False
    }

    resp = client.post(f"/v0/orgs/{org_id}/llm/run", json=chat_request, headers=get_token_headers(admin["token"]))
    assert resp.status_code == 400
    
    response_data = resp.json()
    assert "Invalid model" in response_data["detail"]


@pytest.mark.asyncio
async def test_llm_chat_org_wrong_organization(org_and_users, setup_test_models, test_db):
    """Test that tokens are scoped to the correct organization"""
    admin = org_and_users["admin"]
    
    # Use a different (invalid) organization ID
    fake_org_id = str(ObjectId())
    
    chat_request = {
        "model": "gpt-4o-mini",
        "messages": [
            {"role": "user", "content": "Hello"}
        ],
        "stream": False
    }

    # Admin token is for a different org, should be forbidden
    resp = client.post(f"/v0/orgs/{fake_org_id}/llm/run", json=chat_request, headers=get_token_headers(admin["token"]))
    assert resp.status_code == 401, f"Should be unauthorized for wrong org, got {resp.status_code}: {resp.text}"


@pytest.mark.asyncio 
async def test_llm_chat_account_vs_org_endpoints(org_and_users, setup_test_models, test_db):
    """Test that both account and organization endpoints work with appropriate tokens"""
    org_id = org_and_users["org_id"]
    admin = org_and_users["admin"]

    chat_request = {
        "model": "gpt-4o-mini", 
        "messages": [
            {"role": "user", "content": "Endpoint comparison test"}
        ],
        "stream": False
    }

    # Test both endpoints separately to verify they work
    with patch('litellm.acompletion', new_callable=AsyncMock) as mock_llm:
        mock_llm.return_value = MockLLMResponse("Account endpoint response")
        
        # Test account endpoint with account token
        resp_account = client.post("/v0/account/llm/run", json=chat_request, 
                                 headers=get_token_headers(admin["account_token"]))
        assert resp_account.status_code == 200
        account_data = resp_account.json()
        
        assert "choices" in account_data
        assert account_data["choices"][0]["message"]["content"] == "Account endpoint response"
        mock_llm.assert_called_once()

    with patch('litellm.acompletion', new_callable=AsyncMock) as mock_llm:
        mock_llm.return_value = MockLLMResponse("Org endpoint response")
        
        # Test org endpoint with org token
        resp_org = client.post(f"/v0/orgs/{org_id}/llm/run", json=chat_request,
                              headers=get_token_headers(admin["token"]))
        assert resp_org.status_code == 200
        org_data = resp_org.json()
        
        assert "choices" in org_data
        assert org_data["choices"][0]["message"]["content"] == "Org endpoint response"
        mock_llm.assert_called_once()


@pytest.mark.asyncio
async def test_full_document_llm_processing_pipeline(org_and_users, setup_test_models, test_db):
    """Test the complete document processing pipeline with schema, tag, prompt, upload, and LLM processing"""
    org_id = org_and_users["org_id"]
    admin = org_and_users["admin"]

    # Step 1: Create a JSON schema
    schema_data = {
        "name": "Invoice Extraction Schema",
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": "invoice_extraction",
                "schema": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "invoice_number": {
                            "type": "string",
                            "description": "The invoice identifier"
                        },
                        "total_amount": {
                            "type": "number",
                            "description": "Total invoice amount"
                        },
                        "vendor": {
                            "type": "object",
                            "properties": {
                                "name": {
                                    "type": "string",
                                    "description": "Vendor name"
                                }
                            },
                            "required": ["name"]
                        }
                    },
                    "required": ["invoice_number", "total_amount"]
                },
                "strict": True
            }
        }
    }

    schema_resp = client.post(f"/v0/orgs/{org_id}/schemas", json=schema_data, headers=get_token_headers(admin["token"]))
    assert schema_resp.status_code == 200, f"Failed to create schema: {schema_resp.text}"
    schema_result = schema_resp.json()
    schema_revid = schema_result["schema_revid"]

    # Step 2: Create a tag
    tag_data = {
        "name": "invoice-tag",
        "color": "#FF5722",
        "description": "Invoice documents"
    }

    tag_resp = client.post(f"/v0/orgs/{org_id}/tags", json=tag_data, headers=get_token_headers(admin["token"]))
    assert tag_resp.status_code == 200, f"Failed to create tag: {tag_resp.text}"
    tag_result = tag_resp.json()
    tag_id = tag_result["id"]

    # Step 3: Create a prompt that uses the tag and schema
    prompt_data = {
        "name": "Invoice Processing Prompt",
        "content": "Extract invoice information from this document. Focus on invoice number, total amount, and vendor details.",
        "model": "gpt-4o-mini",
        "tag_ids": [tag_id],
        "schema_revid": schema_revid
    }

    prompt_resp = client.post(f"/v0/orgs/{org_id}/prompts", json=prompt_data, headers=get_token_headers(admin["token"]))
    assert prompt_resp.status_code == 200, f"Failed to create prompt: {prompt_resp.text}"
    prompt_result = prompt_resp.json()
    prompt_revid = prompt_result["prompt_revid"]

    # Step 4: Create a test PDF document
    pdf_content = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n"
    test_pdf = {
        "name": "test_invoice.pdf",
        "content": f"data:application/pdf;base64,{base64.b64encode(pdf_content).decode()}"
    }

    # Step 5: Upload document with the tag
    upload_data = {
        "documents": [{
            "name": test_pdf["name"],
            "content": test_pdf["content"],
            "metadata": {"test_source": "llm_pipeline_test"},
            "tag_ids": [tag_id]
        }]
    }

    upload_resp = client.post(f"/v0/orgs/{org_id}/documents", json=upload_data, headers=get_token_headers(admin["token"]))
    assert upload_resp.status_code == 200, f"Failed to upload document: {upload_resp.text}"
    upload_result = upload_resp.json()
    document_id = upload_result["documents"][0]["document_id"]

    # Mock the LLM and Textract calls for the background processing
    with patch('analytiq_data.aws.textract.run_textract', new_callable=AsyncMock) as mock_textract, \
         patch('analytiq_data.llm.llm._litellm_acompletion_with_retry', new_callable=AsyncMock) as mock_llm_completion:

        # Configure mocks
        mock_textract.return_value = [
            {
                'Id': 'block-1',
                'BlockType': 'LINE',
                'Text': 'INVOICE #12345',
                'Page': 1,
                'Confidence': 99.5
            },
            {
                'Id': 'block-2',
                'BlockType': 'LINE',
                'Text': 'Total: $1,234.56',
                'Page': 1,
                'Confidence': 98.2
            },
            {
                'Id': 'block-3',
                'BlockType': 'LINE',
                'Text': 'Vendor: Acme Corp',
                'Page': 1,
                'Confidence': 97.8
            }
        ]

        # Mock LLM response with structured JSON
        mock_llm_response = MockLLMResponse()
        mock_llm_response.choices[0].message.content = json.dumps({
            "invoice_number": "12345",
            "total_amount": 1234.56,
            "vendor": {
                "name": "Acme Corp"
            }
        })
        mock_llm_completion.return_value = mock_llm_response

        # Step 6: Trigger LLM processing on the document
        llm_run_resp = client.post(
            f"/v0/orgs/{org_id}/llm/run/{document_id}",
            params={"prompt_id": prompt_revid, "force": True},
            headers=get_token_headers(admin["token"])
        )
        assert llm_run_resp.status_code == 200, f"Failed to trigger LLM processing: {llm_run_resp.text}"

        # Step 7: Wait and check for LLM processing completion
        max_retries = 10
        retry_count = 0
        llm_result = None

        while retry_count < max_retries:
            try:
                result_resp = client.get(
                    f"/v0/orgs/{org_id}/llm/result/{document_id}",
                    params={"prompt_id": prompt_revid},
                    headers=get_token_headers(admin["token"])
                )

                if result_resp.status_code == 200:
                    llm_result = result_resp.json()
                    break
                elif result_resp.status_code == 404:
                    # LLM processing not complete yet, wait and retry
                    await asyncio.sleep(1)
                    retry_count += 1
                else:
                    pytest.fail(f"Unexpected response getting LLM result: {result_resp.status_code}: {result_resp.text}")

            except Exception as e:
                await asyncio.sleep(1)
                retry_count += 1
                if retry_count >= max_retries:
                    pytest.fail(f"Failed to get LLM result after {max_retries} retries: {e}")

        # Step 8: Verify the LLM processing results
        assert llm_result is not None, "LLM processing did not complete within expected time"
        assert "llm_result" in llm_result, f"Missing llm_result in response: {llm_result}"

        # Verify the extracted structured data
        extracted_data = llm_result["llm_result"]
        if isinstance(extracted_data, str):
            extracted_data = json.loads(extracted_data)

        assert "invoice_number" in extracted_data, f"Missing invoice_number in extracted data: {extracted_data}"
        assert "total_amount" in extracted_data, f"Missing total_amount in extracted data: {extracted_data}"
        assert "vendor" in extracted_data, f"Missing vendor in extracted data: {extracted_data}"
        assert extracted_data["invoice_number"] == "12345"
        assert extracted_data["total_amount"] == 1234.56
        assert extracted_data["vendor"]["name"] == "Acme Corp"

        # Step 9: Verify document status shows LLM processing completed
        doc_resp = client.get(f"/v0/orgs/{org_id}/documents/{document_id}", headers=get_token_headers(admin["token"]))
        assert doc_resp.status_code == 200
        doc_data = doc_resp.json()
        assert tag_id in doc_data["tag_ids"], "Document should still have the invoice tag"
        assert doc_data["metadata"]["test_source"] == "llm_pipeline_test"

        # Verify mocks were called
        mock_textract.assert_called_once()
        mock_llm_completion.assert_called_once()