# Setting Up Next-Auth with OAuth Providers

This guide explains how to set up Next-Auth with Google and GitHub OAuth providers.

## Prerequisites
- Valid domain name (for production)

## Google OAuth Setup

1. Visit the Google Cloud Console (https://console.cloud.google.com)
2. Create a new project or select an existing one
3. Navigate to "APIs & Services" > "Credentials"
4. Click "Create Credentials" > "OAuth client ID"
5. Select "Web application" as the application type
6. Add authorized origins:
   - For development: http://localhost:3000
   - For production: https://your-domain.com
7. Add authorized redirect URIs:
   - For development: http://localhost:3000/api/auth/callback/google
   - For production: https://your-domain.com/api/auth/callback/google
8. Save the client ID and client secret

## GitHub OAuth Setup

1. Go to GitHub Settings > Your Organization > Developer settings > OAuth Apps
2. Click "New OAuth App"
3. Fill in the application details:
   - Application name: Your app name
   - Homepage URL: 
     - Development: http://localhost:3000
     - Production: https://your-domain.com
   - Authorization callback URL:
     - Development: http://localhost:3000/api/auth/callback/github
     - Production: https://your-domain.com/api/auth/callback/github
4. Register the application
5. Save the client ID and generate a client secret

## Environment Variables

Add these variables to your `frontend/.env.local` and `backend/anaytiq-hub/.env`:

```bash
# For Google:
AUTH_GOOGLE_ID=your_google_client_id
AUTH_GOOGLE_SECRET=your_google_client_secret

# For GitHub:
AUTH_GITHUB_ID=your_github_client_id
AUTH_GITHUB_SECRET=your_github_client_secret

# Required for Next-Auth:
NEXTAUTH_URL=http://localhost:3000 (in development)
NEXTAUTH_URL=https://your-domain.com (in production)
NEXTAUTH_SECRET=your_random_secret_key
```

## Security Notes

1. Never commit .env files to version control
2. Generate NEXTAUTH_SECRET using a secure random generator
3. Keep client secrets confidential
4. Use environment-specific OAuth credentials
5. Regularly rotate secrets in production

## Troubleshooting

Common issues:

1. Callback URL mismatch: Ensure the callback URLs in OAuth providers exactly match your application URLs
2. Invalid redirect URI: Check for typos in environment variables
3. CORS errors: Verify authorized origins are correctly set
4. Token errors: Confirm NEXTAUTH_SECRET is properly set
5. Session issues: Check if NEXTAUTH_URL matches your actual domain

## Additional Resources

- Next-Auth Documentation: https://next-auth.js.org
- Google OAuth Documentation: https://developers.google.com/identity/protocols/oauth2
- GitHub OAuth Documentation: https://docs.github.com/en/developers/apps/building-oauth-apps 