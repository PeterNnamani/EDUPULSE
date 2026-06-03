/*
  # Chat Logs Table for EduPulse Assistant

  1. New Tables
    - `chat_logs` - Stores user messages and AI responses for each user
  
  2. Features
    - Tracks all user-assistant conversations
    - Includes role context for analytics
    - Supports message history retrieval
    - Enables improvement of AI responses
  
  3. Security
    - Enable RLS to restrict users to their own chat logs
    - Staff can only see their own conversations
*/

CREATE TABLE IF NOT EXISTS chat_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL,
  user_id UUID NOT NULL,
  user_role TEXT NOT NULL,
  user_message TEXT NOT NULL,
  assistant_response TEXT NOT NULL,
  message_category TEXT, -- e.g., 'attendance', 'grades', 'general', 'help'
  response_time_ms INTEGER, -- Track performance
  helpful BOOLEAN, -- User feedback on response quality
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE chat_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (idempotent)
DROP POLICY IF EXISTS "users_can_view_own_chat_logs" ON chat_logs;
DROP POLICY IF EXISTS "users_can_insert_own_messages" ON chat_logs;
DROP POLICY IF EXISTS "users_can_update_own_messages" ON chat_logs;

-- Policy: Users can only view their own chat logs
CREATE POLICY "users_can_view_own_chat_logs" ON chat_logs
  FOR SELECT USING (user_id = auth.uid());

-- Policy: Users can insert their own messages
CREATE POLICY "users_can_insert_own_messages" ON chat_logs
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Policy: Users can update their own entries (for helpful feedback)
CREATE POLICY "users_can_update_own_messages" ON chat_logs
  FOR UPDATE USING (user_id = auth.uid());

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_chat_logs_user_id ON chat_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_logs_created_at ON chat_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_logs_user_role ON chat_logs(user_role);

-- Create table for chat preferences (optional)
CREATE TABLE IF NOT EXISTS chat_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE,
  school_id UUID NOT NULL,
  chat_enabled BOOLEAN DEFAULT TRUE,
  notification_enabled BOOLEAN DEFAULT TRUE,
  language TEXT DEFAULT 'en',
  theme TEXT DEFAULT 'default',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Enable RLS on preferences
ALTER TABLE chat_preferences ENABLE ROW LEVEL SECURITY;

-- Drop existing preferences policies if they exist (idempotent)
DROP POLICY IF EXISTS "users_can_view_own_preferences" ON chat_preferences;
DROP POLICY IF EXISTS "users_can_update_own_preferences" ON chat_preferences;
DROP POLICY IF EXISTS "users_can_insert_own_preferences" ON chat_preferences;

-- Policy: Users can only view their own preferences
CREATE POLICY "users_can_view_own_preferences" ON chat_preferences
  FOR SELECT USING (user_id = auth.uid());

-- Policy: Users can update their own preferences
CREATE POLICY "users_can_update_own_preferences" ON chat_preferences
  FOR UPDATE USING (user_id = auth.uid());

-- Policy: Users can insert their own preferences
CREATE POLICY "users_can_insert_own_preferences" ON chat_preferences
  FOR INSERT WITH CHECK (user_id = auth.uid());
