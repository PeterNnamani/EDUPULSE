# Chatbot Integration - Quick Start Guide

## ✅ What's Been Implemented

### 1. **Components**
- ✅ `ChatBot.tsx` - Floating chat bubble with chat interface
- ✅ `WelcomeMessage.tsx` - Personalized welcome message with animations
- ✅ `ChatContext.tsx` - Optional context provider for global state (advanced)
- ✅ Smooth animations using Framer Motion
- ✅ Dark mode support
- ✅ Responsive design

### 2. **Services**
- ✅ `chatService.ts` - Backend integration service
- ✅ Role-based contextual responses
- ✅ Ready for AI service integration
- ✅ Chat history support (optional)

### 3. **Database**
- ✅ `chat_logs` table - Store messages for analytics
- ✅ `chat_preferences` table - User chat settings
- ✅ Row-level security (RLS) for data privacy
- ✅ Proper indexing for performance

### 4. **Type Definitions**
- ✅ `ChatMessage` interface in types/index.ts
- ✅ `User.name` field added for personalization

### 5. **Integration**
- ✅ Integrated into `Layout.tsx`
- ✅ Shows only when authenticated
- ✅ Persists across navigation
- ✅ Hides on logout

---

## 🚀 Current Features

### Immediate (No Setup Required)
1. **Floating Chat Bubble** 
   - Bottom-right corner
   - Visible after login
   - Click to open/close
   
2. **Welcome Message**
   - Appears after login
   - 3-dot typing animation
   - Auto-disappears after 5 seconds
   - Role-specific welcome text

3. **Basic Chat Interface**
   - Send/receive messages
   - Message history display
   - Timestamp on each message
   - Loading indicator
   - Dark/light theme support

4. **Role-Based Assistance**
   - Tailored help for each role
   - Admin, Teacher, Principal, Counselor, Finance, Parent

---

## 🔧 Setup Instructions

### Step 1: Update Supabase Database
Run the migration to create chat tables:

```bash
# Option A: Using Supabase CLI
supabase db push

# Option B: Manual - Copy and paste the migration SQL
# File: supabase/migrations/20260528000000_002_chat_logs_schema.sql
# into Supabase SQL Editor
```

### Step 2: Set Environment Variables (Optional)
For AI integration later:
```env
VITE_OPENAI_API_KEY=your_api_key_here
VITE_CHAT_BACKEND_URL=http://localhost:3000
```

### Step 3: Test the Chatbot
1. Start the dev server: `npm run dev`
2. Login to the application
3. See the welcome message appear
4. Click the blue chat bubble
5. Send a test message

---

## 🤖 Integrating AI Services

### Option 1: OpenAI (Recommended)

#### Step 1: Get API Key
- Go to https://platform.openai.com
- Create an API key
- Add to `.env.local`

#### Step 2: Install OpenAI SDK
```bash
npm install openai
```

#### Step 3: Update chatService.ts
```typescript
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
});

export async function sendChatMessage(
  userMessage: string,
  context: ChatContext
): Promise<ChatResponse> {
  const rolePrompts: Record<string, string> = {
    admin: 'You are an educational assistant helping a school administrator manage students, staff, and subscriptions...',
    teacher: 'You are an assistant helping a teacher manage attendance, grades, assignments, and student behavior...',
    // Add for other roles...
  };

  const systemPrompt = rolePrompts[context.userRole] || rolePrompts.teacher;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4-turbo', // or 'gpt-3.5-turbo' for faster/cheaper
    messages: [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: userMessage,
      },
    ],
    temperature: 0.7,
    max_tokens: 500,
  });

  const message = completion.choices[0].message.content || '';

  return {
    message,
    context: {
      model: 'gpt-4-turbo',
      tokensUsed: completion.usage?.total_tokens,
    },
  };
}
```

### Option 2: Custom Backend

#### Step 1: Create Backend Endpoint
```typescript
// Example: Node.js/Express backend
app.post('/api/chat', async (req, res) => {
  const { message, userId, userRole } = req.body;
  
  // Verify user authentication
  const user = await verifyUser(userId);
  
  // Process message and generate response
  const response = await generateResponse(message, userRole);
  
  // Log to database
  await logChatMessage(userId, message, response);
  
  res.json({ response });
});
```

#### Step 2: Update chatService.ts
```typescript
export async function sendChatMessage(
  userMessage: string,
  context: ChatContext
): Promise<ChatResponse> {
  const response = await fetch(
    import.meta.env.VITE_CHAT_BACKEND_URL + '/api/chat',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`, // Add auth token
      },
      body: JSON.stringify({
        message: userMessage,
        userId: context.userId,
        userRole: context.userRole,
      }),
    }
  );

  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || 'Failed to get response');
  }

  return {
    message: data.response,
  };
}
```

### Option 3: Supabase Edge Functions

#### Step 1: Create Edge Function
```bash
supabase functions new chat-handler
```

#### Step 2: Implement Function
```typescript
// supabase/functions/chat-handler/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

serve(async (req) => {
  const { message, userId, userRole } = await req.json();
  
  // Call your AI service here
  const response = await callOpenAI(message, userRole);
  
  return new Response(
    JSON.stringify({ response }),
    { headers: { "Content-Type": "application/json" } }
  );
})
```

---

## 📊 Advanced Features (Optional)

### 1. Enable Chat History
```typescript
// Show previous messages on chat open
import { getChatHistory } from '@/services/chatService';

// In ChatBot component:
useEffect(() => {
  if (isOpen && user) {
    const history = await getChatHistory(user.id);
    setMessages(history);
  }
}, [isOpen, user]);
```

### 2. Add Chat Preferences
```typescript
// Let users customize their chat experience
const { language, theme } = chatPreferences[user.id];

// Store preferences:
await supabase
  .from('chat_preferences')
  .update({ language: 'es', theme: 'dark' })
  .eq('user_id', user.id);
```

### 3. Rate Limiting
```typescript
// Prevent abuse
const canSendMessage = async (userId: string) => {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  
  const { count } = await supabase
    .from('chat_logs')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .gte('created_at', oneHourAgo.toISOString());
  
  return (count || 0) < 100; // Max 100 messages/hour
};
```

### 4. Analytics Dashboard
```typescript
// Track usage
const getChatAnalytics = async () => {
  const { data } = await supabase
    .from('chat_logs')
    .select('user_role, COUNT(*) as message_count')
    .group_by('user_role');
  
  return data;
};
```

---

## 🎨 Customization

### Change Colors
Edit `ChatBot.tsx`:
```tsx
// Change from blue to your brand color
className="bg-gradient-to-br from-blue-600 to-blue-700"
// Change to:
className="bg-gradient-to-br from-purple-600 to-purple-700"
```

### Change Welcome Messages
Edit `WelcomeMessage.tsx`:
```typescript
const messages: Record<string, string> = {
  admin: 'Your custom message here...',
  teacher: 'Your custom message here...',
  // etc.
};
```

### Change Position
Edit `ChatBot.tsx` - change `fixed bottom-6 right-6` to:
- Bottom-left: `bottom-6 left-6`
- Top-right: `top-6 right-6`
- Top-left: `top-6 left-6`

---

## 🧪 Testing

### Manual Testing
1. Login as different roles
2. Verify welcome message shows
3. Verify welcome message disappears after 5 seconds
4. Click chat bubble to open
5. Send test messages
6. Navigate between pages - bubble persists
7. Logout - bubble disappears

### Testing with Console
```javascript
// Check if chat logs are being saved
db.chat_logs.select().limit(10);

// Check user preferences
db.chat_preferences.select().eq('user_id', userId);
```

---

## 🐛 Troubleshooting

### Chat bubble doesn't appear
- Check: `isAuthenticated` in Zustand store
- Verify: Component not hidden by other elements (z-index)
- Test: Open browser DevTools, check styles

### Welcome message doesn't show
- Check: `hasShownWelcome` state in Layout
- Verify: Animation timing (5 seconds)
- Test: Manual trigger with button click

### Messages not saving
- Check: Database migration ran successfully
- Verify: RLS policies enabled on chat_logs table
- Test: Supabase client connection

### AI responses not working
- Check: API key in environment variables
- Verify: Rate limits not exceeded
- Test: API directly in terminal

---

## 📚 Resources

- [Chatbot Implementation Guide](./CHATBOT_GUIDE.md)
- [Database Schema](./supabase/migrations/20260528000000_002_chat_logs_schema.sql)
- [OpenAI API Docs](https://platform.openai.com/docs)
- [Supabase Docs](https://supabase.com/docs)
- [Framer Motion Docs](https://www.framer.com/motion)

---

## 💡 Next Steps

1. ✅ Test chatbot with current basic responses
2. 🔄 Choose AI service (OpenAI, custom backend, etc.)
3. 🔧 Integrate with chosen service
4. 📊 Monitor chat analytics
5. 🚀 Deploy to production
6. 📈 Gather user feedback
7. 🎯 Refine responses based on usage

---

**Status**: ✅ Ready to Use  
**Version**: 1.0.0  
**Last Updated**: May 28, 2026
