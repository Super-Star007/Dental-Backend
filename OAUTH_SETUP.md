# OAuth Setup Guide

This guide explains how to set up Google and Facebook OAuth authentication for the Nigrek Dental Visit System.

## Prerequisites

- Google Cloud Console account (for Google OAuth)
- Facebook Developer account (for Facebook OAuth)

## Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API:
   - Navigate to "APIs & Services" > "Library"
   - Search for "Google+ API" and enable it
4. Create OAuth 2.0 credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Choose "Web application"
   - Add authorized redirect URIs:
     - `http://localhost:5000/api/auth/google/callback` (for development)
     - `https://yourdomain.com/api/auth/google/callback` (for production)
   - Copy the Client ID and Client Secret

## Facebook OAuth Setup

1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Create a new app or select an existing one
3. Add Facebook Login product:
   - Go to "Products" > "Facebook Login" > "Set Up"
4. Configure OAuth Redirect URIs:
   - Go to "Settings" > "Basic"
   - Add Valid OAuth Redirect URIs:
     - `http://localhost:5000/api/auth/facebook/callback` (for development)
     - `https://yourdomain.com/api/auth/facebook/callback` (for production)
5. Copy the App ID and App Secret from "Settings" > "Basic"

## Environment Variables

Add the following to your `.env` file:

```env
# Backend URL (for OAuth callbacks)
BACKEND_URL=http://localhost:5000

# Frontend URL
FRONTEND_URL=http://localhost:3000

# Google OAuth Configuration
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback

# Facebook OAuth Configuration
FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret
FACEBOOK_CALLBACK_URL=http://localhost:5000/api/auth/facebook/callback
```

## Production Setup

For production, update the following:

1. **Callback URLs**: Update both Google and Facebook callback URLs to use your production domain
2. **Authorized Domains**: Add your production domain to both Google and Facebook app settings
3. **Environment Variables**: Update `BACKEND_URL` and `FRONTEND_URL` in your production `.env` file

## Testing

1. Start the backend server: `npm run dev`
2. Start the frontend: `npm start`
3. Navigate to the login or register page
4. Click on "Googleでログイン" or "Facebookでログイン"
5. Complete the OAuth flow
6. You should be redirected back to the dashboard after successful authentication

## Troubleshooting

### Common Issues

1. **"Redirect URI mismatch" error**:
   - Ensure the callback URL in your `.env` file matches exactly with the one configured in Google/Facebook console
   - Check for trailing slashes and protocol (http vs https)

2. **"Invalid client" error**:
   - Verify your Client ID and Client Secret are correct
   - Ensure the OAuth credentials are enabled in the respective consoles

3. **"Access denied" error**:
   - Check that the required scopes (email, profile) are enabled
   - Verify the app is in development mode and test users are added (for Facebook)

4. **User creation fails**:
   - Check MongoDB connection
   - Verify email validation rules allow the OAuth provider's email format

## Security Notes

- Never commit `.env` files to version control
- Use strong, unique secrets for production
- Regularly rotate OAuth credentials
- Monitor OAuth usage in Google Cloud Console and Facebook Developer Console
- Implement rate limiting for OAuth endpoints in production

