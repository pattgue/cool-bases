/* Tipos del modelo «coolbases» (lo que guarda el panel en la vista) y de los datos que pinta la vista. */
import type { BasesEntry } from "obsidian";

/* un color del modelo: «tx» (el del texto), «det» (el de los detalles) o un código #rrggbb[aa] */
export type Tok = string;

export interface CardStyle { w: number; fill: boolean; fmt: string; h: number; pad: number; radius: number; gap: number }
export interface ColStyle { bg: string; grad: boolean; bg2: string; angle: number; text: string; det: string; bw: number; bc: string }
export interface FontStyle { family: string; weight: number; size: number; align: string }
export interface ImgStyle {
  src: string; pos: string; fit: string; frame: number; fx: string; amt: Record<string, number>; duo1: string; duo2: string;
  grain: boolean; bright: number; shade: boolean; shadeC: string; empty: string;
  cvText: string | null; cvColors: string; cvShape: string; cvFont: string;
}
export interface FootStyle { on: boolean; bg: string; lw: number; lc: string; filled?: boolean }
export interface RateStyle {
  on: boolean; prop: string; type: string; place: string; onImg: boolean; mx: number; my: number; color: Tok; size: number;
  empty: boolean; over: number; shape: string; byVal: boolean; fill: string;
}
export interface LinesStyle { on: boolean; n: number; color: Tok; w: number; width: string; pct: number; mt: number; mb: number }
export interface HoverStyle { on: boolean; color: Tok; bg: string; bgOp: number; under: boolean }

/* un estado (Decoraciones): una propiedad sí/no */
export interface State {
  id: string; prop: string; show: string; yes: string; no: string; fmt: string; icon: string; frame: string; bw: number; radius: number;
  pad: number; rot: number; color: Tok; bg: string; font: string | null; upper: boolean; size: number | null; weight: number | null;
  place: string; onImg: boolean; mx: number; my: number;
}
export interface StatesStyle { on: boolean; list: State[] }

/* opciones de cada tipo de dato */
export interface ItemT {
  multi: string; nfmt: string; dec: number; src: string; short: boolean; tagStyle: string; max: number; tsep: string;
  yes: string; no: string; stStyle: string; show: string; fixed: string; arrow: boolean; sort: string; dir: string;
  nlay: string; head: string; headColor: string; more: string;
  tsrc?: string;   // solo el título: "name" (nombre de la nota), "alias" (primer alias), una propiedad o "none"
}
/* un dato de la tarjeta o del pie. La valoración, las líneas y los estados también van en la lista, solo con id y kind (y sid) */
export interface Item {
  id: string; kind: string; prop: string; type: string; sid?: string;
  font: string | null; upper: boolean; color: Tok; size: number | null; weight: number | null; fit: boolean; spaceT: number; spaceB: number;
  ital: boolean; under: boolean; hl: boolean; hlc: string; strike: boolean; sup: boolean; link: string; hover: boolean;
  before: string; after: string; hide: string; join: boolean; sep: string; gap: number; t: ItemT;
  _foot?: boolean;
}
export type TitleStyle = Partial<Item>;

/* el estilo: todo menos los datos (lo que guardan «Mis estilos» y lo que copia «Copiar de otra vista») */
export interface Style {
  card: CardStyle; col: ColStyle; font: FontStyle; img: ImgStyle; foot: FootStyle; rate: RateStyle; lines: LinesStyle; hover: HoverStyle;
  css: string; title: TitleStyle; states?: StatesStyle;
}
export interface Model extends Omit<Style, "title" | "states"> {
  v: number; states: StatesStyle; items: Item[]; fitems: Item[]; title?: TitleStyle;
}

/* ---------- datos de la vista ---------- */
/* un valor ya limpio: nada, un texto o una lista de textos */
export type RecValue = string | string[] | null;
export type Frontmatter = Record<string, unknown>;
export interface Rec { entry?: BasesEntry; path: string; name: string; get(prop: string): RecValue }
export interface LinkedNote { n: string; path: string | null; fm: Frontmatter | null }
export interface Source {
  recs: Rec[];
  displayName(p: string): string;
  imageUrl(rec: Rec, p: string): string | null;
  linkTarget(path: string, from: string): { path: string; fm: Frontmatter } | null;
  backlinks(prop: string, path: string): LinkedNote[];
}
