import bson

def create_id() -> str:
    """
    Create a unique id

    Returns:
        str: The unique id
    """
    return str(bson.ObjectId())