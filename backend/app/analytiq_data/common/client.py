import analytiq_data as ad

class AnalytiqClient:
    def __init__(self):
        self.mongodb = ad.mongodb.get_mongodb_client()

def get_client() -> AnalytiqDataClient:
    """
    Get the AnalytiqClient.
    """
    return AnalytiqClient()
