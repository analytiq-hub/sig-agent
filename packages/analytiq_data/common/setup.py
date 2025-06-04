import os
from dotenv import load_dotenv
import logging

def setup() -> None:
    """
    Setup the environment variables
    """
    # Get the current directory
    current_dir = os.path.dirname(os.path.abspath(__file__))

    # Load the .env file
    dotenv_path = os.path.join(current_dir, "../.env")
    load_dotenv(dotenv_path=dotenv_path, override=True)

    # Configure logging
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
    logging.basicConfig(
        level=getattr(logging, LOG_LEVEL),
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
