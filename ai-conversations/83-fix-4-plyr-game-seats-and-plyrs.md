## me
I just noticed my 4 player set up is not correct with which players on in which seats. Currently it is bottom: ply1, left: ply3, top: ply2, and right: ply4 when it should be ply1, left: ply2, top: ply3, and right: ply4. All of 3's of player games is correct

--- 
## Cursor
The 4-player seat map is wrong in one place; 3-player is already set the way you want.

In `tableLayouts.ts`, `ABSOLUTE` assigns each turn-order index a fixed table seat before rotation:

```24:31:frontend/components/tableLayouts.ts
export const ABSOLUTE: Record<number, SeatKey[]> = {
  1: ["bottom"],
  2: ["bottom", "top"],
  3: ["bottom", "right", "left"],          // your 3p preference
  4: ["bottom", "top", "left", "right"],   // P3/P4 swap
  5: ["bottom", "left", "topLeft", "topRight", "right"],
  6: ["bottom", "left", "topLeft", "top", "topRight", "right"],
};
```

For 4 players that means:

| Turn index | Player | Current seat | What you want |
|---|---|---|---|
| 0 | ply1 | bottom | bottom |
| 1 | ply2 | **top** | **left** |
| 2 | ply3 | **left** | **top** |
| 3 | ply4 | right | right |

That’s why you see bottom:1, left:3, top:2, right:4 — ply2 and ply3 are swapped vs clockwise seating.

`RING[4]` is already the layout you want:

```14:21:frontend/components/tableLayouts.ts
export const RING: Record<number, SeatKey[]> = {
  ...
  4: ["bottom", "left", "top", "right"],
  ...
};
```

**Fix:** change `ABSOLUTE[4]` to match that clockwise order:

```ts
4: ["bottom", "left", "top", "right"],
```

Leave `ABSOLUTE[3]` alone (`["bottom", "right", "left"]`) — that’s why 3-player looks correct. Also leave `LAYOUTS[4].boards` alone; those SVGs are already labeled left=2 / top=3 / right=4 and only the player→seat mapping is wrong.

I’m in Ask mode, so I can’t edit it here — switch to Agent mode if you want me to apply the one-line change.

--- 
## me
i changed absolute to this: 4: ["bottom", "left", "top", "right"], but my 3 player game was broken and i changed it to this: 3: ["bottom", "left", "right"],   and now its fixed at all levels

--- 
## Cursor
That lines both configs up with clockwise seating, which is why it feels consistent now.

| Players | `ABSOLUTE` | Screen seats (as ply1) |
|---|---|---|
| 3 | `["bottom", "left", "right"]` | you → left = 2 → right = 3 |
| 4 | `["bottom", "left", "top", "right"]` | you → left = 2 → top = 3 → right = 4 |

Those match `RING` for 3 and 4, so rotation for every viewer stays a real walk around the table.

One note: changing `ABSOLUTE[4]` does not affect 3-player games — `screenPlayersBySeat` picks the array by player count. If 3-player looked wrong after the 4-player edit, it was almost certainly the old `["bottom", "right", "left"]` preference (next player on the right) conflicting with what you want now, not the 4-player line leaking into 3-player.

You’re in good shape with both set this way.

