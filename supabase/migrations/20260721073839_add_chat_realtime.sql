-- Add chat tables to supabase_realtime publication so the client receives insertion events
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_conversations;
