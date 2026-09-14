import { memo } from "react";
import type { Chapter } from "../lib/gloss";
import { chapterNum, noteHref, type Copy, type Locale } from "../lib/locale";
import type { NoteSummary } from "../lib/notes";

interface RailProps {
  chapters: Chapter[];
  currentChapterId: string | null;
  locale: Locale;
  noteLocale: Locale;
  note: string;
  notes: NoteSummary[];
  projectId: string;
  frozen?: boolean;
  copy: Copy;
  onSelect: (chapterId: string) => void;
}

export const Rail = memo(function Rail({
  chapters,
  currentChapterId,
  locale,
  noteLocale,
  note,
  notes,
  projectId,
  frozen = false,
  copy,
  onSelect,
}: RailProps) {
  const showNotes = notes.length > 1;

  return (
    <nav className="rail" aria-label={copy.chapters}>
      {showNotes && (
        <>
          <p className="rail__label">{copy.notes}</p>
          <ol className="rail__list rail__notes">
            {notes.map((n) => (
              <li key={n.id}>
                {n.id === note ? (
                  <span className="rail__item is-current">{n.title}</span>
                ) : (
                  <a className="rail__item" href={noteHref(locale, projectId, n.id, { frozen })}>
                    {n.title}
                  </a>
                )}
              </li>
            ))}
          </ol>
          <hr className="rail__rule" />
        </>
      )}
      <p className="rail__label">{copy.rail}</p>
      <ol className="rail__list">
        {chapters.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              className={"rail__item" + (c.id === currentChapterId ? " is-current" : "")}
              onClick={() => onSelect(c.id)}
            >
              <span className="rail__num">{chapterNum(c.index, noteLocale)}</span>
              <span>{c.title}</span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
});
