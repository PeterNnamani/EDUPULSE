# EduPulse Chatbot Assistant Guide

## Overview

The EduPulse Chatbot is an intelligent floating assistant that helps users manage their account, get answers about features, and perform actions specific to their role. It's visible only after login and persists across navigation until the user logs out.

## Features

### 1. **Role-Based Assistance**
The chatbot provides contextual help based on the user's role:
- **Admin**: Student management, staff management, class management, subscriptions
- **Teacher**: Attendance, grades, assignments, behavior records, reports
- **Principal**: Risk analysis, school reports, interventions, settings
- **Counselor**: Student interventions, risk assessment, recommendations
- **Finance**: Fee management, payments, financial reports
- **Parent**: Child's attendance, grades, assignments, behavior

### 2. **Welcome Message**
After login, users see:
- Animated typing indicator (three bouncing bubbles)
- Personalized welcome message with role-specific help info
- Message auto-disappears after 5 seconds
- Smooth animations using Framer Motion

### 3. **Floating Chat Bubble**
- Fixed position (bottom-right corner)
- Always visible when logged in
- Blue gradient styling
- Hover animations
- Click to open chat interface

### 4. **Chat Interface**
- Clean, modern design
- Message history with timestamps
- User/Assistant message differentiation
- Loading indicator with animated dots
- Input field with send button
- Dark mode support

## Component Structure

### Files Created

```
src/
├── components/Chatbot/
│   ├── ChatBot.tsx           # Main chat bubble and interface
│   ├── WelcomeMessage.tsx    # Welcome message with animations
│   └── index.ts              # Exports
├── services/
│   └── chatService.ts        # Backend integration service
└── types/
    └── index.ts              # ChatMessage type definition
```

## Integration Points

### 1. **Layout Integration**
The chatbot is integrated into `Layout.tsx`:
```tsx
<ChatBot onShowWelcome={() => setShowWelcome(true)} />
<WelcomeMessage 
  isVisible={showWelcome} 
  onDismiss={() => setShowWelcome(false)} 
/>
```

### 2. **Authentication State**
The chatbot:
- Only appears when `isAuthenticated` is `true`
- Hides when user logs out
- Uses user's role and ID for context

### 3. **Zustand State Management**
Uses `useAppStore` for:
- `user` (id, role, name)
- `isAuthenticated`
- `darkMode` support

## How to Extend

### 1. **Integrate with AI Service**

#### Option A: OpenAI Integration
```typescript
// In chatService.ts
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
});

export async function sendChatMessage(
  userMessage: string,
  context: ChatContext
): Promise<ChatResponse> {
  const systemPrompt = `You are an educational assistant for ${context.userRole}s in the EduPulse system...`;
  
  const completion = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ],
  });
  
  return {
    message: completion.choices[0].message.content || ''
  };
}
```

#### Option B: Custom Backend
```typescript
export async function sendChatMessage(
  userMessage: string,
  context: ChatContext
): Promise<ChatResponse> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: userMessage,
      userId: context.userId,
      userRole: context.userRole,
    }),
  });
  
  const data = await response.json();
  return { message: data.response };
}
```

#### Option C: Supabase Edge Functions
```sql
-- Create Edge Function in Supabase
create or replace function chat_with_ai(
  user_message text,
  user_role text
)
returns json
as $$
  // Call your AI API here
  const response = await fetch('https://api.openai.com/...');
  return response.json();
$$ language plpgsql;
```

### 2. **Customize Responses**

Edit `getHelperByRole()` in `chatService.ts`:
```typescript
function getHelperByRole(role: string): string {
  const helpers: Record<string, string> = {
    teacher: `
      • Take attendance
      • Record grades
      • Create assignments
      • Manage behavior records
      • Generate class reports
      • View student risk analysis
    `,
    // Add more roles...
  };
  return helpers[role] || 'General assistance';
}
```

### 3. **Add Chat History**

The service includes `getChatHistory()`:
```typescript
// Show previous messages
const history = await getChatHistory(userId);
setMessages(history);
```

### 4. **Add User Feedback**

Update message structure in database migration:
```typescript
// Users can rate responses as helpful/not helpful
const updateFeedback = await supabase
  .from('chat_logs')
  .update({ helpful: true })
  .eq('id', messageId);
```

## Database Schema

### chat_logs Table
- `id` (UUID): Unique identifier
- `user_id` (UUID): User reference
- `user_role` (TEXT): Role for context
- `user_message` (TEXT): User input
- `assistant_response` (TEXT): AI response
- `message_category` (TEXT): For analytics
- `response_time_ms` (INTEGER): Performance tracking
- `helpful` (BOOLEAN): User feedback
- `created_at` (TIMESTAMP): Message time
- `updated_at` (TIMESTAMP): Last update

### chat_preferences Table
- `id` (UUID): Unique identifier
- `user_id` (UUID): User reference
- `chat_enabled` (BOOLEAN): Enable/disable chat
- `notification_enabled` (BOOLEAN): Chat notifications
- `language` (TEXT): Preferred language
- `theme` (TEXT): UI theme preference

## Security Considerations

### 1. **Row Level Security (RLS)**
- Users can only see their own chat logs
- Implemented in `chat_logs` and `chat_preferences` tables
- Enforced by Supabase auth

### 2. **Data Privacy**
- Chat messages stored in Supabase
- No sensitive data (passwords, keys) in messages
- Users can clear their chat history

### 3. **Rate Limiting**
Add rate limiting to prevent abuse:
```typescript
// Example: Limit to 50 messages per hour
const { data: recentMessages } = await supabase
  .from('chat_logs')
  .select('*', { count: 'exact' })
  .eq('user_id', userId)
  .gte('created_at', oneHourAgo);

if (recentMessages.length > 50) {
  throw new Error('Rate limit exceeded');
}
```

## Styling & Customization

### Colors
- Primary: Blue gradient (`from-blue-600 to-blue-700`)
- Secondary: Gray shades for dark mode
- Borders: Consistent with EduPulse design

### Animations
- Framer Motion for smooth transitions
- Bounce animations for typing indicator
- Scale animations for bubble hover

### Responsive Design
- Fixed position works on mobile
- Adjusted size: 384px (96) width on desktop
- Full height chat interface

## Troubleshooting

### Chat bubble not showing
- Check if user is authenticated: `isAuthenticated === true`
- Verify z-index (z-40) not hidden by other elements
- Check CSS classes applied correctly

### Welcome message not appearing
- Ensure `hasShownWelcome` state managed correctly
- Check animation timing (5 second disappear)
- Verify user role is set in store

### Messages not sending
- Check `user` object has required `id` field
- Verify chat service error handling
- Check browser console for errors
- Test with `sendChatMessage()` directly

### Database issues
- Run migration: `20260528000000_002_chat_logs_schema.sql`
- Verify RLS policies enabled
- Check Supabase connection in `supabase.ts`

## Performance Tips

1. **Lazy load chat service**: Import on demand
2. **Memoize components**: Use `React.memo()` for ChatMessage
3. **Pagination**: Fetch messages in chunks (20 at a time)
4. **Debounce typing**: Avoid excessive API calls while typing

## Future Enhancements

- [ ] Voice input/output support
- [ ] File attachments in chat
- [ ] Multi-language support
- [ ] Advanced NLP for better understanding
- [ ] Integration with calendar (for scheduling)
- [ ] Task creation from chat
- [ ] Chatbot analytics dashboard
- [ ] Custom training on school data
- [ ] WebSocket for real-time updates
- [ ] Chat export/sharing

## Environment Variables

Add to `.env.local`:
```env
VITE_OPENAI_API_KEY=your_api_key_here
VITE_CHAT_BACKEND_URL=http://localhost:3000
VITE_ENABLE_CHAT_HISTORY=true
VITE_CHAT_RATE_LIMIT=50
```

## Support & Maintenance

- Keep AI service integration updated
- Monitor chat analytics for improvements
- Review user feedback regularly
- Update role-specific help content
- Test new features thoroughly

---

**Version**: 1.0.0  
**Last Updated**: May 28, 2026  
**Maintained by**: EduPulse Development Team
