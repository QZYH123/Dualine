import { memo } from "react";
import { cjkNumeral, type Chapter } from "../lib/gloss";

interface MastheadProps {
  name: string;
  tagline: string;
  chapter: Chapter | null;
  pinned: boolean;
}

export const Masthead = memo(function Masthead({ name, tagline, chapter, pinned }: MastheadProps) {
  return (
    <header className="masthead">
      <a className="wordmark" href="/">
        Gloss
        <span className="wordmark__seal" aria-hidden="true" />
        <span className="wordmark__cjk">对照</span>
      </a>

      <div className="masthead__project">
        <span className="masthead__name">{name}</span>
        {tagline && <span className="masthead__tagline">{tagline}</span>}
      </div>

      <div className="masthead__state">
        {pinned && <span>已固定</span>}
        {chapter && (
          <span className="masthead__chapter">
            <em>{cjkNumeral(chapter.index)}</em>
            {chapter.title}
          </span>
        )}
      </div>
    </header>
  );
});
