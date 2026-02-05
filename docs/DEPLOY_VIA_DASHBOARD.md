# Deploy Edge Function via Supabase Dashboard

## Step 1: Go to Edge Functions

1. Open **Supabase Dashboard**: https://supabase.com/dashboard
2. Select your project
3. Click **Edge Functions** in the left sidebar
4. Click **Create a new function** button

## Step 2: Create the Function

1. **Function name:** `generate-lease-pdf`
2. Click **Create function**

## Step 3: Copy the Function Code

1. Open the file: `/Users/ankitac862/Documents/ANKITA /FProject/Aaralink/Aralink/supabase/functions/generate-lease-pdf/index.ts`
2. **Select ALL the code** (Cmd+A / Ctrl+A)
3. **Copy it** (Cmd+C / Ctrl+C)

## Step 4: Paste into Dashboard

1. In the Dashboard, you'll see a code editor
2. **Delete the default code** (if any)
3. **Paste your copied code** (Cmd+V / Ctrl+V)
4. Click **Deploy** button (top right)

## Step 5: Set Environment Variables (Secrets)

After deploying, set the required secrets:

1. Click on your `generate-lease-pdf` function
2. Go to **Settings** tab
3. Scroll to **Secrets** section
4. Add these secrets:

| Secret Name | Value | Required? |
|-------------|-------|-----------|
| `LEASE_TEMPLATE_URL` | Your template URL from Storage | Optional |
| `SUPABASE_URL` | Auto-set by Supabase | ✅ Auto |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-set by Supabase | ✅ Auto |

**To get your LEASE_TEMPLATE_URL:**
1. Go to **Storage** → `templates` bucket
2. Click on `2229e_standard-lease_static.pdf`
3. Click **Get URL** → Copy the URL
4. Paste it as the value for `LEASE_TEMPLATE_URL`

Example:
```
https://ykfecigqskkddpphbdop.supabase.co/storage/v1/object/public/templates/2229e_standard-lease_static.pdf
```

5. Click **Save**

## Step 6: Repeat for Send Lease Function (Optional)

If you also want to deploy the `send-lease` function:

1. Click **Create a new function**
2. Name: `send-lease`
3. Open: `/Users/ankitac862/Documents/ANKITA /FProject/Aaralink/Aralink/supabase/functions/send-lease/index.ts`
4. Copy all the code
5. Paste into Dashboard editor
6. Click **Deploy**

## Step 7: Test the Function

### Via Dashboard (Quick Test):

1. Click on your `generate-lease-pdf` function
2. Go to **Invoke** tab
3. Paste this test payload:

```json
{
  "leaseId": "test-123",
  "formData": {
    "landlordName": "Test Landlord",
    "tenantNames": ["Test Tenant"],
    "unitAddress": {
      "streetNumber": "123",
      "streetName": "Main St",
      "city": "Toronto",
      "province": "ON",
      "postalCode": "M5V 1A1"
    },
    "landlordNoticeAddress": "123 Main St, Toronto, ON M5V 1A1",
    "allowEmailNotices": true,
    "landlordEmail": "landlord@example.com",
    "emergencyContactPhone": "416-555-0100",
    "tenancyStartDate": "2024-02-01",
    "tenancyType": "month_to_month",
    "paymentFrequency": "monthly",
    "rentPaymentDay": 1,
    "baseRent": 2000,
    "rentPayableTo": "Test Landlord",
    "paymentMethod": "etransfer",
    "isCondo": false,
    "utilities": {
      "electricity": "landlord",
      "heat": "landlord",
      "water": "landlord"
    }
  }
}
```

4. Click **Invoke function**
5. Check the response - should see `"success": true`

### Via Your App (Full Test):

1. Open your app
2. Go to a property
3. Click "Generate Lease"
4. Fill the wizard
5. Click "Generate"
6. ✅ Should work!

## Step 8: View Logs (Troubleshooting)

If something goes wrong:

1. Click on your function
2. Go to **Logs** tab
3. Look for error messages
4. Common issues:
   - Missing secrets
   - Bucket not found → Check storage setup
   - Parse errors → Check JSON syntax
   - Timeout → Function might need optimization

## Advantages of Dashboard Deployment:

✅ No CLI installation needed  
✅ Visual code editor with syntax highlighting  
✅ Easy to view logs and test  
✅ Quick to update and redeploy  
✅ Built-in testing interface  

## Disadvantages:

❌ Need to copy/paste code manually  
❌ No version control integration  
❌ Can't deploy multiple functions at once  
❌ Harder to manage for large projects  

## Tips:

1. **Save your code locally** - Dashboard doesn't automatically save changes
2. **Use the Invoke tab** to test before deploying to production
3. **Check logs frequently** when debugging
4. **Set secrets before deploying** - function might fail without them
5. **Test with small payloads first** before real data

## Alternative: GitHub Integration

Supabase also supports deploying from GitHub:

1. Go to **Edge Functions**
2. Click **Connect to GitHub**
3. Select your repository
4. Supabase will auto-deploy on push

This gives you the best of both worlds: version control + automatic deployment!

## Summary

**Quick Steps:**
1. Dashboard → Edge Functions → Create function
2. Name it `generate-lease-pdf`
3. Copy code from `supabase/functions/generate-lease-pdf/index.ts`
4. Paste into editor
5. Click Deploy
6. Add `LEASE_TEMPLATE_URL` secret (optional)
7. Test via Invoke tab or your app

That's it! Your function is now deployed and ready to use! 🎉
