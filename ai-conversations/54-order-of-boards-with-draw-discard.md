## me
the discard and draw boards are set up correctly but i need them to be above the 1st players play board on the frontend. this is specifc to a two player game and the order will be different for 3 people plus

---
## Cursor
Right now draw/discard always render **after** the whole `orderedSeats` loop, so they sit under your play board. For 2 players you want them **between** the opponent and you.

### Current order

```
opponent play board
your play board
draw + discard   ← always last among boards
hand
```

That’s because seats are rendered first (lines 165–266), then the draw/discard `<section>` (lines 275–353).

`orderedSeats` already puts you last (bottom), which is correct for a vertical table:

```134:140:frontend/components/SessionScreen.tsx
    const seats = Object.entries(roster); 
    const myIndex = seats.findIndex(([id]) => id === playerId);
    
    const orderedSeats =
    myIndex === -1
      ? seats
      : [...seats.slice(myIndex + 1), ...seats.slice(0, myIndex + 1)];
```

### Target for 2 players

```
opponent play board
draw + discard
your play board
hand
```

### Approach

Extract the draw/discard block into something reusable (a variable or small helper), then **don’t** leave it only after the loop. For 2 players, render it **right before your seat** in the map:

```tsx
const playerCount = seats.length;
const isTwoPlayer = playerCount === 2;

const drawDiscardSection = (
  <section style={{ display: "flex", justifyContent: "center" }}>
    {/* existing drawBoard + discardBoard JSX */}
  </section>
);

{orderedSeats.map(([id, name]) => {
  const isMine = id === playerId;
  return (
    <div key={id}>
      {isTwoPlayer && isMine && drawDiscardSection}
      {/* existing play board for this seat */}
    </div>
  );
})}

{/* 3+ (or non-2) layout: keep current placement, or choose a different slot later */}
{!isTwoPlayer && drawDiscardSection}
```

That gives:

| Players | Vertical order |
|--------|----------------|
| **2** | opponent → draw/discard → you → hand |
| **3+** | all play boards → draw/discard → hand (unchanged for now) |

When you lock in the 3+ table layout, change only the `!isTwoPlayer` branch (e.g. insert after seat index `N`, or between middle opponents).

### Small gotcha

If you put the section inside the seat `<div>`, that wrapper may affect centering. Prefer a sibling fragment or render the section as its own list item between seats so layout stays the same as today’s centered flex row.

I'm in Ask mode, so I can’t apply this — switch to Agent mode if you want it wired in.

---
## me
based on the code you gave me and the code i inputted, what else do i need to add?

---
## Cursor

You’ve got `isTwoPlayer` and the start of `drawDiscardSection`, but three pieces are still missing / wrong.

### 1. Move `drawDiscardSection` out of the JSX

You can’t write `const drawDiscardSection = (...)` in the middle of `return`. Define it **above** `return (` (next to `isTwoPlayer`).

### 2. Render it in the seat loop (2-player)

Inside the map, at the top of the seat `<div>`, before the `<h3>`:

```tsx
{isTwoPlayer && isMine && drawDiscardSection}
```

### 3. Render it for non–2-player games

After the play-areas `</ul>` (where the old draw section lived):

```tsx
{!isTwoPlayer && drawDiscardSection}
```

Without that, 3+ games (and 1-player) won’t show draw/discard at all.

---

**Shape to aim for:**

```tsx
const drawDiscardSection = (
  <section style={{ display: "flex", justifyContent: "center" }}>
    {/* same draw + discard JSX you already have */}
  </section>
);

return (
  <main>
    ...
    <ul className={styles.playAreaUnorderedList}>
      {orderedSeats.map(([id, name]) => {
        const isMine = id === playerId;
        return (
          <div key={id}>
            {isTwoPlayer && isMine && drawDiscardSection}
            <h3>...</h3>
            {/* play board */}
          </div>
        );
      })}
    </ul>

    {!isTwoPlayer && drawDiscardSection}

    {/* hand, leave button, etc. */}
  </main>
);
```

Right now the section is only assigned, never inserted into the tree, and the `const` placement will break the file until you move it above `return`.