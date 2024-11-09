import boto3
import botocore
from botocore.credentials import AssumeRoleCredentialFetcher, DeferredRefreshableCredentials

import analytiq_data as ad

class AWSClient:
    def __init__(self, analytiq_client, region_name: str = "us-east-1"):
        self.env = analytiq_client.env

        # Get the AWS keys
        aws_keys = get_aws_keys(analytiq_client)
        self.aws_access_key_id = aws_keys["aws_access_key_id"]
        self.aws_secret_access_key = aws_keys["aws_secret_access_key"]

        # Create the session
        self.user_session = boto3.Session(
            region_name=region_name,
            aws_access_key_id=self.aws_access_key_id,
            aws_secret_access_key=self.aws_secret_access_key
        )

        # The assumed role ARN
        assume_role_arn = f"arn:aws:iam::890742589311:role/code-app-role"

        fetcher = AssumeRoleCredentialFetcher(
            client_creator=self.user_session.client,
            source_credentials=self.user_session.get_credentials(),
            role_arn=assume_role_arn,
        ) 
        botocore_session = botocore.session.Session()
        botocore_session._credentials = DeferredRefreshableCredentials(
            method='assume-role',
            refresh_using=fetcher.fetch_credentials
        )

        # Create the assumed role session
        self.session = boto3.Session(botocore_session=botocore_session)

        # Create the s3 client
        self.s3 = self.session.client("s3", region_name=region_name)

        # Create the textract client
        self.textract = boto3.client(
            "textract",
            region_name=region_name,
            aws_access_key_id=self.aws_access_key_id,
            aws_secret_access_key=self.aws_secret_access_key
        )

def get_aws_client(analytiq_client, region_name: str = "us-east-1") -> AWSClient:
    """
    Get the AWSClient.

    Args:
        analytiq_client: The AnalytiqClient.

    Returns:
        The AWSClient.
    """
    return AWSClient(analytiq_client, region_name)

def get_aws_keys(analytiq_client) -> dict:
    """
    Get the AWS keys.

    Args:
        analytiq_client: The AnalytiqClient.

    Returns:
        The AWS keys.
    """
    db_name = analytiq_client.env
    db = analytiq_client.mongodb[db_name]
    aws_keys_collection = db["aws_credentials"]

    aws_keys = aws_keys_collection.find_one()
    if aws_keys is None or "access_key_id" not in aws_keys or "secret_access_key" not in aws_keys:
        raise ValueError("AWS keys not found")

    return {
        "aws_access_key_id": aws_keys["access_key_id"],
        "aws_secret_access_key": aws_keys["secret_access_key"]
    }
