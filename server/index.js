import { readFileSync } from "fs";
import { join, resolve } from "path";
import { parseRDF } from "./parse-rdf.js";

const PROJECT_ROOT = resolve(import.meta.dir, "..");

export async function startServer(port = 3000) {
  const filePath = process.env.RDF_FILE_PATH;
  if (!filePath) {
    throw new Error("RDF_FILE_PATH environment variable is not set");
  }

  // Parse RDF once at startup
  const parsed = parseRDF(filePath);

  // Graph data: only named nodes + semantic links (for 3D rendering)
  const graphData = {
    nodes: parsed.nodes,
    links: parsed.links,
    classes: parsed.classes,
  };

  // Detail data: all nodes + all links (for the wiki panel to resolve references)
  const detailData = {
    allNodes: parsed.allNodes,
    allLinks: parsed.allLinks,
  };

  console.log(
    `Parsed ${parsed.allNodes.length} total nodes → ${graphData.nodes.length} named things, ${graphData.links.length} semantic links, ${graphData.classes.length} classes`
  );

  // Bundle frontend
  const buildResult = await Bun.build({
    entrypoints: [join(PROJECT_ROOT, "client/index.jsx")],
    outdir: join(PROJECT_ROOT, "dist"),
    target: "browser",
    minify: false,
  });

  if (!buildResult.success) {
    console.error("Build failed:", buildResult.logs);
    process.exit(1);
  }

  const cssContent = readFileSync(
    join(PROJECT_ROOT, "client/styles.css"),
    "utf-8"
  );

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>RDF Explorer</title>
  <link rel="stylesheet" href="/styles.css" />
</head>
<body>
  <div id="root"></div>
  <script src="/bundle.js"></script>
</body>
</html>`;

  let server;
  try {
    server = Bun.serve({ port, fetch: serveFn });
  } catch {
    // Port taken — let the OS pick a free one
    server = Bun.serve({ port: 0, fetch: serveFn });
  }

  function serveFn(req) {
      const url = new URL(req.url);

      if (url.pathname === "/api/graph") {
        return Response.json(graphData);
      }

      if (url.pathname === "/api/detail") {
        return Response.json(detailData);
      }

      if (url.pathname === "/bundle.js") {
        const bundlePath = join(PROJECT_ROOT, "dist/index.js");
        const bundle = readFileSync(bundlePath);
        return new Response(bundle, {
          headers: { "Content-Type": "application/javascript" },
        });
      }

      if (url.pathname === "/styles.css") {
        return new Response(cssContent, {
          headers: { "Content-Type": "text/css" },
        });
      }

      // SPA fallback
      return new Response(html, {
        headers: { "Content-Type": "text/html" },
      });
  }

  console.log(`RDF Explorer running at http://localhost:${server.port}`);
  return server;
}
