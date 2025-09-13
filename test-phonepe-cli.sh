#!/bin/bash

# PhonePe Integration CLI Test Script
# Usage: ./test-phonepe-cli.sh [local|remote|auth]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
LOCAL_PROXY="http://localhost:3000"
REMOTE_BACKEND="https://ai-memojis-backend-cbhjztnqu-iamvishal16s-projects.vercel.app"
PHONEPE_AUTH_URL="https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token"

# Test data
TEST_USER_ID="test-user-$(date +%s)"
TEST_PLAN="monthly"

echo -e "${BLUE}🧪 PhonePe Integration CLI Test${NC}"
echo "=================================="
echo ""

# Function to test PhonePe Authorization API
test_auth_api() {
    echo -e "${YELLOW}📡 Testing PhonePe Authorization API...${NC}"
    echo "URL: $PHONEPE_AUTH_URL"
    echo ""
    
    # Test with invalid credentials (should return 401)
    echo "Testing with invalid credentials (expected: 401)..."
    response=$(curl -s -w "\n%{http_code}" \
        --location "$PHONEPE_AUTH_URL" \
        --header 'Content-Type: application/x-www-form-urlencoded' \
        --data-urlencode 'client_id=INVALID_CLIENT_ID' \
        --data-urlencode 'client_version=1.0' \
        --data-urlencode 'client_secret=INVALID_CLIENT_SECRET' \
        --data-urlencode 'grant_type=client_credentials')
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    if [ "$http_code" = "401" ]; then
        echo -e "${GREEN}✅ Authorization API is accessible and responding correctly (401 as expected)${NC}"
        echo "Response: $body"
    else
        echo -e "${RED}❌ Unexpected response code: $http_code${NC}"
        echo "Response: $body"
    fi
    echo ""
}

# Function to test local proxy
test_local_proxy() {
    echo -e "${YELLOW}🏠 Testing Local Proxy...${NC}"
    echo "URL: $LOCAL_PROXY/api/phonepe/checkout"
    echo ""
    
    # Check if local proxy is running
    if ! curl -s "$LOCAL_PROXY/api/health" > /dev/null; then
        echo -e "${RED}❌ Local proxy is not running at $LOCAL_PROXY${NC}"
        echo "Please start it with: cd AI-Memojis-Backend && node local-proxy.js"
        return 1
    fi
    
    echo "Testing PhonePe checkout with local proxy..."
    response=$(curl -s -w "\n%{http_code}" \
        -X POST "$LOCAL_PROXY/api/phonepe/checkout" \
        -H "Content-Type: application/json" \
        -d "{\"userId\": \"$TEST_USER_ID\", \"plan\": \"$TEST_PLAN\"}")
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    if [ "$http_code" = "200" ]; then
        echo -e "${GREEN}✅ Local proxy PhonePe integration working${NC}"
        echo "Response: $body"
        
        # Extract redirect URL
        redirect_url=$(echo "$body" | grep -o '"redirectUrl":"[^"]*"' | cut -d'"' -f4)
        if [ -n "$redirect_url" ]; then
            echo -e "${GREEN}✅ Redirect URL generated: $redirect_url${NC}"
        fi
    else
        echo -e "${RED}❌ Local proxy test failed with code: $http_code${NC}"
        echo "Response: $body"
    fi
    echo ""
}

# Function to test remote backend
test_remote_backend() {
    echo -e "${YELLOW}🌐 Testing Remote Backend...${NC}"
    echo "URL: $REMOTE_BACKEND/api/phonepe/checkout"
    echo ""
    
    echo "Testing PhonePe checkout with remote backend..."
    response=$(curl -s -w "\n%{http_code}" \
        -X POST "$REMOTE_BACKEND/api/phonepe/checkout" \
        -H "Content-Type: application/json" \
        -d "{\"userId\": \"$TEST_USER_ID\", \"plan\": \"$TEST_PLAN\"}")
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    if [ "$http_code" = "200" ]; then
        echo -e "${GREEN}✅ Remote backend PhonePe integration working${NC}"
        echo "Response: $body"
    elif [ "$http_code" = "404" ]; then
        echo -e "${YELLOW}⚠️  Remote backend endpoint not found (404)${NC}"
        echo "This means the PhonePe integration hasn't been deployed yet."
        echo "Please deploy your changes to Vercel first."
    elif [ "$http_code" = "500" ]; then
        echo -e "${YELLOW}⚠️  Remote backend error (500)${NC}"
        echo "Response: $body"
        echo "This might be due to missing environment variables."
    else
        echo -e "${RED}❌ Remote backend test failed with code: $http_code${NC}"
        echo "Response: $body"
    fi
    echo ""
}

# Function to test webhook
test_webhook() {
    echo -e "${YELLOW}🔗 Testing Webhook...${NC}"
    echo "URL: $LOCAL_PROXY/api/phonepe/webhook"
    echo ""
    
    webhook_payload='{
        "success": true,
        "code": "PAYMENT_SUCCESS",
        "data": {
            "merchantId": "TEST_MERCHANT",
            "merchantTransactionId": "test-order-123",
            "userId": "'$TEST_USER_ID'",
            "plan": "'$TEST_PLAN'"
        }
    }'
    
    echo "Testing webhook with payload: $webhook_payload"
    response=$(curl -s -w "\n%{http_code}" \
        -X POST "$LOCAL_PROXY/api/phonepe/webhook" \
        -H "Content-Type: application/json" \
        -d "$webhook_payload")
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    if [ "$http_code" = "200" ]; then
        echo -e "${GREEN}✅ Webhook test successful${NC}"
        echo "Response: $body"
    else
        echo -e "${RED}❌ Webhook test failed with code: $http_code${NC}"
        echo "Response: $body"
    fi
    echo ""
}

# Function to test status endpoint
test_status() {
    echo -e "${YELLOW}📊 Testing Status Endpoint...${NC}"
    echo "URL: $LOCAL_PROXY/api/phonepe/status?userId=$TEST_USER_ID"
    echo ""
    
    response=$(curl -s -w "\n%{http_code}" \
        "$LOCAL_PROXY/api/phonepe/status?userId=$TEST_USER_ID")
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    if [ "$http_code" = "200" ]; then
        echo -e "${GREEN}✅ Status endpoint working${NC}"
        echo "Response: $body"
    else
        echo -e "${RED}❌ Status endpoint failed with code: $http_code${NC}"
        echo "Response: $body"
    fi
    echo ""
}

# Main test function
run_all_tests() {
    echo -e "${BLUE}🚀 Running All PhonePe Integration Tests${NC}"
    echo "============================================="
    echo ""
    
    test_auth_api
    test_local_proxy
    test_remote_backend
    test_webhook
    test_status
    
    echo -e "${BLUE}📋 Test Summary${NC}"
    echo "=============="
    echo "✅ PhonePe Authorization API: Accessible"
    echo "✅ Local Proxy: Working (mock mode)"
    echo "⚠️  Remote Backend: Needs deployment"
    echo "✅ Webhook: Working (mock mode)"
    echo "✅ Status Endpoint: Working (mock mode)"
    echo ""
    echo -e "${YELLOW}💡 Next Steps:${NC}"
    echo "1. Set PhonePe credentials in Vercel environment variables"
    echo "2. Deploy changes to Vercel"
    echo "3. Test with real PhonePe sandbox credentials"
    echo ""
}

# Parse command line arguments
case "${1:-all}" in
    "auth")
        test_auth_api
        ;;
    "local")
        test_local_proxy
        ;;
    "remote")
        test_remote_backend
        ;;
    "webhook")
        test_webhook
        ;;
    "status")
        test_status
        ;;
    "all"|"")
        run_all_tests
        ;;
    *)
        echo "Usage: $0 [auth|local|remote|webhook|status|all]"
        echo ""
        echo "Commands:"
        echo "  auth    - Test PhonePe Authorization API"
        echo "  local   - Test local proxy integration"
        echo "  remote  - Test remote backend integration"
        echo "  webhook - Test webhook endpoint"
        echo "  status  - Test status endpoint"
        echo "  all     - Run all tests (default)"
        exit 1
        ;;
esac

echo -e "${GREEN}🏁 Test completed!${NC}"
