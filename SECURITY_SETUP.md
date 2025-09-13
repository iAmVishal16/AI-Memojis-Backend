# Backend Authentication Setup Guide

## Environment Variables Required

### Backend (Vercel)
Set these environment variables in your Vercel project settings:

1. **OPENAI_API_KEY** - Your OpenAI API key for image generation
2. **BACKEND_SECRET** - A secure random string for HMAC signing (generate with `openssl rand -hex 32`)

### Plugin Build Process
The plugin needs the same `BACKEND_SECRET` injected at build time:

```bash
# Set the secret (same as backend)
export BACKEND_SECRET="your-secret-here"

# Build the plugin with injected secret
npm run build
```

## Security Features Implemented

### ✅ HMAC Authentication
- All requests must be signed with HMAC-SHA256
- Signature includes timestamp + request body
- Prevents request tampering and replay attacks

### ✅ Rate Limiting
- 10 requests per minute per IP
- 5 burst requests allowed
- Returns 429 status with retry headers

### ✅ Request Validation
- Validates prompt length (max 1000 chars)
- Validates size parameter (1024x1024, 1792x1024, 1024x1792)
- Validates background parameter (auto, transparent)

### ✅ Replay Protection
- 5-minute timestamp window
- Prevents replay of old requests

### ✅ Error Handling
- User-friendly error messages
- Detailed server-side logging
- Proper HTTP status codes (401, 429, 400, 500)

## Testing

### Health Check
```bash
curl https://ai-memojis-backend.vercel.app/api/health
```

### Authentication Test
```bash
# Set your secret
export BACKEND_SECRET="your-secret-here"

# Run the test script
node test-auth.js
```

## Deployment Checklist

### Backend Deployment
- [ ] Set `OPENAI_API_KEY` in Vercel environment variables
- [ ] Set `BACKEND_SECRET` in Vercel environment variables
- [ ] Deploy backend to Vercel
- [ ] Test health endpoint
- [ ] Test authentication with test script

### Plugin Deployment
- [ ] Set `BACKEND_SECRET` environment variable
- [ ] Run `npm run build` to inject secret
- [ ] Test plugin in Figma development mode
- [ ] Verify successful memoji generation
- [ ] Deploy to Figma Community

## Security Notes

1. **Secret Management**: The `BACKEND_SECRET` is embedded in the client code, so it's not truly secret from determined attackers. This is "security through obscurity" - it prevents casual abuse but won't stop sophisticated attacks.

2. **Rate Limiting**: Current implementation uses in-memory storage. For production scale, consider using Redis or Vercel's built-in rate limiting.

3. **Monitoring**: Monitor your OpenAI usage and set up alerts for unusual spikes in API calls.

4. **Key Rotation**: Plan to rotate `BACKEND_SECRET` periodically and update both backend and plugin simultaneously.

## Troubleshooting

### Common Issues

1. **401 Unauthorized**: Check that `BACKEND_SECRET` matches between backend and plugin
2. **429 Rate Limited**: Wait for rate limit window to reset (1 minute)
3. **500 Server Error**: Check OpenAI API key and backend logs
4. **Network Error**: Verify backend URL is accessible

### Debug Steps

1. Check health endpoint: `/api/health`
2. Verify environment variables are set
3. Check Vercel function logs
4. Test with authentication test script
5. Verify plugin build process completed successfully
