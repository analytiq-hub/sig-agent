import pytest

# Define pytest configuration
pytest_plugins = ["pytest_asyncio"]

# Set default asyncio fixture scope
def pytest_addoption(parser):
    parser.addini(
        "asyncio_default_fixture_loop_scope",
        help="default scope for asyncio fixtures",
        default="function",
    ) 