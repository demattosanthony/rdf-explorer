import { parseRDF } from "../server/parse-rdf.js";
const data = parseRDF("/Users/anthonydemattos/Brick.ttl");

// Build subClassOf parent map (child -> parents)
const parentMap = new Map();
for (const link of data.links) {
  if (link.label === "subClassOf") {
    if (!parentMap.has(link.source)) parentMap.set(link.source, []);
    parentMap.get(link.source).push(link.target);
  }
}

// Find root ancestor for each node (walk up subClassOf until no more parents)
function getRootAncestor(nodeId, visited = new Set()) {
  visited.add(nodeId);
  const parents = parentMap.get(nodeId) || [];
  const unvisited = parents.filter(p => !visited.has(p));
  if (unvisited.length === 0) return nodeId;
  // Follow first parent (primary inheritance)
  return getRootAncestor(unvisited[0], visited);
}

// Get the "useful" category - not the absolute root, but the level just below
// abstract roots like Entity, Resource, Class
const ABSTRACT_ROOTS = new Set([
  "https://brickschema.org/schema/Brick#Entity",
  "https://brickschema.org/schema/Brick#Class",
  "http://www.w3.org/2000/01/rdf-schema#Resource",
  "http://www.w3.org/2002/07/owl#Thing",
]);

function getCategory(nodeId, visited = new Set()) {
  visited.add(nodeId);
  const parents = parentMap.get(nodeId) || [];
  const unvisited = parents.filter(p => !visited.has(p));
  if (unvisited.length === 0) return nodeId; // this node IS a root
  // If parent is abstract, this node is the useful category
  if (unvisited.every(p => ABSTRACT_ROOTS.has(p) || !data.nodes.some(n => n.id === p))) {
    return nodeId;
  }
  return getCategory(unvisited[0], visited);
}

// Compute categories for all graph nodes
const categories = new Map();
const categoryCounts = {};
for (const node of data.nodes) {
  const cat = getCategory(node.id);
  categories.set(node.id, cat);
  const catNode = data.allNodes.find(n => n.id === cat);
  const label = catNode?.properties?.label?.[0] || cat.split("#").pop();
  categoryCounts[label] = (categoryCounts[label] || 0) + 1;
}

console.log("=== Categories (cluster labels) ===");
Object.entries(categoryCounts)
  .sort((a, b) => b[1] - a[1])
  .forEach(([k, v]) => console.log("  " + k + ": " + v + " nodes"));

// Also find true roots (no parents at all in the graph)
const graphNodeIds = new Set(data.nodes.map(n => n.id));
const roots = data.nodes.filter(n => {
  const parents = parentMap.get(n.id) || [];
  return parents.filter(p => graphNodeIds.has(p)).length === 0;
});
console.log("\nTrue root nodes (no parents in graph):", roots.length);
roots.slice(0, 20).forEach(n => {
  const label = n.properties?.label?.[0] || n.label;
  const childCount = data.links.filter(l => l.target === n.id && l.label === "subClassOf").length;
  console.log("  " + label + " (" + childCount + " direct children)");
});
