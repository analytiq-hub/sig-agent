from typing import Optional

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
    greeting = f"Hello {user_name}," if user_name else "Hello,"
    
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{
                font-family: Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
            }}
            .email-container {{
                padding: 20px;
                background-color: #f9fafb;
            }}
            .header {{
                text-align: center;
                padding: 20px 0;
            }}
            .logo {{
                max-width: 200px;
                height: auto;
            }}
            .content {{
                background-color: white;
                padding: 30px;
                border-radius: 8px;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            }}
            .button {{
                display: inline-block;
                padding: 12px 24px;
                background-color: #2563eb;
                color: #ffffff !important;
                text-decoration: none;
                border-radius: 6px;
                margin: 20px 0;
            }}
            .button:link,
            .button:visited,
            .button:hover,
            .button:active {{
                color: #ffffff !important;
                text-decoration: none;
            }}
            .footer {{
                text-align: center;
                padding: 20px;
                color: #6b7280;
                font-size: 0.875rem;
            }}
        </style>
    </head>
    <body>
        <div class="email-container">
            <div class="header">
                <img src="{site_url}/logo.png" alt="Smart Document Router" class="logo">
            </div>
            <div class="content">
                <h1 style="color: #1f2937; margin-bottom: 20px;">Verify your email address</h1>
                <p>{greeting}</p>
                <p>Thank you for registering with Smart Document Router. Please click the button below to verify your email address:</p>
                <p style="text-align: center;">
                    <a href="{verification_url}" class="button" style="color: #ffffff !important;">
                        Verify Email Address
                    </a>
                </p>
                <p>If the button doesn't work, you can also copy and paste this link into your browser:</p>
                <p style="word-break: break-all; color: #4b5563;">
                    {verification_url}
                </p>
                <p>This link will expire in 24 hours.</p>
            </div>
            <div class="footer">
                <p>This email was sent by Smart Document Router</p>
                <p>If you didn't request this email, you can safely ignore it.</p>
            </div>
        </div>
    </body>
    </html>
    """

def get_email_subject(template_name: str) -> str:
    """
    Get email subject based on template name
    
    Args:
        template_name: Name of the email template
    
    Returns:
        str: Email subject
    """
    subjects = {
        "verification": "Verify your email address - Smart Document Router",
        # Add more email subjects here as needed
    }
    return subjects.get(template_name, "Smart Document Router") 