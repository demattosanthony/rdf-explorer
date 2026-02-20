# RDF Explorer

A CLI tool that opens RDF Turtle (`.ttl`) files in an interactive browser-based graph viewer.

![Bun](https://img.shields.io/badge/runtime-Bun-f0db4f) ![React](https://img.shields.io/badge/UI-React%2019-61dafb)

## Quick Start

```bash
# Install dependencies
bun install

# Open a Turtle file
bun bin/rdf-explorer.js myfile.ttl
```

This starts a local server and opens the viewer in your browser.

### Global Install

```bash
bun link
rdf-explorer myfile.ttl
```

### Custom Port

```bash
PORT=8080 bun bin/rdf-explorer.js myfile.ttl
```

## Features

### Graph View
- 2D force-directed graph rendered on Canvas
- Nodes sized by connection count with radial gradient fills and glow halos
- Zoom-based label visibility — more labels appear as you zoom in
- Cluster labels overlay when zoomed out, grouped by root ontology class
- Slightly curved links with directional arrows
- Click a node to select it, click background to deselect

### Explorer Panel (left)
- **Search** — fuzzy search across all nodes and classes
- **Ontology tree** — collapsible hierarchy built from `subClassOf` relationships, sorted by size
- Tree auto-expands and scrolls to the selected node
- Click any tree item to focus the graph and open the detail panel

### Detail Panel (right)
- Wiki-style page for the selected node
- Resolved labels, definitions, deprecated banners
- Hierarchy section (extends / subtypes) with full inheritance chain
- Also Known As, Tags, Measures, Units
- Grouped relations and incoming references
- All links are clickable — navigate between nodes without leaving the panel

### URL State
- Selected node is saved in the URL (`?node=...`)
- Refresh or share the link to restore the exact view

### Large Dataset Handling
- Tested with the [Brick ontology](https://brickschema.org/) (~10k nodes, ~37k links)
- Smart filtering: only domain "things" and semantic relationships are rendered
- Node limit slider to control how many nodes are displayed
- Most-connected nodes are prioritized

## Project Structure

```
rdf-explorer/
  bin/rdf-explorer.js      CLI entry point
  server/
    index.js                Bun HTTP server, bundles frontend at startup
    parse-rdf.js            N3-based Turtle parser with filtering logic
  client/
    index.jsx               React mount
    App.jsx                 Root component, state management, URL sync
    styles.css              Dark theme styles
    components/
      GraphCanvas.jsx       ForceGraph2D with custom Canvas rendering
      ExplorerPanel.jsx     Left panel: search + ontology tree + stats
      SidePanel.jsx         Right panel: wiki-style node detail
  test/
    sample.ttl              Small sample Turtle file
```

## Tech Stack

- **[Bun](https://bun.sh/)** — runtime, bundler, HTTP server
- **React 19** — UI
- **[react-force-graph-2d](https://github.com/vasturiano/react-force-graph)** — graph rendering
- **[N3.js](https://github.com/rdfjs/N3.js)** — Turtle/RDF parsing

## Requirements

- [Bun](https://bun.sh/) v1.0+

## License

MIT
