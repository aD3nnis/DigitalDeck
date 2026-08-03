## me
Im starting to get confused on what turn rotation + discard + play mean for the way the cards work, can you add in the UI a short description for each card setup that us dynamic and changes for each different case

---
## Claude AGENT MODE

Done. Create and lobby now show short blurbs under each setting, plus a combined **How this setup works** line.

They update with the combo — e.g. Turn Rotation alone says drawing ends the turn, but with Turn Discard it switches to “discarding ends the turn.” Play copy always notes that playing never ends the turn.

Copy lives in `setupDescriptions.ts` so you can tweak wording in one place.