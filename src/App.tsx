import { useEffect, useState } from "react";
import type { HighlighterCore } from "shiki/core";
import { getHighlighter } from "./lib/highlight";
import { loadProject } from "./lib/load";
import type { Project } from "./lib/gloss";
import { Reader } from "./reader/Reader";

export default function App() {
  const [highlighter, setHighlighter] = useState<HighlighterCore | null>(null);
  const [project, setProject] = useState<Project | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([getHighlighter(), loadProject("shortly")]).then(([hl, p]) => {
      if (!alive) return;
      setHighlighter(hl);
      setProject(p);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!highlighter || !project) {
    return <div className="loading">对照</div>;
  }
  return <Reader project={project} highlighter={highlighter} />;
}
