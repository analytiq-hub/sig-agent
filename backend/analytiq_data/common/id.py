import uuid

def create_id() -> str:
    """
    Create a unique id

    Returns:
        str: The unique id
    """
    return str(uuid.uuid4())