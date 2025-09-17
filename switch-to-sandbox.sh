#!/bin/bash

# Switch PhonePe to Sandbox Mode
# Usage: ./switch-to-sandbox.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔄 Switching PhonePe to Sandbox Mode${NC}"
echo "====================================="
echo ""

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo -e "${RED}❌ .env.local file not found${NC}"
    echo "Please run this script from the AI-Memojis-Backend directory"
    exit 1
fi

# Backup current .env.local
cp .env.local .env.local.backup
echo -e "${YELLOW}📋 Backed up current .env.local to .env.local.backup${NC}"

# Update PhonePe configuration to sandbox
echo -e "${YELLOW}🔧 Updating PhonePe configuration...${NC}"

# Update environment to sandbox
sed -i '' 's/PHONEPE_ENVIRONMENT="production"/PHONEPE_ENVIRONMENT="sandbox"/' .env.local

# Update client ID to test credentials
sed -i '' 's/PHONEPE_CLIENT_ID="SU2509131930308486472314"/PHONEPE_CLIENT_ID="TEST-M234QGP8GOGCN_25091"/' .env.local

echo -e "${GREEN}✅ Updated PhonePe configuration to sandbox mode${NC}"
echo ""

# Display current configuration
echo -e "${BLUE}📋 Current PhonePe Configuration:${NC}"
echo "=================================="
grep -E "PHONEPE_" .env.local
echo ""

# Restart backend server
echo -e "${YELLOW}🔄 Restarting backend server...${NC}"

# Find and kill existing local-proxy process
if pgrep -f "node local-proxy" > /dev/null; then
    echo "Stopping existing local-proxy..."
    pkill -f "node local-proxy"
    sleep 2
fi

# Start new local-proxy process
echo "Starting local-proxy with sandbox configuration..."
node local-proxy.js &
sleep 3

# Test if server is running
if curl -s http://localhost:3000/api/health > /dev/null; then
    echo -e "${GREEN}✅ Backend server restarted successfully${NC}"
    echo "Server is running at: http://localhost:3000"
else
    echo -e "${RED}❌ Failed to start backend server${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}🎉 Successfully switched to PhonePe Sandbox Mode!${NC}"
echo ""
echo -e "${BLUE}📋 Next Steps:${NC}"
echo "1. Run: node test-sandbox-payment.js"
echo "2. Open: http://localhost:8080"
echo "3. Test the payment flow"
echo ""
echo -e "${YELLOW}💡 To switch back to production:${NC}"
echo "   cp .env.local.backup .env.local"
echo "   # Then restart the server"
