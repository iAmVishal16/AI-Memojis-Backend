# AI Memojis Backend API

This is the backend API for the AI Memojis Figma plugin.

## 🚀 Quick Start

### 1. Set Environment Variables
```bash
# Set your OpenAI API key
export OPENAI_API_KEY="sk-your-openai-api-key-here"
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Start Development Server
```bash
npm start
```

The server will start on `http://localhost:3000`

### 4. Test the API
```bash
# Test health endpoint
curl http://localhost:3000/api/health

# Test memoji generation
node test-backend.js
```

## 📡 API Endpoints

### POST `/api/generate-memoji`
Generate a memoji image using OpenAI API.

**Request Body:**
```json
{
  "prompt": "A premium 3D Memoji-style avatar...",
  "size": "1024x1024",
  "background": "transparent"
}
```

**Response:**
```json
{
  "data": [
    {
      "b64_json": "base64-encoded-image-data"
    }
  ]
}
```

### GET `/api/health`
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-01-09T23:46:00.000Z"
}
```

### GET `/api/usage-stats`
Get usage statistics (for monitoring).

## 🌐 Deployment Options

### Option 1: Vercel (Recommended)
```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Deploy
vercel --prod

# Set environment variable
vercel env add OPENAI_API_KEY
```

### Option 2: Railway
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Initialize project
railway init

# Set environment variable
railway variables set OPENAI_API_KEY=your_key_here

# Deploy
railway up
```

### Option 3: Heroku
```bash
# Install Heroku CLI
# Create Procfile: web: node index.js

# Set environment variable
heroku config:set OPENAI_API_KEY=your_key_here

# Deploy
git push heroku main
```

## 🔧 Configuration

Update the backend URL in your Figma plugin:

**In `code.js`:**
```javascript
function getBackendUrl() {
    return 'https://your-deployed-backend.vercel.app/api/generate-memoji';
}
```

**In `manifest.json`:**
```json
{
  "networkAccess": {
    "allowedDomains": [
      "https://your-deployed-backend.vercel.app"
    ]
  }
}
```

## 💰 Cost Management

- OpenAI API cost: ~$0.24 per image
- Free tier: 2 generations per user
- Pro tier: Unlimited generations
- Break-even: ~42 generations per month per user

## 🔒 Security Features

- Rate limiting: 100 requests per 15 minutes
- Input validation
- Error handling
- Usage tracking
- CORS enabled

## 📊 Monitoring

Monitor your deployment:
- Check `/api/health` for status
- Check `/api/usage-stats` for metrics
- Monitor OpenAI API usage
- Set up billing alerts

## 🐛 Troubleshooting

### Common Issues:
1. **Missing API Key**: Set `OPENAI_API_KEY` environment variable
2. **CORS Errors**: Ensure your Figma plugin domain is allowed
3. **Rate Limits**: Check OpenAI API rate limits
4. **Network Errors**: Verify backend URL in plugin

### Debug Commands:
```bash
# Test locally
npm start
node test-backend.js

# Check logs
vercel logs
railway logs
heroku logs --tail
```

## 📞 Support

For issues:
1. Check the logs
2. Test locally first
3. Verify environment variables
4. Check OpenAI API status

---

**Ready to deploy?** Choose your platform and follow the deployment steps above! 🚀
