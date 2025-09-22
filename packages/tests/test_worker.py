import pytest
import os
import json
import secrets
import base64
import asyncio
import threading
import time
from unittest.mock import patch, AsyncMock, Mock
from datetime import datetime, UTC
from bson import ObjectId
from tests.test_utils import client, get_token_headers
from worker.worker import main as worker_main
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


class WorkerAppliance:
    """Test appliance for spawning worker processes with mocked functions"""

    def __init__(self, n_workers=1, supports_response_schema=True, supports_pdf_input=True):
        self.n_workers = n_workers
        self.supports_response_schema = supports_response_schema
        self.supports_pdf_input = supports_pdf_input
        self.worker_thread = None
        self.stop_event = threading.Event()
        self.patches = []

    def start(self):
        """Start the worker appliance with all necessary patches"""
        # Apply all patches before starting the worker thread
        self.patches = [
            patch('analytiq_data.aws.textract.run_textract', new=mock_run_textract),
            patch('analytiq_data.llm.llm._litellm_acompletion_with_retry', new_callable=AsyncMock),
            patch('analytiq_data.llm.llm._litellm_acreate_file_with_retry', new=mock_litellm_acreate_file_with_retry),
            patch('litellm.completion_cost', return_value=0.001),
            patch('litellm.supports_response_schema', return_value=self.supports_response_schema),
            patch('litellm.utils.supports_pdf_input', return_value=self.supports_pdf_input)
        ]

        # Start all patches
        for p in self.patches:
            p.start()

        # Configure the LLM completion mock
        if len(self.patches) >= 2:
            mock_llm_completion = self.patches[1].start()
            mock_llm_response = MockLLMResponse()
            mock_llm_response.choices[0].message.content = json.dumps({
                "invoice_number": "12345",
                "total_amount": 1234.56,
                "vendor": {
                    "name": "Acme Corp"
                }
            })
            mock_llm_completion.return_value = mock_llm_response

        # Set environment variable for worker count
        self.original_n_workers = os.environ.get('N_WORKERS')
        self.original_env = os.environ.get('ENV')
        os.environ['N_WORKERS'] = str(self.n_workers)

        logger.info(f"WorkerAppliance ENV: {os.environ['ENV']}")

        # Import and start the worker in a separate thread
        def run_worker():
            logger.info(f"WorkerAppliance ENV: {os.environ['ENV']}")

            # Create new event loop for the thread
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

            try:
                # Run until stop event is set
                async def run_until_stop():
                    main_task = asyncio.create_task(worker_main())
                    while not self.stop_event.is_set():
                        await asyncio.sleep(0.1)
                    main_task.cancel()
                    try:
                        await main_task
                    except asyncio.CancelledError:
                        pass

                loop.run_until_complete(run_until_stop())
            finally:
                loop.close()

        self.worker_thread = threading.Thread(target=run_worker, daemon=True)
        self.worker_thread.start()

        # Give workers time to start
        time.sleep(1)

    def stop(self):
        """Stop the worker appliance and clean up patches"""
        if self.worker_thread:
            self.stop_event.set()
            self.worker_thread.join(timeout=5)

        # Stop all patches
        for p in self.patches:
            try:
                p.stop()
            except:
                pass
        self.patches.clear()

        # Restore original environment variables
        if self.original_n_workers is not None:
            os.environ['N_WORKERS'] = self.original_n_workers
        elif 'N_WORKERS' in os.environ:
            del os.environ['N_WORKERS']

        if self.original_env is not None:
            os.environ['ENV'] = self.original_env
        elif 'ENV' in os.environ:
            del os.environ['ENV']

    def __enter__(self):
        self.start()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.stop()


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

@pytest.mark.asyncio
async def test_document_textract_pipeline(test_db, mock_auth, setup_test_models):
    """Test the document Textract pipeline using WorkerAppliance"""
    from tests.test_utils import TEST_ORG_ID, get_auth_headers

    # Create a test PDF document
    pdf_content = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n"
    test_pdf = {
        "name": "test_invoice.pdf",
        "content": f"data:application/pdf;base64,{base64.b64encode(pdf_content).decode()}"
    }

    # Upload document without tags, schema, or prompts
    upload_data = {
        "documents": [{
            "name": test_pdf["name"],
            "content": test_pdf["content"],
            "metadata": {"test_source": "textract_pipeline_test"},
            "tag_ids": []  # No tags
        }]
    }

    # Start the worker appliance with mocked functions
    with WorkerAppliance(n_workers=1) as worker_appliance:
        # Upload the document
        upload_resp = client.post(f"/v0/orgs/{TEST_ORG_ID}/documents", json=upload_data, headers=get_auth_headers())
        assert upload_resp.status_code == 200, f"Failed to upload document: {upload_resp.text}"
        upload_result = upload_resp.json()
        document_id = upload_result["documents"][0]["document_id"]

        # Wait for OCR processing to complete by checking document state
        max_retries = 20
        retry_count = 0
        ocr_completed = False

        while retry_count < max_retries:
            # Check document status
            doc_resp = client.get(f"/v0/orgs/{TEST_ORG_ID}/documents/{document_id}", headers=get_auth_headers())
            assert doc_resp.status_code == 200, f"Failed to get document: {doc_resp.text}"
            doc_data = doc_resp.json()

            logger.info(f"Document state: {doc_data.get('state', 'unknown')}")

            # Check if OCR has completed (state should be "ocr_completed" or later)
            if doc_data.get("state") in [ad.common.doc.DOCUMENT_STATE_OCR_COMPLETED, ad.common.doc.DOCUMENT_STATE_LLM_COMPLETED]:
                ocr_completed = True
                break

            await asyncio.sleep(0.5)
            retry_count += 1

        assert ocr_completed, f"OCR processing did not complete within expected time. Final state: {doc_data.get('state', 'unknown')}"

        # Test OCR metadata endpoint
        metadata_resp = client.get(
            f"/v0/orgs/{TEST_ORG_ID}/ocr/download/metadata/{document_id}",
            headers=get_auth_headers()
        )
        assert metadata_resp.status_code == 200, f"Failed to get OCR metadata: {metadata_resp.text}"
        metadata_data = metadata_resp.json()

        assert "n_pages" in metadata_data, "OCR metadata should contain n_pages"
        assert "ocr_date" in metadata_data, "OCR metadata should contain ocr_date"
        assert metadata_data["n_pages"] > 0, "Document should have at least 1 page"

        # Test OCR text endpoint
        text_resp = client.get(
            f"/v0/orgs/{TEST_ORG_ID}/ocr/download/text/{document_id}",
            headers=get_auth_headers()
        )
        assert text_resp.status_code == 200, f"Failed to get OCR text: {text_resp.text}"
        ocr_text = text_resp.text

        # Verify we got some text from our mock
        assert "INVOICE #12345" in ocr_text, "OCR text should contain mocked invoice data"
        assert "Total: $1,234.56" in ocr_text, "OCR text should contain mocked total amount"
        assert "Vendor: Acme Corp" in ocr_text, "OCR text should contain mocked vendor"

        # Test OCR text endpoint with specific page
        text_page_resp = client.get(
            f"/v0/orgs/{TEST_ORG_ID}/ocr/download/text/{document_id}",
            params={"page_num": 1},
            headers=get_auth_headers()
        )
        assert text_page_resp.status_code == 200, f"Failed to get OCR text for page 1: {text_page_resp.text}"
        page_text = text_page_resp.text
        assert "INVOICE #12345" in page_text, "Page 1 OCR text should contain mocked invoice data"

        # Test OCR blocks/JSON endpoint
        blocks_resp = client.get(
            f"/v0/orgs/{TEST_ORG_ID}/ocr/download/blocks/{document_id}",
            headers=get_auth_headers()
        )
        assert blocks_resp.status_code == 200, f"Failed to get OCR blocks: {blocks_resp.text}"
        blocks_data = blocks_resp.json()

        # Verify we got the mocked Textract blocks
        assert isinstance(blocks_data, list), "OCR blocks should be a list"
        assert len(blocks_data) > 0, "Should have at least one OCR block"

        # Check for expected block structure from our mock
        invoice_block = next((b for b in blocks_data if b.get("Text") == "INVOICE #12345"), None)
        assert invoice_block is not None, "Should find the invoice block in OCR data"
        assert invoice_block["BlockType"] == "LINE", "Invoice block should be a LINE type"
        assert invoice_block["Page"] == 1, "Invoice block should be on page 1"
        assert invoice_block["Confidence"] > 99, "Invoice block should have high confidence"

        # Verify the document status shows OCR processing completed
        final_doc_resp = client.get(f"/v0/orgs/{TEST_ORG_ID}/documents/{document_id}", headers=get_auth_headers())
        assert final_doc_resp.status_code == 200
        final_doc_data = final_doc_resp.json()

        logger.info(f"Final document data: {final_doc_data}")

        # Verify metadata if present
        if "metadata" in final_doc_data and final_doc_data["metadata"]:
            assert final_doc_data["metadata"]["test_source"] == "textract_pipeline_test"

        # Verify the document state indicates OCR completion
        assert final_doc_data.get("state") in [
            ad.common.doc.DOCUMENT_STATE_OCR_COMPLETED,
            ad.common.doc.DOCUMENT_STATE_LLM_COMPLETED
        ], f"Document should be in OCR completed state, got: {final_doc_data.get('state')}"