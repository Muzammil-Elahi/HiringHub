-- Messaging system schema

-- Table for storing chat conversations
CREATE TABLE IF NOT EXISTS chats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  hiring_manager_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  job_seeker_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Table for storing individual messages
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  read_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_chats_hiring_manager_id ON chats(hiring_manager_id);
CREATE INDEX IF NOT EXISTS idx_chats_job_seeker_id ON chats(job_seeker_id);
CREATE INDEX IF NOT EXISTS idx_chats_job_id ON chats(job_id);
CREATE INDEX IF NOT EXISTS idx_chats_last_message_at ON chats(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);

-- Set up row-level security policies
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Chat policies
CREATE POLICY chat_insert_policy ON chats 
  FOR INSERT 
  WITH CHECK (hiring_manager_id = auth.uid() OR job_seeker_id = auth.uid());

CREATE POLICY chat_select_policy ON chats 
  FOR SELECT 
  USING (hiring_manager_id = auth.uid() OR job_seeker_id = auth.uid());

CREATE POLICY chat_update_policy ON chats 
  FOR UPDATE 
  USING (hiring_manager_id = auth.uid() OR job_seeker_id = auth.uid());

-- Message policies
CREATE POLICY message_insert_policy ON messages 
  FOR INSERT 
  WITH CHECK (
    sender_id = auth.uid() AND 
    EXISTS (
      SELECT 1 FROM chats 
      WHERE id = chat_id AND (hiring_manager_id = auth.uid() OR job_seeker_id = auth.uid())
    )
  );

CREATE POLICY message_select_policy ON messages 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM chats 
      WHERE id = chat_id AND (hiring_manager_id = auth.uid() OR job_seeker_id = auth.uid())
    )
  );

CREATE POLICY message_update_policy ON messages 
  FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM chats 
      WHERE id = chat_id AND (hiring_manager_id = auth.uid() OR job_seeker_id = auth.uid())
    )
  );