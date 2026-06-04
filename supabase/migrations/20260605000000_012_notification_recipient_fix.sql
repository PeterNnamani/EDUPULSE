/*
  # Fix notification recipients for staff PIN login

  Staff and parents use table UUIDs (staff.id, parents.id), not auth.users.
  Remove FK to auth.users so in-app notifications can be stored and queried correctly.
*/

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_recipient_id_fkey;
ALTER TABLE notification_preferences DROP CONSTRAINT IF EXISTS notification_preferences_user_id_fkey;

-- Ensure status column is used consistently
UPDATE notifications SET status = 'read' WHERE read_at IS NOT NULL AND status = 'unread';
UPDATE notifications SET status = 'archived' WHERE archived_at IS NOT NULL AND status != 'archived';
