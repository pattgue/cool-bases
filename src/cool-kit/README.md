# Cool Kit

The shared code behind the **Cool Bar**, the options bar that all of Patt's «Cool» plugins share (Cool Bases today; Cool Trip, Cool Markdown, Cool Properties… later). Each plugin carries its own copy: there is no central plugin.

## Adding it to a plugin
1. Copy this folder (`src/cool-kit/`) and `css/cool-kit.css` as they are.
2. Add `css/cool-kit.css` to the CSS that ends up in `styles.css`.
3. In `onload()`, register the plugin's button:

```ts
import { joinCoolKit } from "./cool-kit/kit";

this.bar = joinCoolKit(this, {
  id: this.manifest.id,
  label: () => "Cool Trip",
  appliesTo: leaf => /* does this tab show something of mine? */,
  isOpen: leaf => /* is my panel open in this tab? */,
  toggle: (leaf, anchor) => /* open or close my panel */,
  saveShared: async data => { this.data.coolBar = data; await this.saveData(this.data); },
  loadShared: async () => this.data.coolBar,
});
```

4. Call `this.bar.refresh()` whenever the answer to `appliesTo` or `isOpen` changes (a panel opens or closes, a view appears…).

Nothing else is needed: the kit removes everything it painted when the plugin unloads.

## How the plugins share the bar
- They all use one registry, `window.__coolKit`. Only the **leader** paints the bars: the kit with the highest `KIT_VERSION` (on a tie, the plugin id that comes first alphabetically). When the leader unloads, the next one takes over and repaints.
- Bar settings are saved under `coolBar` in **every** Cool plugin's `data.json`. When the plugins load, the copy with the latest `updatedAt` wins, so the settings travel with whatever sync the vault uses.

## Version rules
- Bump `KIT_VERSION` in `kit.ts` with every change, and update the `[data-ck="…"]` selectors in `cool-kit.css` to the same number. Two kit versions can be loaded at once, and each one only styles its own bars.
- `PROTOCOL` fixes the shape of `window.__coolKit`. Only **add** fields to it; never change or remove one, so old and new kits keep working together.
