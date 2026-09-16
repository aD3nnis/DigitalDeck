## me
I want to in the frontend I want to have the name of the player appear and a number for now next to the player so i can see which number the player is (1-6). show me the code for that 

---
## Cursor
You already have `name()` in `GameTable.tsx` — names are only used in image `alt` text today. Seat numbers are the index in `order` (you = bottom = **1**, then clockwise).

### On each seat (table)

In `board()` inside `GameTable.tsx`:

```tsx
const board = (seat: SeatKey) => {
  const file = layout.boards[seat];
  if (!file) return null;
  const cls = SEAT_CLASS[seat];
  const seatNumber = order.indexOf(seat) + 1; // 1–6
  return (
    <div key={seat} className={`${styles.seat} ${styles[cls as keyof typeof styles]}`}>
      <span className={styles.playerLabel}>
        {name(seat, seat)} ({seatNumber})
      </span>
      <img
        className={styles.boardImg}
        src={`${layout.folder}/${file}`}
        alt={`${name(seat, seat)}'s board`}
        draggable={false}
      />
    </div>
  );
};
```

Add a small label style on `.seat` (it’s already `position: relative`) in the relevant `*PlayerTable.module.css` files, e.g.:

```css
.playerLabel {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2;
  white-space: nowrap;
  font-size: 0.85rem;
}
```

### Or under the “Players” heading

In `SessionScreen.tsx`, under `<h2>Players</h2>`:

```tsx
<ul>
  {seatPlayerIds.map((id, i) => (
    <li key={id}>
      {roster[id] ?? id} ({i + 1})
      {id === playerId && " — you"}
    </li>
  ))}
</ul>
```

`seatPlayerIds` is already `[you, …clockwise]`, so `(i + 1)` matches the table seat art (player 1–6).

I'm in Ask mode, so I can't apply this — switch to Agent mode if you want it wired in for you.