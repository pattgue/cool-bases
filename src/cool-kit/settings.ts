/* Sección «Cool Bar» de los ajustes: la misma en todos los plugins Cool (cada uno la llama desde su pestaña de ajustes)
   y edita los mismos ajustes, que se guardan en todos. */
import { Setting } from "obsidian";
import { KIT_VERSION, devicePrefs, registry, saveBarSettings, sortedTools, thisDevice } from "./kit";
import type { BarAlign, BarLocation, BarMode, Device, ToolVisibility } from "./kit";
import { kt } from "./i18n";

export function renderCoolBarSettings(containerEl: HTMLElement): void {
  const box = containerEl.createDiv({ cls: "cool-settings", attr: { "data-ck": String(KIT_VERSION) } });
  let device: Device = thisDevice();
  const save = () => { void saveBarSettings(); };

  const draw = () => {
    box.empty();
    new Setting(box).setName(kt("bar")).setHeading();
    /* pestañas Ordenador / Móvil (la tablet usa los de ordenador) */
    const tabs = box.createDiv({ cls: "cool-settings-tabs", attr: { role: "tablist", "aria-label": kt("s.device") } });
    for (const d of ["desktop", "phone"] as Device[]) {
      const b = tabs.createEl("button", { text: kt("s." + d), attr: { type: "button", role: "tab", "aria-selected": String(d === device), "data-device": d } });
      b.addEventListener("click", () => { if (device !== d) { device = d; draw(); } });
    }
    const p = devicePrefs(device);

    new Setting(box).setName(kt("s.location")).addDropdown(dd => dd
      .addOptions({ top: kt("s.top"), bottom: kt("s.bottom"), float: kt("s.float") })
      .setValue(p.location).onChange(v => { p.location = v as BarLocation; save(); }));
    new Setting(box).setName(kt("s.align")).addDropdown(dd => dd
      .addOptions({ left: kt("s.left"), center: kt("s.center"), right: kt("s.right") })
      .setValue(p.align).onChange(v => { p.align = v as BarAlign; save(); }));
    new Setting(box).setName(kt("s.mode")).setDesc(kt("s.modeDesc")).addDropdown(dd => dd
      .addOptions({ fixed: kt("s.fixed"), context: kt("s.context"), hidden: kt("s.hidden") })
      .setValue(p.mode).onChange(v => { p.mode = v as BarMode; registry().toggled = false; save(); }));
    new Setting(box).setName(kt("s.collapsed")).setDesc(kt("s.collapsedDesc")).addToggle(tg => tg
      .setValue(p.collapsed).onChange(v => { p.collapsed = v; save(); }));

    /* cada botón: cuándo se ve y en qué orden */
    new Setting(box).setName(kt("s.buttons")).setHeading();
    const tools = sortedTools(p);
    const move = (i: number, by: number) => {
      const ids = tools.map(t => t.id);
      [ids[i], ids[i + by]] = [ids[i + by], ids[i]];
      ids.forEach((id, k) => { (p.tools[id] ??= {}).order = k * 10; });
      save(); draw();
    };
    tools.forEach((t, i) => {
      new Setting(box).setName(t.label()).setClass("cool-settings-tool")
        .addDropdown(dd => dd
          .addOptions({ always: kt("s.always"), applies: kt("s.applies"), never: kt("s.never") })
          .setValue(p.tools[t.id]?.visibility || "always")
          .onChange(v => { (p.tools[t.id] ??= {}).visibility = v as ToolVisibility; save(); }))
        .addExtraButton(b => b.setIcon("arrow-up").setTooltip(kt("s.up")).setDisabled(i === 0).onClick(() => { if (i > 0) move(i, -1); }))
        .addExtraButton(b => b.setIcon("arrow-down").setTooltip(kt("s.down")).setDisabled(i === tools.length - 1).onClick(() => { if (i < tools.length - 1) move(i, 1); }));
    });
  };
  draw();
}
