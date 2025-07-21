import pytest
import os
import uuid
import pytest_asyncio

# Define pytest configuration
pytest_plugins = ["pytest_asyncio"]

# Set default asyncio fixture scope
def pytest_addoption(parser):
    parser.addini(
        "asyncio_default_fixture_loop_scope",
        help="default scope for asyncio fixtures",
        default="function",
    )

@pytest_asyncio.fixture(scope="session")
def unique_db_name():
    # Use xdist worker id if available, else use a UUID
    worker_id = os.environ.get("PYTEST_XDIST_WORKER")
    if worker_id:
        db_name = f"pytest_{worker_id}"
    else:
        db_name = f"pytest_{uuid.uuid4()}"

    os.environ["ENV"] = db_name
    return db_name