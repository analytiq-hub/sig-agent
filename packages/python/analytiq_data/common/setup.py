import os
from dotenv import load_dotenv
import logging

def setup() -> None:
    """
    Setup the environment variables
    """
    # Get the current directory
    current_dir = os.path.dirname(os.path.abspath(__file__))

    # Check if we're in testing mode (pytest or pytest_ts environment)
    env = os.getenv("ENV", "")
    is_testing = env.startswith("pytest")

    # Only load .env file if not in testing mode
    # In testing mode, all environment variables should be set by the test framework
    if not is_testing:
        dotenv_path = os.path.join(current_dir, "../../../.env")
        load_dotenv(dotenv_path=dotenv_path, override=False)

    # Configure logging
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
    logging.basicConfig(
        level=getattr(logging, LOG_LEVEL),
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
