import analytiq_data as ad

class AnalytiqClient:
    def __init__(self, env: str = "dev"):
        self.env = env
        self.mongodb = ad.mongodb.get_mongodb_client(env)

def get_client(env: str = "dev") -> AnalytiqClient:
    """
    Get the AnalytiqClient.

    Args:
        env: The environment to connect to. Defaults to "dev".

    Returns:
        The AnalytiqClient.
    """
    return AnalytiqClient(env)
