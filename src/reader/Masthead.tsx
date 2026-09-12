import { memo } from "react";
import type { Chapter } from "../lib/gloss";
import {
  COPY,
  chapterNum,
  homeHref,
  langHref,
  type Copy,
  type Locale,
} from "../lib/locale";

export function Wordmark({ as = "a", href = "/" }: { as?: "a" | "p"; href?: string }) {
  const inner = (
    <>
      Gloss
      <span className="wordmark__seal" aria-hidden="true" />
      <span className="wordmark__cjk">对照</span>
    </>
  );
  if (as === "p") return <p className="wordmark">{inner}</p>;
  return (
    <a className="wordmark" href={href}>
      {inner}
    </a>
  );
}

export function LangSwitch({ locale }: { locale: Locale }) {
  const next: Locale = locale === "zh" ? "en" : "zh";
  return (
    <a
      className="lang-switch"
      href={langHref(next, window.location)}
      hrefLang={next === "zh" ? "zh-CN" : "en"}
    >
      {COPY[locale].otherLang}
    </a>
  );
}

interface MastheadProps {
  name: string;
  tagline: string;
  chapter: Chapter | null;
  chapters: Chapter[];
  pinned: boolean;
  sample?: boolean;
  stale?: boolean;
  locale: Locale;
  noteLocale: Locale;
  copy: Copy;
  onReload?: () => void;
  onSelectChapter: (chapterId: string) => void;
}

export const Masthead = memo(function Masthead({
  name,
  tagline,
  chapter,
  chapters,
  pinned,
  sample,
  stale,
  locale,
  noteLocale,
  copy,
  onReload,
  onSelectChapter,
}: MastheadProps) {
  return (
    <header className="masthead">
      <div className="masthead__brand">
        <Wordmark href={homeHref(locale)} />
        <LangSwitch locale={locale} />
      </div>

      <div className="masthead__project">
        <span className="masthead__name">{name}</span>
        {sample && <span className="masthead__chip">{copy.sample}</span>}
        {stale && (
          <button
            type="button"
            className="masthead__stale"
            onClick={onReload}
            title={copy.staleTitle}
          >
            {copy.stale}
          </button>
        )}
        {tagline && <span className="masthead__tagline">{tagline}</span>}
      </div>

      <div className="masthead__state">
        {pinned && (
          <span className="masthead__pinned">
            {copy.pinned} <kbd>Esc</kbd>
          </span>
        )}
        {chapter && (
          <span className="masthead__chapter">
            <em>{chapterNum(chapter.index, noteLocale)}</em>
            {chapter.title}
          </span>
        )}
        {chapters.length > 0 && (
          <label className="masthead__jump">
            <span className="visually-hidden">{copy.chapters}</span>
            <select
              value={chapter?.id ?? chapters[0].id}
              onChange={(e) => onSelectChapter(e.target.value)}
            >
              {chapters.map((c) => (
                <option key={c.id} value={c.id}>
                  {chapterNum(c.index, noteLocale)} {c.title}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
    </header>
  );
});
