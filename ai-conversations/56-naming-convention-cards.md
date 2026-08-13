## me
the playing cards on the played board are at the top 8 and bottom 7. I have different images for all 15 cards. How should i ID each card because I want to stick with that pattern when i name the svgs and the folders they are stored in. Currently i have seperated into folders bottom-row and top-row. now i need folders for each of the 15 card placements, what should the naming convention be?

---
## Cursor
Keep `top-row` / `bottom-row`, and ID each placement by **row + left-to-right index** (zero-padded). That matches how you’ll map `playAreas[playerId][i]` in code.

### Recommended layout

```
played-card-spots/
  plyr-bottom-center/
    top-row/
      01/   … 08/     # 8 spots, left → right
    bottom-row/
      01/   … 07/     # 7 spots, left → right
  plyr-top-center/
    top-row/01 … 08
    bottom-row/01 … 07
```

### Why this

| Rule | Reason |
|---|---|
| Keep row folders | You already have them; geometry differs by row |
| `01`–`08` / `01`–`07` (not `1`–`8`) | Sorts correctly; easy string build |
| Count **within the row**, not 01–15 global | Index math stays simple: top = `i`, bottom = `i - 8` |
| Left → right from the **viewer’s** POV for that seat SVG | Same order you’ll use when placing cards in the UI |

### Code mapping

```ts
// play index 0..14
const row = i < 8 ? "top-row" : "bottom-row";
const spot = String((i < 8 ? i : i - 8) + 1).padStart(2, "0"); // "01".."08" or "01".."07"
// → played-card-spots/plyr-bottom-center/{row}/{spot}/...
```

### SVG file names inside each folder

Path already carries seat + row + spot, so keep files short and consistent with `card-states`:

```
…/top-row/03/default_AH.svg
…/top-row/03/suits-selected_AH.svg
```

Or if each folder only holds the warped silhouette (not per-rank art):

```
…/top-row/03/card.svg
```

### Avoid

- Letters only (`a`–`o`) — harder to map from array index  
- Global `slot-01`…`slot-15` under the seat — loses the row split you already want  
- Compass names (`top-left`, `top-mid-left`, …) — brittle once you hit 8 across  

Same pattern later for `plyrs-*-left-right`: seat folder → `top-row`/`bottom-row` → `01`…

---
## me
i think i want to do t01... t08, b01... b07

---
## Cursor
That works well — row is in the ID, so you can even flatten later if you want.

### Folders

```
played-card-spots/plyr-bottom-center/
  t01/ t02/ … t08/
  b01/ b02/ … b07/
```

You can drop the `top-row` / `bottom-row` parents; the `t`/`b` prefix already encodes that.

### Index → folder

```ts
const id = i < 8
  ? `t${String(i + 1).padStart(2, "0")}`      // 0..7  → t01..t08
  : `b${String(i - 7).padStart(2, "0")}`;     // 8..14 → b01..b07
```

Left → right within each row, same as before.