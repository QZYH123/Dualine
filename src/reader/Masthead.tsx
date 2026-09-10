import { memo } from "react";
import { cjkNumeral, type Chapter } from "../lib/gloss";

export function Wordmark({ as = "a" }: { as?: "a" | "p" }) {
  const inner = (
    <>
      Gloss
      <span className="wordmark__seal" aria-hidden="true" />
      <span className="wordmark__cjk">对照</span>
    </>
  );
  if (as === "p") return <p className="wordmark">{inner}</p>;
  return (
    <a className="wordmark" href="/">
      {inner}
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
  onSelectChapter: (chapterId: string) => void;
}

export const Masthead = memo(function Masthead({
  name,
  tagline,
  chapter,
  chapters,
  pinned,
  sample,
  onSelectChapter,
}: MastheadProps) {
  return (
    <header className="masthead">
      <Wordmark />

      <div className="masthead__project">
        <span className="masthead__name">{name}</span>
        {sample && <span className="masthead__chip">示例</span>}
        {tagline && <span className="masthead__tagline">{tagline}</span>}
      </div>

      <div className="masthead__state">
        {pinned && (
          <span className="masthead__pinned">
            已固定 <kbd>Esc</kbd>
          </span>
        )}
        {chapter && (
          <span className="masthead__chapter">
            <em>{cjkNumeral(chapter.index)}</em>
            {chapter.title}
          </span>
        )}
        {chapters.length > 0 && (
          <label className="masthead__jump">
            <span className="visually-hidden">章节</span>
            <select
              value={chapter?.id ?? chapters[0].id}
              onChange={(e) => onSelectChapter(e.target.value)}
            >
              {chapters.map((c) => (
                <option key={c.id} value={c.id}>
                  {cjkNumeral(c.index)} {c.title}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
    </header>
  );
});
