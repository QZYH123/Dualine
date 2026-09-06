import { memo } from "react";
import { cjkNumeral, type Chapter } from "../lib/gloss";

interface RailProps {
  chapters: Chapter[];
  currentChapterId: string | null;
  onSelect: (chapterId: string) => void;
}

export const Rail = memo(function Rail({ chapters, currentChapterId, onSelect }: RailProps) {
  return (
    <nav className="rail" aria-label="章节">
      <p className="rail__label">Contents</p>
      <ol className="rail__list">
        {chapters.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              className={"rail__item" + (c.id === currentChapterId ? " is-current" : "")}
              onClick={() => onSelect(c.id)}
            >
              <span className="rail__num">{cjkNumeral(c.index)}</span>
              <span>{c.title}</span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
});
