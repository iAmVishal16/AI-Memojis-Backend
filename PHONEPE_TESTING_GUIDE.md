# 🧪 PhonePe Integration Testing Guide

## 📋 **Testing Checklist**

### **Step 1: Test Authorization API Directly**

```bash
# Set your credentials
export PHONEPE_CLIENT_ID="your_client_id_here"
export PHONEPE_CLIENT_SECRET="your_client_secret_here"

# Run the test script
node test-phonepe-auth.js
```

**Expected Success Output:**
```
🎉 PhonePe Authorization SUCCESS!
🔑 Access Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
⏰ Expires At: 2024-01-25T10:30:05.000Z
```

### **Step 2: Test Backend Integration**

```bash
# Test your deployed backend
node test-phonepe-backend.js
```

**Expected Success Output:**
```
🎉 Backend Integration SUCCESS!
🔗 Redirect URL: https://mercury-preprod.phonepe.com/transact/...
🆔 Order ID: aim-1706073005123-abc123
```

### **Step 3: Test with cURL Commands**

#### **Test Authorization API:**
```bash
curl --location 'https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token' \
--header 'Content-Type: application/x-www-form-urlencoded' \
--data-urlencode 'client_id=YOUR_CLIENT_ID' \
--data-urlencode 'client_version=1.0' \
--data-urlencode 'client_secret=YOUR_CLIENT_SECRET' \
--data-urlencode 'grant_type=client_credentials'
```

#### **Test Backend Endpoint:**
```bash
curl -X POST https://ai-memojis-backend-cbhjztnqu-iamvishal16s-projects.vercel.app/api/phonepe/checkout \
-H "Content-Type: application/json" \
-d '{"userId": "test-user-123", "plan": "monthly"}'
```

## 🚨 **Common Issues & Solutions**

### **Issue 1: "PhonePe client credentials missing"**
**Solution:** Set environment variables in Vercel dashboard:
- `PHONEPE_CLIENT_ID`
- `PHONEPE_CLIENT_SECRET`
- `PHONEPE_CLIENT_VERSION=1.0`

### **Issue 2: "PhonePe auth failed" with 401**
**Solutions:**
- Verify credentials from PhonePe Dashboard
- Check if sandbox environment is enabled
- Ensure no extra spaces in credentials

### **Issue 3: "No redirect URL from PhonePe"**
**Solutions:**
- Check payment payload structure
- Verify merchantId matches client_id
- Ensure mobileNumber is provided

### **Issue 4: CORS errors**
**Solution:** Backend already has CORS headers configured

## 📊 **Environment Variables Required**

Add these to your Vercel project settings:

```bash
PHONEPE_CLIENT_ID=your_client_id_from_phonepe_dashboard
PHONEPE_CLIENT_SECRET=your_client_secret_from_phonepe_dashboard
PHONEPE_CLIENT_VERSION=1.0
FRONTEND_URL=https://aimemojis.com
```

## 🎯 **Success Criteria**

✅ **Authorization API** returns access_token  
✅ **Payment Creation** returns redirectUrl  
✅ **Backend Integration** works end-to-end  
✅ **Webhook** receives payment confirmations  

## 🔄 **Next Steps After Testing**

1. **Deploy changes** to Vercel
2. **Set environment variables** in Vercel dashboard
3. **Test live integration** with real PhonePe sandbox
4. **Configure webhook** for payment confirmations
5. **Test payment flow** end-to-end

## 📞 **Support**

If you encounter issues:
1. Check PhonePe Dashboard for correct credentials
2. Verify sandbox environment is enabled
3. Check Vercel logs for detailed error messages
4. Test with provided cURL commands first
