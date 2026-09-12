import { useCallback, useEffect, useState } from "react";
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
  const [tick, setTick] = useState(0);
  const [stale, setStale] = useState(false);

  useEffect(() => {
    getHighlighter().then(setHighlighter);
  }, []);

  useEffect(() => {
    let alive = true;
    setStale(false);
    loadProject(requestedProjectId()).then((result) => {
      if (!alive) return;
      setLoaded(result);
    });
    return () => {
      alive = false;
    };
  }, [tick]);

  useEffect(() => {
    if (loaded?.kind === "project") document.title = `${loaded.project.name} · Gloss 对照`;
  }, [loaded]);

  useEffect(() => {
    if (loaded?.kind !== "project" || loaded.source !== "api" || !loaded.rev) return;
    const id = loaded.project.id;
    const seen = loaded.rev;
    const iv = window.setInterval(async () => {
      try {
        const res = await fetch(`/api/projects/${encodeURIComponent(id)}/rev`, {
          headers: { accept: "application/json" },
        });
        if (!res.ok) return;
        const body: unknown = await res.json();
        const rev =
          body && typeof body === "object" && typeof (body as { rev?: unknown }).rev === "string"
            ? (body as { rev: string }).rev
            : null;
        if (rev) setStale(rev !== seen);
      } catch {
        /* keep the loaded project; poll is best-effort */
      }
    }, 2500);
    return () => window.clearInterval(iv);
  }, [loaded]);

  const reload = useCallback(() => setTick((n) => n + 1), []);

  if (!highlighter || !loaded) {
    return <div className="loading">对照</div>;
  }

  if (loaded.kind === "project") {
    return (
      <Reader
        key={tick}
        project={loaded.project}
        highlighter={highlighter}
        source={loaded.source}
        warnings={loaded.warnings}
        catalogDefault={requestedProjectId() === null}
        stale={stale}
        onReload={reload}
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
