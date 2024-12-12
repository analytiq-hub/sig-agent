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
    load_dotenv(dotenv_path=dotenv_path, override=True)