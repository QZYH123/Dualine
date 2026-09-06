import { useEffect, useState } from "react";
import type { HighlighterCore } from "shiki/core";
import { getHighlighter } from "./lib/highlight";
import { loadProject, requestedProjectId, type LoadResult } from "./lib/load";
import { Reader } from "./reader/Reader";

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
    return <Reader project={loaded.project} highlighter={highlighter} />;
  }

  return <Notice result={loaded} />;
}

/*
 * The screen when there is nothing to face: the project asked for is not
 * there, or the API is. Same quiet centre as the loading state — one line of
 * Chinese, one line of mono that says exactly where to look.
 */
function Notice({ result }: { result: Exclude<LoadResult, { kind: "project" }> }) {
  let title: string;
  let hint: string;
  switch (result.kind) {
    case "not-found":
      title = `找不到项目 “${result.id}”`;
      hint = `GLOSS_PROJECTS_DIR/${result.id}/gloss.md`;
      break;
    case "unreachable":
      title = "API 未运行，读不到这个项目";
      hint = "npm run dev:all";
      break;
    case "empty":
      title = "这个目录下没有项目";
      hint = "GLOSS_PROJECTS_DIR/<id>/gloss.md";
      break;
  }
  return (
    <div className="loading notice" role="status">
      <div>
        <p className="notice__title">{title}</p>
        <p className="notice__hint">{hint}</p>
        <a className="notice__back" href="/">
          返回
        </a>
      </div>
    </div>
  );
}
