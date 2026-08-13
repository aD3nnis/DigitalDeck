## me
all those svgs need to be clickable but i dont want the transparent background to be apart of the clickable surface, should i go about this by converting them to paths when needed? How should i go about this when i place the cards on the frontend? 

--- 
## Cursor
You already solved this for boards. Cards need the same idea — **not** “convert to paths when needed.”

### Why letters/paths aren’t the issue
The warped SVGs already *are* vector paths. The problem is how you mount them:

```29:36:frontend/components/Card.tsx
    <button ...>
      <img className={styles.card} src={src} alt={cardId} />
```

An `<img>` is always a **rectangle**. Transparent pixels still get clicks.

### What to do instead (same pattern as your boards)

Your boards already do the right thing: container `pointer-events: none`, then `pointer-events: fill` on the trapezoid path only (`trapFill` / `trapStroke` in `SessionScreen.module.css`).

For played cards, prefer one of these:

**1. Best fit for your setup: image for paint + silhouette for hits**  
- Show the card with `<img>` (or background), `pointer-events: none`  
- Overlay a tiny SVG with **only** the spot silhouette (`card-frame-inner` / outer from `target-shape-b05.svg`, etc.)  
- `fill: transparent` (or invisible), `pointer-events: fill`, put `onClick` on that path  

Every card in `b05/` shares the same outline, so you need **one hit path per spot**, not per card.

**2. Inline the full card SVG**  
Then:

```css
svg { pointer-events: none; }
.card-frame-inner, .card-frame-outer { pointer-events: fill; }
```

Works, but inlining 54×15 full card SVGs is heavier than option 1.

**3. CSS `clip-path`**  
Can clip hit-testing to a shape, but your silhouettes are Bézier trapezoids — painful to maintain vs reusing the path you already have.

### What I would *not* do
- Convert SVGs to paths “for clickability” — they’re already paths  
- Rely on `<img>` + hoping transparency ignores clicks — it doesn’t  
- Make the rectangular `<button>` the hit target without a shaped overlay  

### Practical frontend layout per spot
```text
position: relative  (pointer-events: none)
  ├─ <img> warped card     (pointer-events: none)
  └─ <svg> hit silhouette  (path with pointer-events: fill + onClick)
```

Reuse each folder’s `target-shape-*.svg` inner path as the hit outline; swap only the `<img>` `src` when the card id changes.

If you want this wired into `Card.tsx` / play-area placement next, switch to Agent mode and we can implement it.
---
## me
ok i will note that i will use the target shape as the overlayed transparent clickable area

--- 
## Cursor
That works well.

Use each spot’s `target-shape-*.svg` **inner** path (`cls-2` / face) as the hit outline — it matches the visible card. Keep the `<img>` for the painted card with `pointer-events: none`, and put `pointer-events: fill` + your click handler on that transparent path.

Same hit path for every card in that spot; only the image `src` changes.

---
## me
ok i added more target shapes in @frontend/public/played-card-spots/plyr-top-center and i want to do the same tansformations for those as we did for @frontend/public/played-card-spots/plyr-bottom-center 

---
## Cursor
Done. All **15** spots under `plyr-top-center` (`b01`–`b07`, `t01`–`t08`) each have **54** warped `default_*.svg` cards. No horizontal flip on the right-side spots.

Same command if you need to re-run:

```bash
python3 scripts/batch_transform_spots.py \
  --spots frontend/public/played-card-spots/plyr-top-center \
  --input frontend/public/card-states/default
```
---
## me
add rotate

---

`--rotate` didn’t exist yet — that was only a suggestion. It’s implemented now, and both side-seat trees were generated with it.

```bash
python3 scripts/batch_transform_spots.py \
  --spots frontend/public/played-card-spots/plyrs-bottom-left-right \
  --input frontend/public/card-states/default \
  --rotate 270
```

Each of the 4 row folders (`top-row` / `bottom-row` under both left-right seats) now has **54** rotated+warped `default_*.svg` cards.

`--rotate` is clockwise (SVG/CSS). If a card looks like it went the wrong way, re-run with `--rotate 90`.