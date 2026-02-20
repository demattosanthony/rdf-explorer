#!/usr/bin/env bun

import { existsSync } from "fs";
import { resolve } from "path";
import { exec } from "child_process";

const filePath = process.argv[2];

if (!filePath) {
  console.error("Usage: rdf-explorer <file.ttl>");
  process.exit(1);
}

const resolved = resolve(filePath);

if (!existsSync(resolved)) {
  console.error(`File not found: ${resolved}`);
  process.exit(1);
}

if (!resolved.endsWith(".ttl")) {
  console.error("File must be a .ttl (Turtle RDF) file");
  process.exit(1);
}

process.env.RDF_FILE_PATH = resolved;

const { startServer } = await import("../server/index.js");

const preferredPort = parseInt(process.env.PORT || "3000", 10);
const server = await startServer(preferredPort);

// Open browser (macOS: open, Linux: xdg-open)
const openCmd = process.platform === "darwin" ? "open" : "xdg-open";
exec(`${openCmd} http://localhost:${server.port}`);
