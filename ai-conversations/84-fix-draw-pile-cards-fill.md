## me
another small fix i want to do, i see that in draw-pile-cards the cls-3 got filled and that class specifically i dont want to be effected

--- 
## Cursor
Selection styling is almost certainly bleeding into the card art. Only the board rim should change color — not `#draw-pile-cards` / `.cls-3`.

In `draw-pile-board.svg`, `.cls-3` is the white card fills (`#fff`) inside `#draw-pile-cards`. Selection should only recolor the dark rim under `#draw-board` (`.cls-2` / `#143e1b`).

Your current rules in `BoardInteraction.module.css`:

```19:26:frontend/components/BoardInteraction.module.css
  .selected :global(#draw-board) .cls-2,
  .selected :global(#discard-board) .cls-2 {
    fill: #5ac8fa;
  }
  .pileSvg:global(.selected) :global(#draw-board) path:last-of-type,
.pileSvg:global(.selected) :global(#discard-board) path:last-of-type {
  fill: #5ac8fa;
}
```

Two issues:

1. `.cls-2` is **not** wrapped in `:global()`, so CSS Modules hashes it and that rule often never matches the SVG’s real `class="cls-2"`.
2. `path:last-of-type` is easy to get too broad if the `#draw-board` / `#discard-board` part doesn’t compile as you expect — then other paths (including card art) can pick up the blue fill.

**Fix:** one scoped rule, fully globalized class names, cards left alone:

```css
.pileSvg:global(.selected) :global(#draw-board) :global(.cls-2),
.pileSvg:global(.selected) :global(#discard-board) :global(.cls-2) {
  fill: #5ac8fa;
}
```

Drop the `path:last-of-type` rules so nothing under `#draw-pile-cards` can match.

Do **not** add anything like:

```css
.selected :global(.cls-3) { ... }
.selected path { ... }
```

`.cls-3` should keep its SVG def (`fill: #fff`) and never appear in the selection CSS.

I’m in Ask mode, so I can’t edit the file — switch to Agent mode if you want this applied for you.
