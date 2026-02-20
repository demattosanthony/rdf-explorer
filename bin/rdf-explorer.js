#!/usr/bin/env bun

import { existsSync, writeFileSync, mkdtempSync } from "fs";
import { resolve, join } from "path";
import { tmpdir } from "os";
import { exec } from "child_process";

const input = process.argv[2];

if (!input) {
  console.error("Usage: rdf-explorer <file.ttl | URL>");
  process.exit(1);
}

const isURL = input.startsWith("http://") || input.startsWith("https://");

let filePath;

if (isURL) {
  console.log(`Fetching ${input} …`);
  const res = await fetch(input);
  if (!res.ok) {
    console.error(`Failed to fetch: ${res.status} ${res.statusText}`);
    process.exit(1);
  }
  const body = await res.text();
  const tmp = mkdtempSync(join(tmpdir(), "rdf-explorer-"));
  filePath = join(tmp, "remote.ttl");
  writeFileSync(filePath, body);
  console.log(`Downloaded ${(body.length / 1024).toFixed(0)} KB`);
} else {
  filePath = resolve(input);
  if (!existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }
}

process.env.RDF_FILE_PATH = filePath;

const { startServer } = await import("../server/index.js");

const preferredPort = parseInt(process.env.PORT || "3000", 10);
const server = await startServer(preferredPort);

// Open browser (macOS: open, Linux: xdg-open)
const openCmd = process.platform === "darwin" ? "open" : "xdg-open";
exec(`${openCmd} http://localhost:${server.port}`);
