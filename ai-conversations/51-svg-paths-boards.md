## me
I need the paths for the different board svgs. This is done in the ul:    {Object.entries(roster).map(([id, name]) function around line 180. I need the same thing done for @frontend/public/board-parts/dealer-boards/discard-board.svg can you give me the code for that to work for the discard pile?

---
## Cursor
Your discard block still uses the **your-play-board** `viewBox`/paths and an `onPlay` handler. Swap that for `discard-board.svg` the same way the play area inlines its paths.

### Paths from `discard-board.svg`

| Piece | Value |
|--------|--------|
| `viewBox` | `0 0 50 77.55` |
| Fill (`cls-2` → `trapFill`) | `M7.04,73.69h36.63c.45,0,.86-.21,1.09-.55.12-.17.29-.53.11-.97l-14.54-36.53c-.18-.45-.66-.76-1.2-.76H7.04c-.7,0-1.27.51-1.27,1.14v36.53c0,.63.57,1.14,1.27,1.14Z` |
| Outline (`cls-1` → `trapStroke`) | `M43.68,76.33c1.32,0,2.55-.64,3.27-1.71.7-1.03.84-2.28.38-3.43l-14.54-36.53c-.58-1.45-2.04-2.42-3.65-2.42H7.04c-2.16,0-3.91,1.69-3.91,3.78v36.53c0,2.08,1.75,3.78,3.91,3.78h36.63ZM5.77,36.02c0-.63.57-1.14,1.27-1.14h22.09c.54,0,1.02.31,1.2.76l14.54,36.53c.18.44,0,.8-.11.97-.23.35-.64.55-1.09.55H7.04c-.7,0-1.27-.51-1.27-1.14v-36.53Z` |

### JSX (replace the discard section ~295–358)

Put the discard double-click on the `<g>`, same pattern as play:

```tsx
{discardMode !== "DISCARD_OFF" && (
  <div className={styles.discardBoard}>
    <svg
      className={styles.yourPlayBoardSvg}
      viewBox="0 0 50 77.55"
      aria-hidden="true"
    >
      <g
        onDoubleClick={async () => {
          if (!canDiscard) return;
          if (playSelected.length > 0) {
            const ok = await onDiscard(selectedPlayCards(), "PLAY");
            if (ok) setPlaySelected([]);
            return;
          }
          if (selected.length === 0) return;
          const ok = await onDiscard(selectedCards(), "HAND");
          if (ok) {
            setSelected([]);
            setPendingCard(null);
          }
        }}
        style={{
          cursor:
            canDiscard && (selected.length > 0 || playSelected.length > 0)
              ? "pointer"
              : undefined,
        }}
      >
        <path
          className={styles.trapFill}
          d="M7.04,73.69h36.63c.45,0,.86-.21,1.09-.55.12-.17.29-.53.11-.97l-14.54-36.53c-.18-.45-.66-.76-1.2-.76H7.04c-.7,0-1.27.51-1.27,1.14v36.53c0,.63.57,1.14,1.27,1.14Z"
        />
        <path
          className={styles.trapStroke}
          d="M43.68,76.33c1.32,0,2.55-.64,3.27-1.71.7-1.03.84-2.28.38-3.43l-14.54-36.53c-.58-1.45-2.04-2.42-3.65-2.42H7.04c-2.16,0-3.91,1.69-3.91,3.78v36.53c0,2.08,1.75,3.78,3.91,3.78h36.63ZM5.77,36.02c0-.63.57-1.14,1.27-1.14h22.09c.54,0,1.02.31,1.2.76l14.54,36.53c.18.44,0,.8-.11.97-.23.35-.64.55-1.09.55H7.04c-.7,0-1.27-.51-1.27-1.14v-36.53Z"
        />
      </g>
    </svg>
    <div className={styles.yourPlayBoardContent}>
      <p>DISCARD PILE:</p>
      {topDiscard && <Card cardId={topDiscard} />}
      {canDiscard && (selected.length > 0 || playSelected.length > 0)
        ? " — double-click to discard & end turn"
        : ""}
    </div>
  </div>
)}
```

### CSS

`.player2BoardTwoPlayerGame` still uses the wide play-board aspect ratio. Add a discard-sized container:

```css
.discardBoard {
  position: relative;
  width: 50px; /* or scale up, e.g. 100px */
  aspect-ratio: 50 / 77.55;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 0.5rem;
  box-sizing: border-box;
  pointer-events: none;
}
```

You can reuse `yourPlayBoardSvg`, `trapFill`, `trapStroke`, and `yourPlayBoardContent`.

**Note:** `discard-board.svg` is tall/narrow (`50 × 77.55`), not the wide trapezoid — so keep `viewBox="0 0 50 77.55"` and that aspect ratio, or the shape will squash.

I'm in Ask mode, so I can't edit the files; switch to Agent mode if you want this applied for you.

---
## me
can you give me the same type of code for the draw pile. that will use the @frontend/public/board-parts/dealer-boards/draw-board.svg 

---
## Cursor

Same pattern as discard — `draw-board.svg` is also `50 × 77.55`, mirrored shape. Wire double-click to `handleDrawDblClick` (what the draw button uses now).

### Paths from `draw-board.svg`

| Piece | Value |
|--------|--------|
| `viewBox` | `0 0 50 77.55` |
| Fill (`cls-2` → `trapFill`) | `M5.53,73.14c.23.35.64.55,1.09.55h36.63c.7,0,1.27-.51,1.27-1.14v-36.53c0-.63-.57-1.14-1.27-1.14h-22.09c-.54,0-1.02.31-1.2.76l-14.54,36.53c-.18.44,0,.8.11.97Z` |
| Outline (`cls-1` → `trapStroke`) | `M6.62,76.33h36.63c2.16,0,3.91-1.69,3.91-3.78v-36.53c0-2.08-1.75-3.78-3.91-3.78h-22.09c-1.61,0-3.07.97-3.65,2.42L2.97,71.19c-.46,1.15-.32,2.4.38,3.43.73,1.07,1.95,1.71,3.27,1.71ZM21.16,34.88h22.09c.7,0,1.27.51,1.27,1.14v36.53c0,.63-.57,1.14-1.27,1.14H6.62c-.45,0-.86-.21-1.09-.55-.12-.17-.29-.53-.11-.97l14.54-36.53c.18-.45.66-.76,1.2-.76Z` |

### JSX (replace the draw button ~241–245)

```tsx
<div className={styles.drawBoard}>
  <svg
    className={styles.yourPlayBoardSvg}
    viewBox="0 0 50 77.55"
    aria-hidden="true"
  >
    <g
      onDoubleClick={handleDrawDblClick}
      style={{
        cursor: canDraw ? "pointer" : undefined,
      }}
    >
      <path
        className={styles.trapFill}
        d="M5.53,73.14c.23.35.64.55,1.09.55h36.63c.7,0,1.27-.51,1.27-1.14v-36.53c0-.63-.57-1.14-1.27-1.14h-22.09c-.54,0-1.02.31-1.2.76l-14.54,36.53c-.18.44,0,.8.11.97Z"
      />
      <path
        className={styles.trapStroke}
        d="M6.62,76.33h36.63c2.16,0,3.91-1.69,3.91-3.78v-36.53c0-2.08-1.75-3.78-3.91-3.78h-22.09c-1.61,0-3.07.97-3.65,2.42L2.97,71.19c-.46,1.15-.32,2.4.38,3.43.73,1.07,1.95,1.71,3.27,1.71ZM21.16,34.88h22.09c.7,0,1.27.51,1.27,1.14v36.53c0,.63-.57,1.14-1.27,1.14H6.62c-.45,0-.86-.21-1.09-.55-.12-.17-.29-.53-.11-.97l14.54-36.53c.18-.45.66-.76,1.2-.76Z"
      />
    </g>
  </svg>
  <div className={styles.yourPlayBoardContent}>
    <p>DRAW PILE:</p>
    <p>{remaining ?? "—"}</p>
    {canDraw ? " — double-click to draw" : ""}
  </div>
</div>
```

If you only want the board clickable when drawing is allowed, wrap the outer div:

```tsx
{canDraw ? (
  <div className={styles.drawBoard}>…</div>
) : (
  /* same markup without onDoubleClick / pointer cursor, or still show it disabled */
  <div className={styles.drawBoard}>…</div>
)}
```

Or keep the board always visible and gate inside the handler (like discard does with `canDiscard`). Update `handleDrawDblClick` to early-return if you move the `canDraw` check off the button:

```tsx
const handleDrawDblClick = async () => {
  if (!canDraw) return;
  const card = await onDraw();
  if (!card) return;
  setPendingCard(card);
};
```

### CSS

Mirror `.discardBoard`:

```css
.drawBoard {
  position: relative;
  width: 50px; /* or scale up, e.g. 100px */
  aspect-ratio: 50 / 77.55;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 0.5rem;
  box-sizing: border-box;
  pointer-events: none;
}
```

Reuse `yourPlayBoardSvg`, `trapFill`, `trapStroke`, and `yourPlayBoardContent` the same way as discard.