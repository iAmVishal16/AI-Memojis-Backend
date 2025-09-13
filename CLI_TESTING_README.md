# AI Memojis CLI Testing Tools

This directory contains comprehensive CLI testing tools for the AI Memojis backend API.

## Available Tools

### 1. `test-cli-memoji.js` - Production API Test Suite
Tests the production backend API with proper authentication and rate limiting.

```bash
node test-cli-memoji.js
```

**Features:**
- Tests authentication with HMAC signatures
- Tests rate limiting (sends multiple requests)
- Tests different memoji prompts and parameters
- Tests error handling scenarios
- Saves generated images to `./test-outputs/`

### 2. `test-cli-local.js` - Local Proxy Test Suite
Tests the local proxy server (no authentication required).

```bash
node test-cli-local.js
```

**Features:**
- Tests with local proxy (mock responses)
- Tests with real OpenAI API (if API key is set)
- Tests different sizes and backgrounds
- Saves generated images to `./test-outputs/`

### 3. `memoji-cli.js` - Interactive CLI Tool
Interactive command-line interface for generating memojis.

```bash
node memoji-cli.js
```

**Features:**
- Interactive menu-driven interface
- Custom memoji generation
- Pre-defined family member memojis
- Professional memojis
- Batch generation
- Size testing
- Backend switching (local/production)
- File management

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start local proxy (optional):**
   ```bash
   node local-proxy.js
   ```

3. **Set environment variables (for production testing):**
   ```bash
   export BACKEND_SECRET="your-backend-secret"
   export OPENAI_API_KEY="your-openai-api-key"
   ```

## Usage Examples

### Test Production API
```bash
# Test with authentication
node test-cli-memoji.js
```

### Test Local Proxy
```bash
# Test with local proxy (mock responses)
node test-cli-local.js
```

### Interactive Generation
```bash
# Start interactive CLI
node memoji-cli.js

# Follow the menu prompts to:
# 1. Generate custom memojis
# 2. Generate family member memojis
# 3. Generate professional memojis
# 4. Batch generate multiple memojis
# 5. Test different sizes
# 6. Switch between local/production backends
# 7. View generated files
```

## Output

All generated images are saved to the `./test-outputs/` directory with descriptive filenames.

## Test Results

The CLI tools provide detailed output including:
- Request/response details
- Response times
- Success/failure status
- Generated image information
- Error messages and debugging info

## Authentication

- **Production API**: Requires HMAC signature authentication
- **Local Proxy**: No authentication required (uses mock responses)
- **Real OpenAI API**: Requires `OPENAI_API_KEY` environment variable

## Rate Limiting

The production API implements rate limiting:
- 10 requests per minute per IP
- 5 burst requests allowed
- Rate limit headers included in responses

## Error Handling

The tools test various error scenarios:
- Invalid authentication
- Rate limit exceeded
- Invalid parameters
- Network errors
- Missing API keys
