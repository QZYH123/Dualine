import { memo, type ReactNode } from "react";
import { type Chapter, type GlossDoc, type Inline } from "../lib/gloss";
import { chapterNum, type Copy, type Locale } from "../lib/locale";

interface ProseProps {
  doc: GlossDoc;
  currentPassageId: string | null;
  hoverAnchorId: string | null;
  pinnedAnchorId: string | null;
  locale: Locale;
  copy: Copy;
  onAnchorHover: (id: string | null) => void;
  onAnchorClick: (id: string) => void;
}

export const Prose = memo(function Prose({
  doc,
  currentPassageId,
  hoverAnchorId,
  pinnedAnchorId,
  locale,
  copy,
  onAnchorHover,
  onAnchorClick,
}: ProseProps) {
  return (
    <>
      <header className="title-block">
        <p className="title-block__eyebrow">{copy.eyebrow}</p>
        <h1 className="title-block__title">{doc.title}</h1>
        {doc.lead.length > 0 && (
          <p className="title-block__lead">
            <Inlines inlines={doc.lead} />
          </p>
        )}
      </header>

      {doc.chapters.map((chapter) => (
        <ChapterView
          key={chapter.id}
          chapter={chapter}
          currentPassageId={currentPassageId}
          hoverAnchorId={hoverAnchorId}
          pinnedAnchorId={pinnedAnchorId}
          locale={locale}
          onAnchorHover={onAnchorHover}
          onAnchorClick={onAnchorClick}
        />
      ))}
    </>
  );
});

interface ChapterProps extends Omit<ProseProps, "doc" | "copy"> {
  chapter: Chapter;
}

function ChapterView({
  chapter,
  currentPassageId,
  hoverAnchorId,
  pinnedAnchorId,
  locale,
  onAnchorHover,
  onAnchorClick,
}: ChapterProps) {
  return (
    <section className="chapter" id={chapter.id} data-chapter={chapter.id}>
      <header className="chapter__head">
        <span className="chapter__num">{chapterNum(chapter.index, locale)}</span>
        <h2 className="chapter__title">{chapter.title}</h2>
      </header>
      {chapter.passages.map((p) => (
        <p
          key={p.id}
          className={"passage" + (p.id === currentPassageId ? " is-current" : "")}
          data-passage={p.id}
        >
          <Inlines
            inlines={p.inlines}
            hoverAnchorId={hoverAnchorId}
            pinnedAnchorId={pinnedAnchorId}
            onAnchorHover={onAnchorHover}
            onAnchorClick={onAnchorClick}
          />
        </p>
      ))}
    </section>
  );
}

interface InlinesProps {
  inlines: Inline[];
  hoverAnchorId?: string | null;
  pinnedAnchorId?: string | null;
  onAnchorHover?: (id: string | null) => void;
  onAnchorClick?: (id: string) => void;
}

function Inlines({ inlines, hoverAnchorId, pinnedAnchorId, onAnchorHover, onAnchorClick }: InlinesProps) {
  const nodes: ReactNode[] = inlines.map((x, i) => {
    switch (x.kind) {
      case "text":
        return x.text;
      case "code":
        return <code key={i}>{x.text}</code>;
      case "em":
        return <em key={i}>{x.text}</em>;
      case "strong":
        return <strong key={i}>{x.text}</strong>;
      case "anchor": {
        const cls =
          "anchor" +
          (x.id === hoverAnchorId ? " is-hover" : "") +
          (x.id === pinnedAnchorId ? " is-pinned" : "");
        return (
          <a
            key={i}
            className={cls}
            data-anchor={x.id}
            href="#"
            title={`${x.ref.file} · ${x.ref.start}${x.ref.end !== x.ref.start ? `–${x.ref.end}` : ""}`}
            onMouseEnter={() => onAnchorHover?.(x.id)}
            onMouseLeave={() => onAnchorHover?.(null)}
            onFocus={() => onAnchorHover?.(x.id)}
            onBlur={() => onAnchorHover?.(null)}
            onClick={(e) => {
              e.preventDefault();
              onAnchorClick?.(x.id);
            }}
          >
            <Inlines inlines={x.children} />
          </a>
        );
      }
    }
  });
  return <>{nodes}</>;
}
