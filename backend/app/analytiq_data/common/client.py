import analytiq_data as ad

class AnalytiqDataClient:
    def __init__(self):
        self.mongodb = ad.mongodb.get_mongodb_client()

def get_client() -> AnalytiqDataClient:
    """
    Get the AnalytiqDataClient.
    """
    return AnalytiqDataClient()
