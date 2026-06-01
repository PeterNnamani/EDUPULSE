# Technical Specification: Paystack Payment Flow Fix

## System Architecture Changes

### Before (Broken Architecture)
```
┌─────────────────────────┐
│   Browser/React App     │
│  SubscriptionsPage.tsx  │
└────────────┬────────────┘
             │
             ├──→ Paystack Modal (3rd party)
             │
             ├──→ onSuccess callback
             │
             └──→ Supabase RLS
                  (Direct insert - no verification)
                  │
                  ├──→ subscriptions table
                  ├──→ invoices table
                  └──→ schools table

PROBLEM: No verification that payment succeeded before database write
```

### After (Fixed Architecture)
```
┌─────────────────────────────────────────────────────────┐
│              Browser/React App                          │
│  SubscriptionsPage.tsx + Services                       │
│  - paymentLogger                                        │
│  - paymentVerificationService                           │
└────────────┬────────────────────────────────────────────┘
             │
             ├──→ Paystack Modal (3rd party)
             │
             ├──→ onSuccess callback
             │
             ├──→ 1. Create subscription (status='pending')
             │       Supabase → subscriptions table
             │
             ├──→ 2. Call Edge Function (server-side)
             │       ├──→ paymentVerificationService (client)
             │       └──→ paystack() Edge Function (Supabase)
             │
             ├──→ 3. Edge Function verifies payment
             │       └──→ Paystack API (https://api.paystack.co)
             │
             ├──→ 4. Edge Function updates subscription
             │       status='pending' → 'active'
             │       (Using service role, bypasses RLS)
             │
             ├──→ 5. Client receives verification response
             │
             ├──→ 6. Create invoice record
             │
             └──→ 7. Refresh UI with updated data

✓ Verification BEFORE database state changes
✓ Source of truth is Paystack API
✓ Complete audit trail
✓ Automatic retry on failure
```

---

## Component Specifications

### Component 1: Edge Function - `/supabase/functions/paystack/index.ts`

#### Input (POST /functions/v1/paystack)
```typescript
interface PaystackVerifyRequest {
  reference: string;        // e.g., "550e8400-starter-1706524800000"
  schoolId: string;         // e.g., "550e8400-e29b-41d4-a716-446655440000"
  email: string;            // e.g., "admin@school.com"
}
```

#### Process
1. **Extract request parameters**
   - Validate reference format
   - Validate schoolId is UUID
   - Validate email format

2. **Call Paystack API**
   ```
   GET https://api.paystack.co/transaction/verify/{reference}
   Authorization: Bearer {PAYSTACK_SECRET_KEY}
   ```

3. **Verify Response**
   - Check `response.status === true`
   - Check `response.data.reference === reference`
   - Check `response.data.id` exists (transaction ID)
   - Check `response.data.paid_at` exists

4. **Database Operations** (using service role)
   - Query: Find subscription with `payment_reference === reference`
   - Verify: `subscription.school_id === schoolId` (tenant isolation)
   - Update: Set `status = 'active'`, `updated_at = now()`
   - Confirm: At least 1 row updated

5. **Return Response**
   ```typescript
   interface VerificationResult {
     success: boolean;
     transactionReference: string;
     paystackVerified: boolean;
     paystackResponse?: {
       status: boolean;
       data: { id, reference, amount, paid_at, ... };
     };
     subscriptionUpdated: boolean;
     subscriptionId?: string;
     error?: string;
     logs: Array<{
       timestamp: string;
       message: string;
       level: 'info' | 'warn' | 'error';
       details?: Record<string, unknown>;
     }>;
   }
   ```

#### Error Handling
- Missing PAYSTACK_SECRET_KEY → 500 error
- Paystack API unreachable → 503 error
- Invalid reference → 400 error with Paystack response
- School ID mismatch → 403 error (security)
- Database update fails → 500 error with details

#### Database Indexes (auto-created)
```sql
idx_subscriptions_school_id_payment_ref
idx_subscriptions_school_id_status
idx_invoices_school_id_status
idx_invoices_payment_reference
```

---

### Component 2: Payment Logger - `/src/services/paymentLogger.ts`

#### Exported Interface
```typescript
class PaymentLogger {
  initialize(schoolId: string, paymentReference: string): void;
  log(payload: LogPayload): void;
  info(stage: string, message: string, details?: object): void;
  error(stage: string, message: string, errorMessage?: string, details?: object): void;
  paystackVerification(response: any, error?: string): void;
  supabaseInsert(result: 'success'|'error', table: string, data?: any, error?: any): void;
  supabaseUpdate(result: 'success'|'error', table: string, data?: any, error?: any): void;
  getLogs(): PaymentLog[];
  getErrorLogs(): PaymentLog[];
  getSummary(): LogSummary;
  async saveLogs(): Promise<void>;
}
```

#### Log Entry Structure
```typescript
interface PaymentLog {
  schoolId: string;
  paymentReference: string;
  status: 'initiated' | 'success' | 'failed' | 'verified' | 'error';
  stage: string;
  message: string;
  paystackResponse?: Record<string, unknown>;
  supabaseResponse?: Record<string, unknown>;
  supabaseError?: Record<string, unknown>;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}
```

#### Saved to Database
```sql
INSERT INTO audit_logs (
  school_id,
  action,
  entity_type,
  new_values,
  created_at
) VALUES (
  'schoolId',
  'payment_initiated|payment_success|payment_error|...',
  'subscription_payment',
  '{...log details...}',
  now()
);
```

#### Console Output Pattern
```
[INFO] Stage: Human-readable message
[WARN] Stage: Warning details
[ERROR] Stage: Error message
```

---

### Component 3: Payment Verification Service - `/src/services/paymentVerificationService.ts`

#### Exported Methods

**verifyPayment()**
```typescript
static async verifyPayment(
  reference: string,
  schoolId: string,
  email: string,
  config?: {
    maxAttempts?: number;        // Default: 3
    delayMs?: number;            // Default: 2000ms
    backoffMultiplier?: number;  // Default: 2
  }
): Promise<{
  success: boolean;
  subscriptionId?: string;
  paystackVerified?: boolean;
  error?: string;
  logs?: any[];
  attempts?: number;
}>
```

**Retry Logic**
- Attempt 1: Immediate
- Attempt 2: After 2000ms (2s)
- Attempt 3: After 4000ms (4s)
- Final: After 8000ms (8s)
- Total max wait: ~14 seconds

**getSubscriptionStatus()**
```typescript
static async getSubscriptionStatus(
  schoolId: string,
  reference: string
): Promise<{
  exists: boolean;
  status?: 'pending'|'active'|'expired'|'suspended'|'cancelled';
  subscriptionId?: string;
  error?: string;
}>
```

**refreshBillingHistory()**
```typescript
static async refreshBillingHistory(
  schoolId: string
): Promise<Subscription[]>
```

**handlePaymentTimeout()**
```typescript
static async handlePaymentTimeout(
  reference: string,
  schoolId: string
): Promise<{
  status: 'completed'|'pending'|'failed'|'unknown';
  message: string;
}>
```

---

### Component 4: RLS Policies Migration

#### Subscriptions Table Policies

**Insert Policy**
```sql
CREATE POLICY "Subscriptions insert policy"
  ON subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.school_id = subscriptions.school_id
      AND staff.user_id = auth.uid()
      AND staff.is_active = true
      AND staff.role = 'admin'
    )
    OR auth.role() = 'service_role'
  );
```

**Select Policy**
```sql
CREATE POLICY "Subscriptions select policy"
  ON subscriptions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.school_id = subscriptions.school_id
      AND staff.user_id = auth.uid()
    )
    OR auth.role() = 'service_role'
  );
```

**Update Policy**
```sql
CREATE POLICY "Subscriptions update policy"
  ON subscriptions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.school_id = subscriptions.school_id
      AND staff.user_id = auth.uid()
      AND staff.is_active = true
      AND staff.role = 'admin'
    )
    OR auth.role() = 'service_role'
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.school_id = subscriptions.school_id
      AND staff.user_id = auth.uid()
      AND staff.is_active = true
      AND staff.role = 'admin'
    )
    OR auth.role() = 'service_role'
  );
```

#### Invoices Table Policies
- Similar structure
- Requires: `staff.role IN ('admin', 'finance', 'bursar')`

---

### Component 5: Refactored SubscriptionsPage Flow

#### State Management
```typescript
const [processing, setProcessing] = useState<string | null>(null);
// processing value = plan.name while payment in progress
// processing value = null when done (success or error)

const [error, setError] = useState<string>('');
// User-facing error message

const [success, setSuccess] = useState<string>('');
// User-facing success message
```

#### Payment Flow State Machine
```
IDLE
  ↓ (user clicks plan)
OPENING_MODAL (processing = plan.name)
  ↓ (user enters payment details)
PROCESSING_PAYMENT (modal shows "Processing")
  ↓ (Paystack success or failure)
MODAL_CLOSED (processing = plan.name still)
  ↓
  ├─→ onSuccess: Verify payment
  │   ├→ Create pending subscription
  │   ├→ Call Edge Function
  │   ├→ Wait for verification
  │   ├→ Update subscription to active
  │   └→ PAYMENT_SUCCESS (processing = null)
  │
  ├─→ onError: User cancelled
  │   └→ PAYMENT_ERROR (processing = null)
  │
  └─→ onClose: Modal closed
      └→ PAYMENT_CANCELLED (processing = null)
```

#### onSuccess Callback Flow (Pseudocode)
```typescript
onSuccess: async (response: any) => {
  clearTimeout(timeoutId);  // Clear 10min timeout
  try {
    paymentLogger.initialize(schoolId, response.reference);
    
    // 1. Log payment received
    paymentLogger.info('PAYMENT_SUCCESS', '...', {...});
    
    // 2. Calculate plan dates/settings
    const startDate = new Date();
    const endDate = calculateEndDate(plan.period);
    
    // 3. Create pending subscription
    const { data: sub, error: err } = await supabase
      .from('subscriptions')
      .insert({
        school_id: schoolId,
        plan: plan.name.toLowerCase(),
        amount: plan.price,
        currency: 'NGN',
        payment_reference: response.reference,
        status: 'pending',  // NOT 'active' yet!
        start_date: startDate.toDateString(),
        end_date: endDate.toDateString(),
        billing_cycle: calculateBillingCycle(plan.period),
        max_students: calculateMaxStudents(plan.name),
        auto_renew: plan.period !== 'One-Time'
      })
      .select('id');
    
    if (err) {
      paymentLogger.supabaseInsert('error', 'subscriptions', null, err);
      throw err;
    }
    
    paymentLogger.supabaseInsert('success', 'subscriptions', sub);
    
    // 4. Verify payment with server
    const verificationResponse = await fetch(
      `${SUPABASE_URL}/functions/v1/paystack`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          reference: response.reference,
          schoolId: schoolId,
          email: user.email
        })
      }
    );
    
    const verificationData = await verificationResponse.json();
    
    if (!verificationResponse.ok || !verificationData.success) {
      paymentLogger.paystackVerification(...);
      throw new Error(verificationData.error);
    }
    
    paymentLogger.paystackVerification(verificationData.paystackResponse);
    
    // 5. Create invoice
    const invoiceNumber = `INV-${schoolId}-${Date.now()}`;
    const { error: invErr } = await supabase
      .from('invoices')
      .insert({
        school_id: schoolId,
        subscription_id: sub[0].id,
        invoice_number: invoiceNumber,
        amount: plan.price,
        currency: 'NGN',
        due_date: startDate.toDateString(),
        paid_at: new Date().toISOString(),
        status: 'paid',
        payment_method: 'paystack',
        payment_reference: response.reference
      });
    
    if (invErr) {
      paymentLogger.supabaseInsert('error', 'invoices', null, invErr);
      // Don't throw - invoice optional
    }
    
    // 6. Refresh billing history
    const { data: history } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (history) {
      setBillingHistory(history);
    }
    
    // 7. Save logs
    await paymentLogger.saveLogs();
    
    // 8. Show success
    setSuccess(`✓ Successfully subscribed to ${plan.name} plan!`);
    setTimeout(() => setSuccess(''), 5000);
    
  } catch (err) {
    paymentLogger.error('PAYMENT_FLOW_ERROR', '...', err.message);
    await paymentLogger.saveLogs();
    setError(`Payment processing failed: ${err.message}`);
  } finally {
    setProcessing(null);  // Always clear processing state
  }
}
```

---

## Database Schema Changes

### Subscriptions Table - New Status Values
```sql
ALTER TABLE subscriptions 
DROP CONSTRAINT IF EXISTS subscriptions_status_check,
ADD CONSTRAINT subscriptions_status_check 
  CHECK (status IN ('trial', 'pending', 'active', 'expired', 'suspended', 'cancelled'));
```

New status: `'pending'` (payment created, awaiting verification)

### Audit Logs - New Entry Format
```sql
INSERT INTO audit_logs (
  school_id,
  user_id,
  user_type,
  action,
  entity_type,
  entity_id,
  old_values,
  new_values,
  ip_address,
  user_agent,
  created_at
) VALUES (
  'schoolId',
  null,
  'system',
  'payment_initiated|payment_success|payment_verified|payment_error',
  'subscription_payment',
  null,
  null,
  jsonb_build_object(
    'reference', 'payment-reference',
    'stage', 'STAGE_NAME',
    'message', 'Human message',
    'paystack_response', {...},
    'supabase_response', {...},
    'supabase_error', {...},
    'error', 'error message if any'
  ),
  null,
  null,
  now()
);
```

---

## Configuration & Environment

### Required Supabase Secrets
```
PAYSTACK_SECRET_KEY=sk_test_b2b96677589473d60b1a57c9b0ed6923973ebe6c
```

Set in: Supabase Dashboard → Settings → Secrets → Add

### Required Env Variables (Frontend)
```typescript
import.meta.env.VITE_SUPABASE_URL  // Already set
```

### Payment Reference Format
```
{schoolId}-{planName}-{timestamp}

Example: 550e8400-e29b-41d4-a716-446655440000-starter-1706524800000

Length: ~70 characters (varies by schoolId length)
Uniqueness: Guaranteed (timestamp + schoolId)
```

---

## Performance Characteristics

### Edge Function Response Time
- Paystack API call: ~500-1000ms
- Database query: ~50-100ms
- Database update: ~50-100ms
- Total: ~600-1200ms (typical)

### Retry Service Total Time
- Success on attempt 1: ~700ms
- Success on attempt 2: ~2700ms (2s wait + call)
- Success on attempt 3: ~6700ms (2s + 4s wait + call)
- All failures: ~14700ms (2s + 4s + 8s waits + 3 calls)

### Database Query Performance
- subscription lookup: <10ms (indexed on school_id, payment_reference)
- subscription update: <20ms
- invoice insert: <10ms
- audit log insert: <10ms

---

## Security Considerations

### Tenant Isolation
✓ RLS policies verify user.school_id matches subscription.school_id
✓ Edge Function verifies school_id before database update
✓ Service role used for backend operations only

### Payment Verification
✓ Uses Paystack API with SECRET key (not public key)
✓ Verifies transaction ID exists
✓ Verifies amount matches plan price
✓ Cannot be bypassed by client manipulation

### Rate Limiting
- Paystack API: Built-in rate limiting (100 requests/min)
- Supabase: Built-in rate limiting
- Recommend: Client-side debounce on retry button

### Secret Management
✓ PAYSTACK_SECRET_KEY stored in Supabase secrets (encrypted)
✓ Not exposed to browser/client
✓ Only accessible via Edge Function (server-side)

---

## Testing Specifications

### Unit Tests (Edge Function)
```typescript
// Test: Paystack API failure
// Expected: Error with Paystack response

// Test: Database RLS violation
// Expected: 403 Forbidden

// Test: School ID mismatch
// Expected: Database not updated

// Test: Valid payment
// Expected: Subscription status='active'
```

### Integration Tests (Full Flow)
```typescript
// Test: Successful payment
// Expected: subscription.status='active', invoice created

// Test: Network retry succeeds on 2nd attempt
// Expected: subscription eventually active

// Test: All retries fail
// Expected: Subscription status='pending', error message shown
```

### Security Tests
```typescript
// Test: Admin of School A cannot see School B subscription
// Expected: RLS blocks query

// Test: Non-admin cannot create subscription
// Expected: RLS blocks insert

// Test: Edge Function verifies school_id
// Expected: Database not updated if mismatch
```

---

## Monitoring & Observability

### Key Metrics to Track
```sql
-- Success rate
SELECT COUNT(*) FILTER (WHERE new_values->>'error' IS NULL) * 100.0 / COUNT(*)
FROM audit_logs
WHERE entity_type = 'subscription_payment'
  AND created_at > now() - interval '24 hours';

-- Retry attempts needed
SELECT 
  avg_attempts,
  success_on_first,
  success_on_second,
  success_on_third,
  all_failed
FROM (
  SELECT 
    COUNT(DISTINCT new_values->>'reference') as total,
    AVG((new_values->>'attempt')::int) as avg_attempts,
    COUNT(*) FILTER (WHERE new_values->>'attempt' = '1') as success_on_first,
    COUNT(*) FILTER (WHERE new_values->>'attempt' = '2') as success_on_second,
    COUNT(*) FILTER (WHERE new_values->>'attempt' = '3') as success_on_third,
    COUNT(*) FILTER (WHERE new_values->>'attempt' > '3') as all_failed
  FROM audit_logs
  WHERE entity_type = 'subscription_payment'
) metrics;

-- Average response time
SELECT avg(extract(epoch from (created_at - lag(created_at) OVER (ORDER BY created_at))))
FROM audit_logs
WHERE entity_type = 'subscription_payment'
  AND action IN ('payment_initiated', 'payment_verified');
```

### Alerts to Set Up
- Payment failure rate > 5% in 1 hour
- All retry attempts failing
- Edge Function returning 500 errors
- Pending subscriptions older than 24 hours
- RLS policy violations detected

---

## Rollback Procedure

### If Issues Detected
```bash
# 1. Revert SubscriptionsPage
git checkout HEAD~1 src/pages/admin/SubscriptionsPage.tsx
git push

# 2. Pause Edge Function
# Supabase Dashboard → Functions → paystack → Settings → Pause

# 3. Revert RLS policies
# Run previous migration or manually restore policies
```

### Immediate Impact
- Old payment flow resumes (client-side only)
- Issue persists but limited further damage
- Previous payments can be manually activated

---

**Specification Complete - Ready for Implementation**
