import { memo } from "react";
import type { Chapter } from "../lib/gloss";
import { chapterNum, type Copy, type Locale } from "../lib/locale";

interface RailProps {
  chapters: Chapter[];
  currentChapterId: string | null;
  noteLocale: Locale;
  copy: Copy;
  onSelect: (chapterId: string) => void;
}

export const Rail = memo(function Rail({
  chapters,
  currentChapterId,
  noteLocale,
  copy,
  onSelect,
}: RailProps) {
  return (
    <nav className="rail" aria-label={copy.chapters}>
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
