import analytiq_data as ad

class AWSClient:
    def __init__(self, env: str = "dev"):
        self.env = env

def get_aws_client(env: str = "dev") -> AWSClient:
    """
    Get the AWSClient.

    Args:
        env: The environment to connect to. Defaults to "dev".

    Returns:
        The AWSClient.
    """
    return AWSClient(env)