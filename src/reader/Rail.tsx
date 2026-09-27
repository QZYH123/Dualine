import { memo, useEffect, useRef } from "react";
import type { Chapter } from "../lib/gloss";
import { chapterNum, noteHref, type Copy, type Locale } from "../lib/locale";
import type { NoteSummary } from "../lib/notes";

interface RailProps {
  chapters: Chapter[];
  currentChapterId: string | null;
  lastChapterId?: string | null;
  lastNoteId?: string | null;
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
  lastChapterId = null,
  lastNoteId = null,
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
  const railRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail || !currentChapterId) return;
    const railRect = rail.getBoundingClientRect();
    if (railRect.width < 1 || railRect.height < 1) return;
    const el = rail.querySelector<HTMLElement>(".rail__list:not(.rail__notes) .rail__item.is-current");
    if (!el) return;
    const itemRect = el.getBoundingClientRect();
    const pad = 12;
    if (itemRect.top < railRect.top + pad) {
      rail.scrollTop -= railRect.top + pad - itemRect.top;
    } else if (itemRect.bottom > railRect.bottom - pad) {
      rail.scrollTop += itemRect.bottom - (railRect.bottom - pad);
    }
  }, [currentChapterId]);

  return (
    <nav className="rail" ref={railRef} aria-label={copy.chapters}>
      {showNotes && (
        <>
          <p className="rail__label">{copy.notes}</p>
          <ol className="rail__list rail__notes">
            {notes.map((n) => (
              <li key={n.id}>
                {n.id === note ? (
                  <span className="rail__item is-current">
                    {n.title}
                    {lastNoteId === n.id ? <span className="rail__mark">{copy.lastRead}</span> : null}
                  </span>
                ) : (
                  <a className="rail__item" href={noteHref(locale, projectId, n.id, { frozen })}>
                    {n.title}
                    {lastNoteId === n.id ? <span className="rail__mark">{copy.lastRead}</span> : null}
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
              <span>
                {c.title}
                {c.id === lastChapterId ? <span className="rail__mark">{copy.lastRead}</span> : null}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
});
