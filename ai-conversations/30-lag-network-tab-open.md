## me
scratch that it was because i didnt re run my backend. What i do notice now is when i have my network tab open it lags my actions in my browser a couple seconds, when it's closed it works fine. Should i worry about that?

---
## Cursor
No — don’t worry about it for your app.

With the **Network** tab open, DevTools records every request, WebSocket frame, timing, and often stacks/throttling UI. That extra work on the same page process commonly adds a second or two of lag, especially with STOMP chatter (join, roster, game state, mode changes).

Closed Network tab = normal browser behavior. That’s the signal that matters.

Only dig in if it’s slow **without** DevTools open. For day-to-day testing, leave Network closed unless you’re inspecting a specific request.