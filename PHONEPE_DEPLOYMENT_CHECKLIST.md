# 🚀 PhonePe Integration - Deployment Checklist

## ✅ **Completed Tasks**

### **1. Fixed Authorization API Implementation**
- ✅ Updated `checkout.js` with correct Content-Type (`application/x-www-form-urlencoded`)
- ✅ Fixed parameter names (`client_id`, `client_secret`, `grant_type`)
- ✅ Added missing `client_version` parameter
- ✅ Updated to use `access_token` instead of `accessToken`
- ✅ Added comprehensive error logging

### **2. Fixed Payment Creation API**
- ✅ Updated payment payload structure
- ✅ Added required `mobileNumber` field
- ✅ Fixed `merchantId` to use `PHONEPE_CLIENT_ID`
- ✅ Added `X-VERIFY` header
- ✅ Updated redirect URL structure

### **3. Created Test Scripts**
- ✅ `test-phonepe-auth.js` - Tests authorization API directly
- ✅ `test-phonepe-backend.js` - Tests backend integration
- ✅ `PHONEPE_TESTING_GUIDE.md` - Comprehensive testing guide

## 🚀 **Next Steps for Deployment**

### **Step 1: Deploy to Vercel**
```bash
# Commit your changes
git add .
git commit -m "Fix PhonePe integration - correct authorization API format"
git push origin main

# Vercel will automatically deploy
```

### **Step 2: Set Environment Variables in Vercel**
Go to your Vercel dashboard → Project Settings → Environment Variables:

```bash
PHONEPE_CLIENT_ID=your_client_id_from_phonepe_dashboard
PHONEPE_CLIENT_SECRET=your_client_secret_from_phonepe_dashboard
PHONEPE_CLIENT_VERSION=1.0
FRONTEND_URL=https://aimemojis.com
```

### **Step 3: Test Deployment**
```bash
# Test your deployed backend
curl -X POST https://ai-memojis-backend-cbhjztnqu-iamvishal16s-projects.vercel.app/api/phonepe/checkout \
-H "Content-Type: application/json" \
-d '{"userId": "test-user-123", "plan": "monthly"}'
```

## 🧪 **Testing Commands**

### **Test Authorization API:**
```bash
curl --location 'https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token' \
--header 'Content-Type: application/x-www-form-urlencoded' \
--data-urlencode 'client_id=YOUR_CLIENT_ID' \
--data-urlencode 'client_version=1.0' \
--data-urlencode 'client_secret=YOUR_CLIENT_SECRET' \
--data-urlencode 'grant_type=client_credentials'
```

### **Test Backend Integration:**
```bash
node test-phonepe-backend.js
```

## 📊 **Expected Results**

### **Successful Authorization Response:**
```json
{
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expires_at": 1706697605,
    "token_type": "O-Bearer"
}
```

### **Successful Payment Creation Response:**
```json
{
    "ok": true,
    "redirectUrl": "https://mercury-preprod.phonepe.com/transact/...",
    "orderId": "aim-1706073005123-abc123"
}
```

## 🚨 **Common Issues & Solutions**

### **Issue: "PhonePe client credentials missing"**
**Solution:** Set environment variables in Vercel dashboard

### **Issue: "PhonePe auth failed" with 401**
**Solutions:**
- Verify credentials from PhonePe Dashboard
- Check if sandbox environment is enabled
- Ensure no extra spaces in credentials

### **Issue: "No redirect URL from PhonePe"**
**Solutions:**
- Check payment payload structure
- Verify merchantId matches client_id
- Ensure mobileNumber is provided

## 🎯 **Success Criteria**

✅ Authorization API returns access_token  
✅ Payment Creation returns redirectUrl  
✅ Backend Integration works end-to-end  
✅ Webhook receives payment confirmations  

## 📞 **Support Resources**

- **PhonePe Documentation:** https://developer.phonepe.com/payment-gateway/website-integration/standard-checkout/api-integration/api-reference/authorization
- **Vercel Environment Variables:** https://vercel.com/docs/projects/environment-variables
- **Test Scripts:** Use provided test scripts for debugging

## 🔄 **After Successful Testing**

1. **Test with real users** in sandbox mode
2. **Monitor webhook** for payment confirmations
3. **Set up production** credentials when ready
4. **Configure webhook** URL in PhonePe dashboard
5. **Test end-to-end** payment flow

---

**Ready for deployment! 🚀**
