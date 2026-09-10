import express, { type Request, type Response, type NextFunction } from "express";
import { randomSlug, isValidSlug } from "./slug";
import { normalizeUrl, ValidationError } from "./validate";
import type { Store } from "./store";

export interface ServerOptions {
  store: Store;
  baseUrl: string;
}

const MAX_SLUG_ATTEMPTS = 5;

export function createServer({ store, baseUrl }: ServerOptions) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "4kb" }));

  app.post("/api/shorten", (req, res, next) => {
    try {
      const url = normalizeUrl(req.body?.url);
      const slug = insertWithRetry(store, url);
      res.status(201).json({
        slug,
        shortUrl: `${baseUrl}/${slug}`,
        url,
      });
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/links/:slug/stats", (req, res) => {
    const link = store.get(req.params.slug);
    if (!link) {
      res.status(404).json({ error: "not found" });
      return;
    }
    res.json({
      slug: link.slug,
      url: link.url,
      clicks: link.clicks,
      createdAt: new Date(link.createdAt).toISOString(),
    });
  });

  app.get("/:slug", (req, res) => {
    const { slug } = req.params;
    if (!isValidSlug(slug)) {
      res.status(404).type("text").send("not found");
      return;
    }
    const link = store.get(slug);
    if (!link) {
      res.status(404).type("text").send("not found");
      return;
    }
    store.recordClick(slug);
    res.redirect(302, link.url);
  });

  app.use(errorHandler);
  return app;
}

function insertWithRetry(store: Store, url: string): string {
  for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt++) {
    const slug = randomSlug();
    if (store.insert(slug, url)) {
      return slug;
    }
  }
  throw new Error("could not allocate a unique slug");
}

function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof ValidationError) {
    res.status(400).json({ error: err.message });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "internal error" });
}
