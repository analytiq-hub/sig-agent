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
import logging

logger = logging.getLogger(__name__)

class MockLLMResponse:
    """Mock LLM response object that mimics litellm response structure"""
    def __init__(self, content="Test response from mocked LLM", finish_reason="stop"):
        self.id = "chatcmpl-test123"
        self.object = "chat.completion"
        self.model = "gpt-4o-mini"  # Add model attribute that LiteLLM expects
        self.created = 1700000000
        self.choices = [MockChoice(content, finish_reason)]
        self.usage = MockUsage()
        self.system_fingerprint = None

    def __getitem__(self, key):
        """Allow dict-like access for LiteLLM compatibility"""
        return getattr(self, key, None)

    def get(self, key, default=None):
        """Allow dict-like access for LiteLLM compatibility"""
        return getattr(self, key, default)


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
    """Mock implementation of ad.aws.textract.run_textract that matches the real function signature"""
    # Return the blocks directly (not wrapped in MockTextractResponse)
    return [
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

    # Mock ALL LiteLLM functions to prevent any real service calls
    with patch('analytiq_data.aws.textract.run_textract', new=mock_run_textract) as mock_textract, \
         patch('analytiq_data.llm.llm._litellm_acompletion_with_retry', new_callable=AsyncMock) as mock_llm_completion, \
         patch('analytiq_data.llm.llm._litellm_acreate_file_with_retry', new=mock_litellm_acreate_file_with_retry) as mock_file_upload, \
         patch('litellm.completion_cost', return_value=0.001) as mock_completion_cost, \
         patch('litellm.supports_response_schema', return_value=True) as mock_supports_schema, \
         patch('litellm.utils.supports_pdf_input', return_value=True) as mock_supports_pdf:

        upload_resp = client.post(f"/v0/orgs/{org_id}/documents", json=upload_data, headers=get_token_headers(admin["token"]))
        assert upload_resp.status_code == 200, f"Failed to upload document: {upload_resp.text}"
        upload_result = upload_resp.json()
        document_id = upload_result["documents"][0]["document_id"]

        # Step 5.5: Create payment customer for the organization (required for LLM processing)
        from docrouter_app.payments import sync_payments_customer
        await sync_payments_customer(test_db, org_id)

        # Step 5.6: Manually process the OCR message since we don't have a real worker running
        analytiq_client = ad.common.get_analytiq_client()

        # Simulate worker processing the OCR message
        ocr_msg = {
            "_id": str(ObjectId()),  # Use a valid ObjectId
            "msg": {"document_id": document_id}
        }

        # Process the OCR message (this will call our mocked run_textract)
        await ad.msg_handlers.ocr.process_ocr_msg(analytiq_client, ocr_msg, force=True)

        # Configure LLM mock response with structured JSON
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

        logger.info(f"Document data: {doc_data}")

        # Check if document has tag_ids field and contains our tag
        if "tag_ids" in doc_data:
            assert tag_id in doc_data["tag_ids"], "Document should still have the invoice tag"

        # Verify metadata if present
        if "metadata" in doc_data and doc_data["metadata"]:
            assert doc_data["metadata"]["test_source"] == "llm_pipeline_test"

        # Verify OCR was processed (mock textract should have been called during OCR processing)
        # Note: We can't use assert_called_once() on the mock since we used new= instead of new_callable=