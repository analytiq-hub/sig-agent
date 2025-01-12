import boto3
from botocore.exceptions import ClientError
import logging
from typing import Optional
from datetime import datetime
import re

async def send_email(
    to_email: str,
    subject: str,
    content: str,
    from_email: str,
    region_name: str = "us-east-1"
) -> bool:
    """
    Send an email using AWS SES
    
    Args:
        to_email: Recipient email address
        subject: Email subject
        content: Email content (HTML)
        from_email: Sender email address
        region_name: AWS region name (default: us-east-1)
        
    Returns:
        bool: True if email was sent successfully
        
    Raises:
        Exception: If email sending fails
    """
    try:
        # Create SES client
        ses_client = boto3.client('ses', region_name=region_name)
        
        # Create email message
        message = {
            'Subject': {
                'Data': subject
            },
            'Body': {
                'Html': {
                    'Data': content
                }
            }
        }
        
        # Send email
        response = ses_client.send_email(
            Source=from_email,
            Destination={
                'ToAddresses': [to_email]
            },
            Message=message
        )
        
        logging.info(f"Email sent! Message ID: {response['MessageId']}")
        return True
        
    except ClientError as e:
        logging.error(f"Failed to send email: {str(e)}")
        raise Exception(f"Failed to send email: {str(e)}")

def get_site_name(url: str) -> str:
    """
    Extract site name from URL by removing protocol and any trailing paths
    
    Args:
        url: Full site URL (e.g., https://example.com/path)
    
    Returns:
        str: Clean site name (e.g., example.com)
    """
    # Remove protocol (http:// or https://)
    site_name = re.sub(r'^https?://', '', url)
    # Remove any paths or query parameters
    site_name = site_name.split('/')[0]
    return site_name

def get_verification_email_content(verification_url: str, site_url: str, user_name: Optional[str] = None) -> str:
    """
    Generate HTML content for verification email
    
    Args:
        verification_url: The URL for email verification
        site_url: The base URL of the site (for logo)
        user_name: Optional user's name for personalization
    
    Returns:
        str: HTML content for the email
    """
    greeting = f"Hello {user_name}" if user_name else "Hello"
    
    return f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>{greeting},</h2>
        <p>Please verify your email address for your Smart Document Router account by clicking the link below:</p>
        <p style="margin: 20px 0;">
            <a href="{verification_url}" 
               style="background-color: #0070f3; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 5px; display: inline-block;">
                Verify Email
            </a>
        </p>
        <p>Or copy and paste this URL into your browser:</p>
        <p style="word-break: break-all; color: #666;">
            {verification_url}
        </p>
        <p>This link will expire in 24 hours.</p>
        <hr style="border: none; border-top: 1px solid #eaeaea; margin: 20px 0;">
        <p style="color: #666; font-size: 0.9em;">
            If you didn't request this verification for {site_name}, you can safely ignore this email.
        </p>
    </div>
    """

def get_email_subject(email_type: str) -> str:
    """
    Get email subject based on type
    
    Args:
        email_type: Type of the email
    
    Returns:
        str: Email subject
    """
    subjects = {
        "verification": "Verify your email address",
        "invitation": "You've been invited to join a Smart Document Router organization",
        "password_reset": "Reset your password"
    }
    return subjects.get(email_type, "Notification") 

def get_invitation_email_content(
    invitation_url: str,
    site_url: str,
    expires: datetime,
    organization_name: Optional[str] = None
) -> str:
    """
    Generate HTML content for invitation email
    
    Args:
        invitation_url: The URL for accepting the invitation
        site_url: The base URL of the site
        expires: When the invitation expires
        organization_name: Optional organization name for org-specific invites
    
    Returns:
        str: HTML content for the email
    """
    expires_str = expires.strftime("%B %d, %Y at %I:%M %p UTC")
    
    # Customize message based on whether it's an org invite
    invite_message = (
        f"You've been invited to join a Smart Document Router organization: {organization_name}" 
        if organization_name 
        else f"You've been invited to join a Smart Document Router organization"
    )
    
    return f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>{invite_message}</h2>
        <p>Click the button below to accept the invitation and create your account:</p>
        <p style="margin: 20px 0;">
            <a href="{invitation_url}" 
               style="background-color: #0070f3; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 5px; display: inline-block;">
                Accept Invitation
            </a>
        </p>
        <p>Or copy and paste this URL into your browser:</p>
        <p style="word-break: break-all; color: #666;">
            {invitation_url}
        </p>
        <p>This invitation will expire on {expires_str}.</p>
        <hr style="border: none; border-top: 1px solid #eaeaea; margin: 20px 0;">
        <p style="color: #666; font-size: 0.9em;">
            If you weren't expecting this invitation to {site_name}, you can safely ignore this email.
        </p>
    </div>
    """ 