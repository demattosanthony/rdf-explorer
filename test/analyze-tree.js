import { parseRDF } from "../server/parse-rdf.js";
const data = parseRDF("/Users/anthonydemattos/Brick.ttl");

// Build parent->children map from subClassOf
const childrenMap = new Map();
for (const link of data.links) {
  if (link.label !== "subClassOf") continue;
  if (!childrenMap.has(link.target)) childrenMap.set(link.target, []);
  childrenMap.get(link.target).push(link.source);
}

// Find root nodes (no parents via subClassOf in graph links)
const hasParent = new Set();
for (const link of data.links) {
  if (link.label === "subClassOf") hasParent.add(link.source);
}
const graphIds = new Set(data.nodes.map(n => n.id));
const roots = data.nodes.filter(n => !hasParent.has(n.id));

console.log("Root nodes:", roots.length);
roots.slice(0, 20).forEach(r => {
  const label = r.properties?.label?.[0] || r.label;
  const kids = (childrenMap.get(r.id) || []).length;
  console.log("  " + label + " (" + kids + " children)");
});

// Count total descendants for top roots
function countDescendants(nodeId, visited = new Set()) {
  visited.add(nodeId);
  const kids = (childrenMap.get(nodeId) || []).filter(k => !visited.has(k));
  let count = kids.length;
  for (const k of kids) count += countDescendants(k, visited);
  return count;
}

console.log("\nRoots with most descendants:");
const rootsWithCount = roots.map(r => ({
  label: r.properties?.label?.[0] || r.label,
  count: countDescendants(r.id),
  directChildren: (childrenMap.get(r.id) || []).length,
}));
rootsWithCount.sort((a, b) => b.count - a.count);
rootsWithCount.slice(0, 15).forEach(r => console.log("  " + r.label + ": " + r.count + " descendants, " + r.directChildren + " direct"));
