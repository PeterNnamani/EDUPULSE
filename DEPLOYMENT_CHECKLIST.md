# Paystack Payment Fix - Deployment Checklist

## Pre-Deployment

### 1. ✓ Code Review
- [x] Edge Function implements Paystack verification correctly
- [x] RLS policies properly restrict access
- [x] Logging captures all failure scenarios
- [x] Retry logic has proper backoff
- [x] Error messages are user-friendly
- [x] Try/catch/finally ensures cleanup

### 2. ✓ Environment Configuration
- [ ] PAYSTACK_SECRET_KEY set in Supabase secrets
  ```
  Supabase Dashboard → Settings → Secrets → Add:
  PAYSTACK_SECRET_KEY=sk_test_b2b96677589473d60b1a57c9b0ed6923973ebe6c
  ```
- [ ] Verify SUPABASE_URL is correct
- [ ] Verify SUPABASE_SERVICE_ROLE_KEY exists

## Deployment Steps

### Step 1: Deploy Database Migrations
```bash
# 1. Go to Supabase Dashboard
# 2. SQL Editor → Create new query
# 3. Copy entire content of:
#    /supabase/migrations/20260531000000_007_enhanced_subscription_policies.sql
# 4. Run query
# 5. Verify: No errors in console
```

**Verify Success**:
```sql
-- In SQL Editor, run this to confirm policies exist:
SELECT * FROM pg_policies WHERE tablename = 'subscriptions';
-- Should show 4 policies: insert, select, update (USING and WITH CHECK)

SELECT * FROM pg_policies WHERE tablename = 'invoices';
-- Should show 4 policies: insert, select, update (USING and WITH CHECK)
```

### Step 2: Create Supabase Secrets

```bash
# Go to Supabase Dashboard
# Settings → Secrets → Add new secret

Name: PAYSTACK_SECRET_KEY
Value: sk_test_b2b96677589473d60b1a57c9b0ed6923973ebe6c
(Use your actual test secret key from Paystack dashboard)
```

**Verify Success**:
- Secret appears in list
- Cannot view value (security feature)

### Step 3: Deploy Edge Function

```bash
# Option A: Via Supabase Dashboard
# 1. Functions → Create new function
# 2. Name: paystack
# 3. Paste entire content of:
#    /supabase/functions/paystack/index.ts
# 4. Deploy

# Option B: Via CLI
# supabase functions deploy paystack

# Option C: Via git push
# Push to repo with functions/paystack/index.ts
# Supabase will auto-deploy
```

**Verify Success**:
```bash
# Test the function (in Supabase Dashboard)
curl -i --request POST 'https://YOUR-PROJECT.supabase.co/functions/v1/paystack' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{
    "reference": "test-ref-12345",
    "schoolId": "550e8400-e29b-41d4-a716-446655440000",
    "email": "test@school.com"
  }'

# Should respond with JSON error (because test reference doesn't exist in Paystack)
# But error should show that Edge Function is working:
# { "success": false, "error": "..." }
```

### Step 4: Update SubscriptionsPage Component

```bash
# 1. Copy updated file:
#    /src/pages/admin/SubscriptionsPage.tsx
# 
# 2. If using git:
#    git add src/pages/admin/SubscriptionsPage.tsx
#    git commit -m "fix: server-side Paystack verification"
#    git push
#
# 3. If manual:
#    Replace entire file content
#    Verify imports are correct
#    Build/test locally
```

### Step 5: Deploy Payment Services

```bash
# Copy new service files:
# - /src/services/paymentLogger.ts
# - /src/services/paymentVerificationService.ts
#
# These should be deployed with SubscriptionsPage
```

## Post-Deployment Testing

### Test 1: Verify Edge Function Works

```bash
# In browser console (logged in as admin):

const testRef = 'TEST-REF-' + Date.now();
const payload = {
  reference: testRef,
  schoolId: 'YOUR_SCHOOL_ID',
  email: 'admin@school.com'
};

const response = await fetch(
  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/paystack`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer YOUR_TOKEN`
    },
    body: JSON.stringify(payload)
  }
);

const data = await response.json();
console.log(data);

// Expected: { success: false, error: "..." } because test reference doesn't exist
// Good: Function is callable and returns JSON
// Bad: 404, 500, or network error
```

### Test 2: Complete Payment Flow

```
1. Login as school admin
2. Go to Subscriptions page
3. Click "Choose Plan" on Starter plan
4. Complete payment with Paystack test card:
   - Card: 4111 1111 1111 1111
   - Exp: Any future date
   - CVV: Any 3 digits
5. Paystack shows success
6. Check browser console for logs:
   - [INFO] Payment successful
   - [INFO] Creating pending subscription
   - [INFO] Verifying with Paystack
   - [INFO] Subscription activated
   - [INFO] Payment complete
7. Success message appears: "✓ Successfully subscribed..."
8. Billing history shows new subscription as 'active'
9. Database check: SELECT * FROM subscriptions WHERE payment_reference = 'YOUR-REF'
   - Should show status='active'
   - Should show plan='starter'
   - Should show amount=15000
10. Check audit_logs for payment trail
```

### Test 3: Error Scenarios

#### Test 3a: Network Error
```
1. Open DevTools → Network tab
2. Check "Throttle" → "Offline"
3. Try payment again
4. Should see retry logic:
   - Attempt 1/3: Call Edge Function
   - Wait 2s
   - Attempt 2/3: Call Edge Function
   - Wait 4s
   - Attempt 3/3: Call Edge Function
5. After all retries fail:
   - Error message shows
   - Reference number shown
   - Button clears
6. Disable offline mode and refresh
   - Subscription should eventually appear as 'pending' or 'active'
```

#### Test 3b: Insufficient Permissions
```
1. Create test staff account (not admin)
2. Login as that staff member
3. Try to access Subscriptions page
4. Should either:
   - Deny access to page, or
   - Show read-only view
5. Cannot create subscription (RLS policy prevents it)
```

#### Test 3c: Cross-Tenant Access
```
1. Create two schools: A and B
2. Admin of school A creates subscription
3. In database, verify:
   - Subscription has school_id = A
   - subscription.payment_reference is set
4. Admin of school B cannot:
   - View school A's subscription
   - Modify it
5. Try to bypass RLS by direct Supabase call:
   - Client cannot access other school's data
   - Edge Function with service role can, but it verifies school_id
```

## Monitoring After Deployment

### Daily Checks (First Week)

```sql
-- Check for payment errors
SELECT COUNT(*) as error_count, 
       MAX(created_at) as last_error
FROM audit_logs
WHERE entity_type = 'subscription_payment'
AND new_values->>'error' IS NOT NULL
AND created_at > now() - interval '1 day';

-- Check for successful payments
SELECT COUNT(*) as success_count,
       MAX(created_at) as last_success
FROM audit_logs
WHERE entity_type = 'subscription_payment'
AND new_values->>'error' IS NULL
AND created_at > now() - interval '1 day';

-- Check for pending subscriptions (payment not verified)
SELECT COUNT(*) as pending_count
FROM subscriptions
WHERE status = 'pending'
AND created_at > now() - interval '1 day';
```

### Weekly Checks

```sql
-- Overall payment success rate
SELECT 
  (SELECT COUNT(*) FROM subscriptions WHERE status='active' AND created_at > now() - interval '7 days') as active_subscriptions,
  (SELECT COUNT(*) FROM subscriptions WHERE status='pending' AND created_at > now() - interval '7 days') as pending_subscriptions,
  (SELECT COUNT(*) FROM subscriptions WHERE created_at > now() - interval '7 days') as total_subscriptions;

-- Check for RLS policy violations
SELECT COUNT(*) as policy_violations
FROM audit_logs
WHERE action LIKE '%permission%'
OR action LIKE '%policy%'
AND created_at > now() - interval '7 days';
```

## Rollback Plan (If Issues)

### Immediate Rollback

```bash
# If critical bug found:

# 1. Revert SubscriptionsPage to old version
git checkout HEAD~1 src/pages/admin/SubscriptionsPage.tsx
git commit -m "revert: payment verification issues"
git push

# 2. Disable Edge Function (temporary)
# Supabase Dashboard → Functions → paystack → Settings → Pause

# 3. Users will fall back to old flow (direct database insert)
# Old behavior resumes but issue persists
```

### Restore Previous RLS Policies

```sql
-- If new policies cause issues, revert to previous:
DROP POLICY IF EXISTS "Subscriptions insert policy" ON subscriptions;
DROP POLICY IF EXISTS "Subscriptions select policy" ON subscriptions;
DROP POLICY IF EXISTS "Subscriptions update policy" ON subscriptions;
DROP POLICY IF EXISTS "Invoices insert policy" ON invoices;
DROP POLICY IF EXISTS "Invoices select policy" ON invoices;
DROP POLICY IF EXISTS "Invoices update policy" ON invoices;

-- Re-apply old permissive policies temporarily:
CREATE POLICY "Subscriptions can be inserted"
  ON subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Subscriptions can be updated"
  ON subscriptions FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ... etc for invoices
```

## Support Documentation

### User Message for Support Team

```
If user reports: "Payment successful but subscription not updating"

Follow these steps:

1. Get payment reference from user (format: SCHOOL-ID-PLAN-TIMESTAMP)
   Example: 550e8400-starter-1706524800000

2. Check subscription status:
   SELECT * FROM subscriptions 
   WHERE payment_reference = 'USER-PROVIDED-REFERENCE'
   LIMIT 1;

3. If status = 'pending':
   - Subscription was created but Paystack verification failed
   - Manually verify with Paystack API:
     curl https://api.paystack.co/transaction/verify/REFERENCE \
       -H "Authorization: Bearer sk_test_..."
   - If Paystack confirms paid: Update subscription to 'active'
   - If Paystack shows unpaid: Inform user

4. If status = 'active':
   - Subscription is already active
   - Refresh browser to see changes

5. If no subscription found:
   - Payment may not have completed
   - Ask user to try again
   - Check Paystack dashboard for transaction

6. If multiple errors:
   - Check audit_logs table for full transaction history
   - Share logs with development team
```

### Payment Reference Format

```
Format: {SCHOOL_UUID}-{PLAN_NAME}-{TIMESTAMP}

Example: 550e8400-e29b-41d4-a716-446655440000-starter-1706524800000

This is stored in:
- subscriptions.payment_reference
- invoices.payment_reference

Paystack reference is returned as:
- response.reference in browser
- paystackResponse.data.reference in Edge Function

Both are the same value.
```

## Verification Checklist (Before Production)

- [ ] All 5 files created/modified
- [ ] PAYSTACK_SECRET_KEY set in Supabase secrets
- [ ] Migration 007 deployed and verified
- [ ] Edge Function deployed and testable
- [ ] SubscriptionsPage updated and builds without errors
- [ ] Payment logger service created
- [ ] Payment verification service created
- [ ] Test payment completes successfully
- [ ] Subscription record has correct status='active'
- [ ] Invoice record created
- [ ] Audit logs show full transaction trail
- [ ] RLS policies tested with multiple schools
- [ ] Error handling works for network failures
- [ ] Retry logic functions correctly
- [ ] Processing button doesn't get stuck
- [ ] All console logs are informative
- [ ] Documentation created for support team

## Deployment Completion

After all steps verified:

```bash
git add .
git commit -m "fix: implement server-side Paystack verification

- Add Edge Function for transaction verification
- Enhance RLS policies for tenant isolation  
- Implement payment logging service
- Add retry logic for failed verifications
- Refactor subscription payment flow

Fixes: Payment completes but subscription not updated"

git push origin main
```

**Deployment Complete** ✓
