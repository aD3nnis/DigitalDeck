## me
@frontend/components/SessionScreen.tsx:228 the topDiscard card i want to swap with the corresponding card founf in @frontend/public/played-card-spots in the @frontend/public/played-card-spots/discard-pile directory, they should have the same name

---
## Cursor
`topDiscard` is a card id like `"QS"`. Today line 228 uses `<Card>`, which loads the rectangular asset via `cardSrc` → `/card-states/default/default_${cardId}.svg`.

The discard-pile art uses the same filename pattern under a different folder:

`/played-card-spots/discard-pile/default_${topDiscard}.svg`

e.g. `"QS"` → `/played-card-spots/discard-pile/default_QS.svg`

### Swap on line 228

Replace the `Card` with an image pointed at that path:

```tsx
{topDiscard && (
  <img
    src={`/played-card-spots/discard-pile/default_${topDiscard}.svg`}
    alt={topDiscard}
  />
)}
```

Optional helper in `CardAssets.ts` (same idea as `cardSrc`):

```ts
export function discardPileSrc(cardId: string): string {
  return `/played-card-spots/discard-pile/default_${cardId}.svg`;
}
```

Then:

```tsx
{topDiscard && (
  <img src={discardPileSrc(topDiscard)} alt={topDiscard} />
)}
```

### Why not keep `<Card>`?

`Card` always goes through `/card-states/...` and wraps a button. The discard pile isn’t a selectable card — double-click is already on the trapezoid SVG — so a plain `<img>` fits better.

### Sizing note

`.discardBoard` is only **50px** wide, while `.card` in `Card.module.css` is **75px**. The discard SVGs are shaped for that trap (`viewBox="0 0 32.29 21.88"`). Prefer something like `width: 100%` (or a small dedicated class) so they fill the discard board instead of overflowing.

I'm in Ask mode, so I can’t edit the file — switch to Agent mode if you want this applied for you.