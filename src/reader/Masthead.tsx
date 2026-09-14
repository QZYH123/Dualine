import { memo } from "react";
import type { Chapter } from "../lib/gloss";
import {
  COPY,
  chapterNum,
  homeHref,
  jumpValue,
  langHref,
  noteHref,
  parseJumpValue,
  type Copy,
  type Locale,
} from "../lib/locale";
import { DEFAULT_NOTE_ID, type NoteSummary } from "../lib/notes";

export function Wordmark({ as = "a", href = "/" }: { as?: "a" | "p"; href?: string }) {
  const inner = (
    <>
      Dualine
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
  frozen?: boolean;
  locale: Locale;
  noteLocale: Locale;
  note?: string;
  notes?: NoteSummary[];
  projectId?: string;
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
  frozen = false,
  locale,
  noteLocale,
  note = DEFAULT_NOTE_ID,
  notes = [],
  projectId,
  copy,
  onReload,
  onSelectChapter,
}: MastheadProps) {
  const grouped = notes.length > 1;

  const onJump = (value: string) => {
    if (!grouped) {
      onSelectChapter(value);
      return;
    }
    const next = parseJumpValue(value, note);
    if (next.noteId !== note) {
      window.location.assign(
        noteHref(locale, frozen ? null : projectId, next.noteId, {
          chapterId: next.chapterId,
          frozen,
        }),
      );
      return;
    }
    onSelectChapter(next.chapterId);
  };

  return (
    <header className="masthead">
      <div className="masthead__brand">
        <Wordmark href={homeHref(locale, null, frozen)} />
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
              onChange={(e) => onJump(e.target.value)}
            >
              {grouped
                ? notes.map((n) => (
                    <optgroup key={n.id} label={n.title}>
                      {n.chapters.map((c) => (
                        <option key={`${n.id}:${c.id}`} value={jumpValue(n.id, c.id, note)}>
                          {chapterNum(c.index, noteLocale)} {c.title}
                        </option>
                      ))}
                    </optgroup>
                  ))
                : chapters.map((c) => (
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
