import boto3
import botocore
import aioboto3
from botocore.credentials import AssumeRoleCredentialFetcher, DeferredRefreshableCredentials
import logging
import os

import analytiq_data as ad

logger = logging.getLogger(__name__)

def get_s3_bucket_name(analytiq_client) -> str:
    """
    Get the S3 bucket name from database configuration or environment variable with fallback to default.
    
    Args:
        analytiq_client: Optional AnalytiqClient to check database configuration
        
    Returns:
        The S3 bucket name to use for AWS operations.
    """
    try:
        aws_config = get_aws_config(analytiq_client)
        if aws_config.get("s3_bucket_name"):
            return aws_config["s3_bucket_name"]
    except Exception as e:
        logger.warning(f"Could not get S3 bucket name from database: {e}")

class AWSClient:
    def __init__(self, analytiq_client, region_name: str = "us-east-1"):
        self.env = analytiq_client.env
        self.region_name = region_name
        # Get the AWS keys
        aws_keys = get_aws_config(analytiq_client)
        self.aws_access_key_id = aws_keys["aws_access_key_id"]
        self.aws_secret_access_key = aws_keys["aws_secret_access_key"]

        # Create the session
        self.user_session = boto3.Session(
            region_name=region_name,
            aws_access_key_id=self.aws_access_key_id,
            aws_secret_access_key=self.aws_secret_access_key
        )

        # It's possible that the AWS keys are not set, in which case
        # assuming the role will fail.
        # Initialize the AWS clients with neutral values, and set them only if the
        # credentials are valid.
        self.session = self.user_session
        self.s3 = None
        self.textract = None
        self.ses = None

        try:
            # Get the user's identity
            user_identity = self.user_session.client("sts").get_caller_identity()

            # Get the assume role ARN
            assume_role_arn = get_assume_role_arn(user_identity["Arn"])

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
            self.s3_bucket_name = get_s3_bucket_name(analytiq_client)

            # Create the textract client
            self.textract = self.session.client("textract", region_name=region_name)

        except Exception as e:
            logger.info(f"AWS credentials are not correct: {e}")
            logger.info("AWS client created with empty AWS credentials")

def get_aws_client(analytiq_client, region_name: str = "us-east-1") -> AWSClient:
    """
    Get the AWSClient.

    Args:
        analytiq_client: The AnalytiqClient.

    Returns:
        The AWSClient.
    """
    return AWSClient(analytiq_client, region_name)

def get_aws_config(analytiq_client) -> dict:
    """
    Get the AWS keys.

    Args:
        analytiq_client: The AnalytiqClient.

    Returns:
        The AWS keys.
    """
    db_name = analytiq_client.env
    db = analytiq_client.mongodb[db_name]
    aws_config_collection = db["aws_config"]

    aws_config = aws_config_collection.find_one()
    
    # Parse the AWS keys
    access_key_id = ""
    secret_access_key = ""
    if aws_config:
        access_key_id = ad.crypto.decrypt_token(aws_config.get("access_key_id", ""))
        secret_access_key = ad.crypto.decrypt_token(aws_config.get("secret_access_key", ""))

    return {
        "aws_access_key_id": access_key_id,
        "aws_secret_access_key": secret_access_key,
        "s3_bucket_name": aws_config.get("s3_bucket_name") if aws_config else None
    }

def get_assume_role_arn(user_arn: str) -> str:
    """
    Get the assume role ARN.

    Args:
        user_arn: The user ARN.

    Returns:
        The assume role ARN.
    """
    account_id = user_arn.split(":")[4]
    user_name = user_arn.split("/")[-1]
    account_name = user_name.split("-")[0]
    user_name_base = user_name.split("-")[1]
    return f"arn:aws:iam::{account_id}:role/{account_name}-{user_name_base}-role"

class AsyncAWSClient:
    def __init__(self, analytiq_client, region_name: str = "us-east-1"):
        self.env = analytiq_client.env
        self.region_name = region_name
        
        # Get the AWS keys
        aws_keys = get_aws_config(analytiq_client)
        self.aws_access_key_id = aws_keys["aws_access_key_id"]
        self.aws_secret_access_key = aws_keys["aws_secret_access_key"]
        
        if not self.aws_access_key_id or not self.aws_secret_access_key:
            raise Exception(f"AWS credentials not configured. Cannot create async AWS client.")
        
        # Create the user session (sync for initial setup)
        self.user_session = boto3.Session(
            region_name=region_name,
            aws_access_key_id=self.aws_access_key_id,
            aws_secret_access_key=self.aws_secret_access_key
        )

        # Initialize with user session credentials
        self.session = aioboto3.Session(
            aws_access_key_id=self.aws_access_key_id,
            aws_secret_access_key=self.aws_secret_access_key,
            region_name=region_name
        )
        self.s3_bucket_name = None

        try:
            # Get the user's identity
            user_identity = self.user_session.client("sts").get_caller_identity()
            logger.info(f"User identity: {user_identity['Arn']}")

            # Get the assume role ARN
            assume_role_arn = get_assume_role_arn(user_identity["Arn"])
            logger.info(f"Attempting to assume role: {assume_role_arn}")

            # Create role assumption credentials using the same approach as sync client
            fetcher = AssumeRoleCredentialFetcher(
                client_creator=self.user_session.client,
                source_credentials=self.user_session.get_credentials(),
                role_arn=assume_role_arn,
            )
            
            # Create a botocore session with deferred credentials like the sync client
            botocore_session = botocore.session.Session()
            botocore_session._credentials = DeferredRefreshableCredentials(
                method='assume-role',
                refresh_using=fetcher.fetch_credentials
            )
            
            # Create a sync session to get the credentials
            assumed_session = boto3.Session(botocore_session=botocore_session)
            credentials = assumed_session.get_credentials()
            
            # Create async session with assumed role credentials
            self.session = aioboto3.Session(
                aws_access_key_id=credentials.access_key,
                aws_secret_access_key=credentials.secret_key,
                aws_session_token=credentials.token,
                region_name=region_name
            )
            
            logger.info(f"Successfully assumed role for async client: {assume_role_arn}")

            # Get S3 bucket name
            self.s3_bucket_name = get_s3_bucket_name(analytiq_client)

        except Exception as e:
            logger.error(f"AWS role assumption failed: {e}")
            logger.info("Async AWS client falling back to basic AWS credentials")
            # Fall back to basic credentials if role assumption fails
            self.s3_bucket_name = get_s3_bucket_name(analytiq_client)

def get_aws_client_async(analytiq_client, region_name: str = "us-east-1") -> AsyncAWSClient:
    """
    Get the async AWSClient.

    Args:
        analytiq_client: The AnalytiqClient.
        region_name: AWS region name.

    Returns:
        The AsyncAWSClient.
    """
    return AsyncAWSClient(analytiq_client, region_name)
