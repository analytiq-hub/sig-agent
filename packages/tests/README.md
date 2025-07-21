# Backend Tests

This directory contains automated tests for the backend API using pytest and pytest-asyncio.

## Test Setup

### Environment

Tests run in an isolated environment with the following configuration:
- Database: A dedicated `pytest` database is used to prevent affecting production data
- Environment variables: Tests use specific environment variables defined in `test_utils.py`

### Shared Test Utilities

Common test utilities are centralized in `test_utils.py`, including:
- Test database setup and teardown
- Authentication mocking
- Common test data
- Helper functions

### Test Database

The test database is automatically:
- Created before each test
- Populated with minimal test data (organization, user)
- Cleaned up after each test

## Running Tests

### Run all tests

```bash
cd backend
python -m pytest tests/
```

### Run specific test file

```bash
python -m pytest tests/test_schemas.py
```

### Run specific test function

```bash
python -m pytest tests/test_schemas.py::test_schema_validation
``` 

### Run with verbose output

```bash
python -m pytest -v tests/test_schemas.py
```

## Adding New Tests

### Creating a New Test File

1. Create a new file with the naming pattern `test_*.py`
2. Import the shared test utilities:

```python
import pytest
import os

# Import shared test utilities
from .test_utils import (
    client, TEST_ORG_ID, 
    get_auth_headers
)
import analytiq_data as ad

# Check that ENV is set to pytest
assert os.environ["ENV"] == "pytest"
```

### Writing Test Functions

1. Mark async test functions with `@pytest.mark.asyncio`
2. Include the `test_db` and `mock_auth` fixtures as parameters
3. Follow the Arrange-Act-Assert pattern
4. Use descriptive test names that explain what's being tested

Example:

```python
@pytest.mark.asyncio
async def test_access_tokens(test_db, mock_auth):
    """Test the complete access token lifecycle"""
    logger.info(f"test_access_tokens() start")
    
    try:
        # Step 1: Create an access token
        token_data = {
            "name": "Test API Token",
            "lifetime": 30  # 30 days
        }
        
        create_response = client.post(
            f"/v0/orgs/{TEST_ORG_ID}/access_tokens",
            json=token_data,
            headers=get_auth_headers()
        )
        
        assert create_response.status_code == 200
        token_result = create_response.json()
        assert "id" in token_result
        assert token_result["name"] == "Test API Token"
        assert token_result["lifetime"] == 30
        assert "token" in token_result  # The actual token value
        
        token_id = token_result["id"]
        
        # Step 2: List access tokens to verify it was created
        list_response = client.get(
            f"/v0/orgs/{TEST_ORG_ID}/access_tokens",
            headers=get_auth_headers()
        )
        
        assert list_response.status_code == 200
        list_data = list_response.json()
        assert "access_tokens" in list_data
        
        # Find our token in the list
        created_token = next((token for token in list_data["access_tokens"] if token["id"] == token_id), None)
        assert created_token is not None
        assert created_token["name"] == "Test API Token"
        assert created_token["lifetime"] == 30
        
        # Step 3: Delete the access token
        delete_response = client.delete(
            f"/v0/orgs/{TEST_ORG_ID}/access_tokens/{token_id}",
            headers=get_auth_headers()
        )
        
        assert delete_response.status_code == 200
        
        # Step 4: List access tokens again to verify it was deleted
        list_after_delete_response = client.get(
            f"/v0/orgs/{TEST_ORG_ID}/access_tokens",
            headers=get_auth_headers()
        )
        
        assert list_after_delete_response.status_code == 200
        list_after_delete_data = list_after_delete_response.json()
        
        # Verify the token is no longer in the list
        deleted_token = next((token for token in list_after_delete_data["access_tokens"] if token["id"] == token_id), None)
        assert deleted_token is None, "Token should have been deleted"
        
    finally:
        pass  # mock_auth fixture handles cleanup
    
    logger.info(f"test_access_tokens() end")
```

### Test Lifecycle Pattern

For comprehensive API testing, follow this pattern:
1. Create a resource
2. List resources to verify creation
3. Get the specific resource
4. Update the resource
5. Verify the update
6. Delete the resource
7. Verify the deletion

### Creating Test Fixtures

For reusable test data, create fixtures in your test file:

```python
@pytest.fixture
def small_pdf():
    """Create a minimal test PDF file"""
    pdf_content = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n"
    return {
        "name": "small_test.pdf",
        "content": f"data:application/pdf;base64,{base64.b64encode(pdf_content).decode()}"
    }
```

Shared fixtures can be added to `test_utils.py` for reuse across multiple test files.

## Github Actions

The `backend-tests` workflow runs all tests on every pull request.

## Best Practices

1. **Isolation**: Each test should be independent and not rely on state from other tests
2. **Cleanup**: Always clean up resources created during tests
3. **Assertions**: Use specific assertions that clearly indicate what's being tested
4. **Documentation**: Include docstrings explaining what each test is verifying
5. **Error Handling**: Use try/finally blocks to ensure cleanup happens even if tests fail

## Troubleshooting

### Database Issues

If tests are affecting your development database:
- Verify `os.environ["ENV"] == "pytest"` at the start of your test
- Check that the `test_db` fixture is being used
- Ensure the database connection is using the correct database name

### Authentication Issues

If you're getting authentication errors:
- Make sure you're including the `mock_auth` fixture in your test function
- Verify you're using `get_auth_headers()` for all API requests
- Check that the test is properly cleaning up after itself

### Async Issues

If you're having issues with async tests:
- Ensure your test function is marked with `@pytest.mark.asyncio`
- Make sure you're awaiting async operations
- Check that you're using the correct fixtures