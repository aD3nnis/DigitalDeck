## me
after putting this in the terminal: curl -X POST http://localhost:8080/api/sessions/37126f3b-5ef2-4f29-85cf-0717f7ce711b/deck/init
       
it then picks a tab to start and i see that on the frontend. I think maybe this would make sense to turn this request into a button that is like a "start game" button

---
## Claude
Good call — that's exactly the right instinct. Right now that endpoint is only reachable via curl, but conceptually it's a real game action, and "start game" is a much more natural framing than "initialize deck" for whoever's actually playing.

A "Start game" button is really just wiring up the fetch you've already tested manually, plus a decision about who's allowed to click it. Add near your other functions:

```tsx
const startGame = async () => {
  if (!sessionId) return;

  await fetch(`http://localhost:8080/api/sessions/${sessionId}/deck/init`, {
    method: "POST",
  });
};
```

And in your JSX, alongside the leave button:

```tsx
{sessionId && (
  <button onClick={startGame}>Start game</button>
)}
```

That's the mechanical part — but it raises a real design question worth deciding now rather than later: **should anyone in the session be able to start the game, or just the person who created it?** Right now, since every tab in a session can see the same "Start game" button, any player could click it — including someone who joined via code, not just the person who ran `createAndJoin`.

For a casual friend-group game, "anyone can start" is a totally defensible choice — less to build, and among friends it's unlikely to cause real friction. The alternative — restricting it to whoever created the session — means tracking a "host" concept (you already capture who joined first via `playerOrder`, so the first entry in that list is a natural stand-in for "host" without adding new state), and hiding or disabling the button for everyone else.

Given your "keep it simple, it's for fun" scope from earlier, I'd lean toward leaving it open for now — you can always add the host restriction later if it turns out to matter in practice, and it's a small, isolated change when you do (just check `playerId === roster's first joiner` before rendering the button, no backend change needed since nothing currently enforces it server-side either).

Want to leave it open for now and move on to the draw-card button next, or add the host restriction while it's fresh?