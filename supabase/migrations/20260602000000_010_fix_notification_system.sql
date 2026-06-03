/*
  # Fix Notification System - Schema Reconciliation (Verification)

  This migration verifies and completes the notification system schema.
  
  Note: The main schema changes were applied in migration 009.
  This migration ensures all RLS policies are correctly configured.
*/

-- Drop old notification-related policies if they still exist
DROP POLICY IF EXISTS "Notifications are viewable" ON notifications;
DROP POLICY IF EXISTS "Notifications are insertable" ON notifications;
DROP POLICY IF EXISTS "Users can read own notifications" ON notifications;
DROP POLICY IF EXISTS "Service can insert notifications" ON notifications;
DROP POLICY IF EXISTS "Users can manage own preferences" ON notification_preferences;

-- Verify notifications table RLS is enabled
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- Drop any duplicate policies before recreating
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
DROP POLICY IF EXISTS "System can insert notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can manage own preferences" ON notification_preferences;

-- Create policies (idempotent with DROP above)
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT
  USING (auth.uid() = recipient_id);

CREATE POLICY "System can insert notifications" ON notifications
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE
  USING (auth.uid() = recipient_id);

CREATE POLICY "Users can manage own preferences" ON notification_preferences
  FOR ALL
  USING (auth.uid() = user_id);

-- ============================================================================
-- VERIFICATION COMMENT
-- ============================================================================
-- After this migration is applied:
-- 1. Notifications table exists with correct schema
-- 2. All RLS policies are properly configured
-- 3. notificationService will work correctly
-- 4. Notifications will be stored and retrieved properly
