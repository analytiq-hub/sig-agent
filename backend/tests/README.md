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
from test_utils import (
    client, TEST_USER, TEST_ORG_ID, 
    test_db, get_auth_headers, mock_auth
)

import analytiq_data as ad

# Verify test environment
assert os.environ["ENV"] == "pytest"
```

### Writing Test Functions

1. Mark async test functions with `@pytest.mark.asyncio`
2. Include the `test_db` and `mock_auth` fixtures as parameters
3. Follow the Arrange-Act-Assert pattern
4. Use descriptive test names that explain what's being tested

Example:

```python
async def test_create_resource(test_db, mock_auth):
    """Test creating a new resource"""
    # Arrange - prepare test data
    resource_data = {
        "name": "Test Resource",
        "description": "A test resource"
    }

    # Act - make the API call
    response = client.post(
        f"/v0/orgs/{TEST_ORG_ID}/resources",
        json=resource_data,
        headers=get_auth_headers()
    )

    # Assert - verify the response
    assert response.status_code == 200
    result = response.json()
    assert "id" in result
    assert result["name"] == "Test Resource"
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
def test_resource():
    """Test resource fixture"""
    return {
        "name": "Test Resource",
        "description": "A test resource"
    }
```

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