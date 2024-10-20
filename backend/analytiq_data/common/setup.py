import os
from dotenv import load_dotenv


def setup() -> None:
    """
    Setup the environment variables
    """
    # Get the current directory
    current_dir = os.path.dirname(os.path.abspath(__file__))

    # Load the .env file
    dotenv_path = os.path.join(current_dir, "../.env")
    if not load_dotenv(dotenv_path=dotenv_path):
        raise Exception(f"Failed to load {dotenv_path}")
