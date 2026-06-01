# 🚀 Quick Start - Deploy & Test in 5 Minutes

## Step 1: Deploy Database (2 minutes)

### Open Supabase SQL Editor
1. Go to your Supabase project dashboard
2. Click "SQL Editor" on the left sidebar
3. Click "New Query"

### Run Migration
1. Copy ALL content from:
   ```
   supabase/migrations/20260601000000_009_notification_alert_intervention_engine.sql
   ```

2. Paste into Supabase SQL Editor

3. Click "Run" button

4. **Check:** No errors in the output

### Verify Tables Created
```sql
-- Run this query to verify
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name LIKE '%notification%';
```

**Should show:**
- notifications
- notification_preferences
- student_alerts
- risk_scores
- intervention_cases
- intervention_activities
- intervention_outcomes
- escalation_tracking
- notification_audit_log

---

## Step 2: Start Application (1 minute)

### Terminal
```bash
cd c:\Users\HYPE_OIU\Documents\EDUPULSE
npm run dev
```

**Expected:** App opens on `http://localhost:5173`

---

## Step 3: Login & Test (2 minutes)

### Login
1. Go to `http://localhost:5173`
2. Login as any user:
   - Email: admin@school.com
   - Or any existing user

### Check Notification System
1. **Look at top-right** header
2. **Find the bell icon** 🔔
3. **Verify:**
   - Bell icon is visible
   - No console errors (F12 → Console)

---

## Step 4: Trigger Test Notification (optional)

### Using Supabase
1. Go to Supabase Dashboard
2. Click "Table Editor"
3. Click "notifications" table
4. Click "Insert row" or "+" button
5. Fill in:
   - **school_id**: Your school ID (from auth.users or schools table)
   - **recipient_id**: Your user ID
   - **recipient_role**: Your role (teacher, parent, etc.)
   - **notification_type**: `attendance_alert`
   - **title**: "Test Notification"
   - **message**: "This is a test!"
   - **priority**: `high`
   - **status**: `unread`
6. Click "Save"

### Verify in App
Within seconds you should see:
- 🔔 **Sound** - Two-tone beep plays
- 🔴 **Badge** - Red circle appears on bell with "1"
- 🎆 **Bubble** - Pop-up appears in top-right with notification
- 📱 **Panel** - Notification shows in dropdown

---

## What Each Feature Does

### 🔔 Bell Icon
- Floats in header
- Shows unread count badge
- Click to open/close panel

### 🔴 Badge Counter
- Red circle with white number
- Shows "99+" if over 99
- Updates in real-time

### 🎆 Notification Bubble
- Pops up when notification arrives
- Shows for 5 seconds then disappears
- Displays title, message, and timestamp

### 📱 Dropdown Panel
- Shows all unread notifications
- Displays priority level
- Allows mark as read / archive
- Click notification to view full details

### 🔊 Sound
- Plays automatically on new notification
- Pleasant ascending two-tone beep
- Volume controlled by system volume

---

## Troubleshooting Quick Fixes

### Sound Not Playing?
```
1. Check system volume is not muted
2. Check browser volume in settings
3. Open DevTools (F12) → Console → check for errors
4. Refresh page and try again
5. Try in a different browser
```

### Badge Not Showing?
```
1. Check notification was created in database
2. Verify recipient_id matches your user ID
3. Refresh page (F5)
4. Check console for errors
5. Verify RLS policies allow access
```

### Bubble Not Appearing?
```
1. Check database notification was inserted
2. Verify real-time subscription is active
3. Check browser console for websocket errors
4. Refresh page
5. Try opening DevTools and closing (sometimes helps)
```

### Notification Not in Panel?
```
1. Click bell icon to open panel
2. If empty, no unread notifications
3. Check status column is 'unread'
4. Verify you're logged in
5. Try marking existing as 'unread' in database
```

---

## Testing Checklist

After deployment, verify:

- [ ] Migration runs without errors
- [ ] All 9 tables appear in Supabase
- [ ] App starts without errors
- [ ] Bell icon appears in header
- [ ] Can insert test notification in database
- [ ] Sound plays when notification arrives
- [ ] Badge appears showing count "1"
- [ ] Bubble pops up in top-right
- [ ] Notification shows in panel when clicking bell
- [ ] Mark as Read button works
- [ ] Archive button works
- [ ] Real-time works (test with 2 browser tabs)
- [ ] Mobile header shows bell icon

---

## Next Steps

### After Basic Testing
1. Test all user types (teacher, parent, admin, counselor)
2. Test with multiple notifications
3. Test with different priority levels
4. Test real-time from another device
5. Test browser notifications on mobile

### Before Going Live
1. Configure email/SMS providers
2. Set up automated triggers
3. Train administrators and counselors
4. Test with real student data
5. Monitor performance
6. Gather user feedback

---

## Example Test Data

### Create Multiple Test Notifications
```sql
-- High priority alert
INSERT INTO notifications (
  school_id, recipient_id, recipient_role, notification_type,
  title, message, priority, status
) VALUES (
  '000000-school-id-here',
  '000000-user-id-here',
  'teacher',
  'attendance_alert',
  'Critical Attendance Issue',
  'John has been absent for 5 consecutive days',
  'critical',
  'unread'
);

-- Medium priority reminder
INSERT INTO notifications (
  school_id, recipient_id, recipient_role, notification_type,
  title, message, priority, status
) VALUES (
  '000000-school-id-here',
  '000000-user-id-here',
  'parent',
  'fee_reminder',
  'Payment Reminder',
  'School fees for this term are due this Friday',
  'medium',
  'unread'
);
```

---

## Performance Tips

- **Test with 10+ notifications** to verify performance
- **Check page load time** - should be < 2 seconds
- **Monitor network** - verify real-time subscriptions use WebSocket
- **Check memory** - DevTools → Performance tab

---

## Security Verification

- [ ] Users can only see their own notifications
- [ ] Cannot modify other users' notifications
- [ ] RLS policies are enforced
- [ ] Audit log records all actions
- [ ] No SQL injection possible
- [ ] No unauthorized data access

---

## Contact

For issues:
1. Check troubleshooting section above
2. Review browser console (F12)
3. Check Supabase logs
4. Verify all files exist in correct locations
5. Ensure database migration completed

---

**Ready to Deploy?** ✅ YES!

Follow these 4 steps and you'll have a fully functional notification system with sounds, badges, and bubbles!

**Estimated Total Time: 5 minutes** ⏱️
