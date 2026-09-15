import express, { type Express } from "express";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

export function mountFrontend(app: Express, directory: string) {
  const root = resolve(directory);
  const index = resolve(root, "index.html");
  if (!existsSync(index)) throw new Error("Frontend build is missing.");
  // API misses must never receive the SPA document or an apparently successful status.
  app.use("/api", (_req, res) => { res.status(404).json({ error: "not_found" }); });
  app.get("/healthz", (_req, res) => { res.json({ status: "alive" }); });
  app.use(express.static(root, { dotfiles: "deny", index: false }));
  app.get("/{*path}", (req, res) => {
    if (req.path.split("/").some(part => part.includes(".")) || !req.accepts("html")) {
      res.status(404).end(); return;
    }
    res.set("Cache-Control", "no-store").sendFile(index);
  });
}
