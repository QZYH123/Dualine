import { useEffect, useState } from "react";
import type { HighlighterCore } from "shiki/core";
import { getHighlighter } from "./lib/highlight";
import {
  loadProject,
  requestedProjectId,
  type LoadResult,
} from "./lib/load";
import { noticeCopy, noticeShowsBack } from "./lib/notice";
import { Reader } from "./reader/Reader";
import { Wordmark } from "./reader/Masthead";

export default function App() {
  const [highlighter, setHighlighter] = useState<HighlighterCore | null>(null);
  const [loaded, setLoaded] = useState<LoadResult | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([getHighlighter(), loadProject(requestedProjectId())]).then(([hl, result]) => {
      if (!alive) return;
      setHighlighter(hl);
      setLoaded(result);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (loaded?.kind === "project") document.title = `${loaded.project.name} · Gloss 对照`;
  }, [loaded]);

  if (!highlighter || !loaded) {
    return <div className="loading">对照</div>;
  }

  if (loaded.kind === "project") {
    return (
      <Reader
        project={loaded.project}
        highlighter={highlighter}
        source={loaded.source}
        warnings={loaded.warnings}
        catalogDefault={requestedProjectId() === null}
      />
    );
  }

  return <Notice result={loaded} />;
}

/*
 * The screen when there is nothing to face: the project asked for is not
 * there, the folder is missing or empty, or the API is. Same quiet centre as
 * the loading state — one line of Chinese, one line of mono that says exactly
 * where to look.
 */
function Notice({ result }: { result: Exclude<LoadResult, { kind: "project" }> }) {
  const catalog = "catalog" in result ? result.catalog : undefined;
  const { title, hint, tip } = noticeCopy(result);
  const projects = catalog?.projects ?? [];

  return (
    <div className="loading notice" role="status">
      <div>
        <Wordmark as="p" />
        <p className="notice__title">{title}</p>
        <p className="notice__hint">{hint}</p>
        {tip && <p className="notice__tip">{tip}</p>}
        {projects.length > 0 && result.kind === "not-found" && (
          <ul className="notice__projects">
            {projects.map((p) => (
              <li key={p.id}>
                <a href={`/?project=${encodeURIComponent(p.id)}`}>{p.id}</a>
                {p.tagline ? <span>{p.tagline}</span> : null}
              </li>
            ))}
          </ul>
        )}
        {noticeShowsBack(result.kind) && (
          <a className="notice__back" href="/">
            返回
          </a>
        )}
      </div>
    </div>
  );
}
