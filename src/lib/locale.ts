/*
 * Chrome language. The wordmark stays Gloss · 对照.
 *
 * Order: ?lang= → gloss frontmatter `locale:` → CJK in the title/lead →
 * the browser → Chinese. Notices have no gloss, so they skip to the browser.
 */
import { cjkNumeral, inlineText, type GlossDoc } from "./gloss.js";

export type Locale = "zh" | "en";

const CJK = /[\u4e00-\u9fff]/;

export function parseLocale(raw: string | undefined | null): Locale | null {
  if (!raw) return null;
  const s = raw.trim().toLowerCase().replace(/_/g, "-");
  if (s === "zh" || s.startsWith("zh-")) return "zh";
  if (s === "en" || s.startsWith("en-")) return "en";
  return null;
}

export function localeFromSearch(search: string): Locale | null {
  return parseLocale(new URLSearchParams(search).get("lang"));
}

export function htmlLang(locale: Locale): string {
  return locale === "zh" ? "zh-CN" : "en";
}

export function chapterNum(n: number, locale: Locale): string {
  return locale === "zh" ? cjkNumeral(n) : String(n);
}

export function hasCjk(text: string): boolean {
  return CJK.test(text);
}

export function glossLocale(
  metaLocale: string | undefined,
  doc: GlossDoc,
): Locale {
  const explicit = parseLocale(metaLocale);
  if (explicit) return explicit;
  return hasCjk(doc.title + inlineText(doc.lead)) ? "zh" : "en";
}

export function chromeLocale(
  search: string,
  gloss?: { locale?: string; doc: GlossDoc },
  navigatorLang?: string,
): Locale {
  return (
    localeFromSearch(search) ??
    (gloss ? glossLocale(gloss.locale, gloss.doc) : null) ??
    parseLocale(navigatorLang) ??
    "zh"
  );
}

export function langHref(
  next: Locale,
  loc: { pathname: string; search: string; hash: string },
): string {
  const p = new URLSearchParams(loc.search);
  p.set("lang", next);
  const q = p.toString();
  return `${loc.pathname}?${q}${loc.hash}`;
}

export function homeHref(
  locale: Locale,
  projectId?: string | null,
  frozen = false,
): string {
  const p = new URLSearchParams();
  p.set("lang", locale);
  if (!frozen && projectId) p.set("project", projectId);
  const q = p.toString();
  return frozen ? `?${q}` : `/?${q}`;
}

export interface Copy {
  loading: string;
  documentTitle: (name: string) => string;
  defaultTitle: string;
  eyebrow: string;
  rail: string;
  chapters: string;
  sample: string;
  stale: string;
  staleTitle: string;
  pinned: string;
  unpin: string;
  code: string;
  backToNote: string;
  lines: (n: number) => string;
  emptyCode: string;
  lineBackTitle: string;
  lineBackAria: (n: number) => string;
  wideWindow: string;
  wideHint: string;
  back: string;
  alsoHere: string;
  warnMany: (n: number) => string;
  warnExpand: string;
  catalogDefault: string;
  notFound: (id: string) => string;
  unreachable: string;
  empty: string;
  notDirectory: string;
  missingDir: string;
  emptyTip: string;
  noDirTip: string;
  windowsTip: string;
  unreachableTip: string;
  otherLang: string;
}

export const COPY: Record<Locale, Copy> = {
  zh: {
    loading: "对照",
    documentTitle: (name) => `${name} · Gloss 对照`,
    defaultTitle: "Gloss · 对照阅读",
    eyebrow: "Gloss · 对照笔记",
    rail: "目录",
    chapters: "章节",
    sample: "示例",
    stale: "已更新",
    staleTitle: "磁盘上的笔记或代码已更新",
    pinned: "已固定",
    unpin: "释放",
    code: "代码",
    backToNote: "回到正文",
    lines: (n) => `${n} 行`,
    emptyCode: "没有可对照的文件",
    lineBackTitle: "回到解释这段代码的正文",
    lineBackAria: (n) => `第 ${n} 行，回到正文`,
    wideWindow: "对照需要更宽的窗口",
    wideHint: "≥ 1100px",
    back: "返回",
    alsoHere: "这个目录里还有",
    warnMany: (n) => `${n} 处锚点无法落到代码`,
    warnExpand: "查看无法落地的锚点",
    catalogDefault: "目录第一项 · 用 ?project=<id> 指定",
    notFound: (id) => `找不到项目 “${id}”`,
    unreachable: "API 未运行，读不到这个项目",
    empty: "这个目录下没有项目",
    notDirectory: "项目路径不是一个目录",
    missingDir: "找不到项目目录",
    emptyTip:
      "每个项目一个子文件夹（小写字母、数字、- 或 _），内含 gloss.md；也可以直接指到那个项目文件夹",
    noDirTip: "把 GLOSS_PROJECTS_DIR 设成文件夹的绝对路径",
    windowsTip: "这是 Windows 路径；请改成当前系统上的绝对路径",
    unreachableTip: "API 起来后再刷新这一页",
    otherLang: "EN",
  },
  en: {
    loading: "Gloss",
    documentTitle: (name) => `${name} · Gloss`,
    defaultTitle: "Gloss · paired reading",
    eyebrow: "Gloss · a paired note",
    rail: "Contents",
    chapters: "Chapters",
    sample: "sample",
    stale: "Updated",
    staleTitle: "The note or code on disk has changed",
    pinned: "Pinned",
    unpin: "to release",
    code: "Code",
    backToNote: "back to the note",
    lines: (n) => `${n} lines`,
    emptyCode: "Nothing to face",
    lineBackTitle: "Back to the note that explains this",
    lineBackAria: (n) => `Line ${n}, back to the note`,
    wideWindow: "This facing-page needs a wider window",
    wideHint: "≥ 1100px",
    back: "Back",
    alsoHere: "Also in this folder",
    warnMany: (n) => `${n} anchors miss the code`,
    warnExpand: "Show anchors that miss",
    catalogDefault: "First in the catalog · use ?project=<id>",
    notFound: (id) => `No project “${id}”`,
    unreachable: "API is not running; this project cannot be read",
    empty: "No projects in this folder",
    notDirectory: "That path is not a folder",
    missingDir: "Cannot find the projects folder",
    emptyTip:
      "One child folder per project (lowercase letters, digits, - or _), with gloss.md — or point at that project folder itself",
    noDirTip: "Set GLOSS_PROJECTS_DIR to the folder's absolute path",
    windowsTip: "This is a Windows path; use an absolute path on this system",
    unreachableTip: "Refresh this page once the API is up",
    otherLang: "中",
  },
};
