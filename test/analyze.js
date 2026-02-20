import { parseRDF } from "../server/parse-rdf.js";
const data = parseRDF(process.env.HOME + "/Brick.ttl");

// Break down nodes by type
const byType = {};
data.nodes.forEach(n => {
  const t = n.type || "(no type)";
  const label = t.split(/[#/]/).pop();
  byType[label] = (byType[label] || 0) + 1;
});
console.log("=== Nodes by type ===");
Object.entries(byType).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => console.log("  " + k + ": " + v));

// Blank nodes
const blanks = data.nodes.filter(n => /^n3-\d+$/.test(n.id));
console.log("\nBlank nodes:", blanks.length, "of", data.nodes.length);

// Nodes from different namespaces
const namespaces = {};
data.nodes.forEach(n => {
  if (/^n3-/.test(n.id)) { namespaces["(blank)"] = (namespaces["(blank)"] || 0) + 1; return; }
  const match = n.id.match(/^(.*?)[#/][^#/]*$/);
  const ns = match ? match[1] : n.id;
  namespaces[ns] = (namespaces[ns] || 0) + 1;
});
console.log("\n=== Nodes by namespace ===");
Object.entries(namespaces).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => console.log("  " + k + ": " + v));

// Link predicate breakdown
const predCounts = {};
data.links.forEach(l => predCounts[l.label] = (predCounts[l.label] || 0) + 1);
console.log("\n=== Link predicates (sorted) ===");
Object.entries(predCounts).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => console.log("  " + k + ": " + v));

// Links involving blank nodes
const blankSet = new Set(blanks.map(n => n.id));
const linksWithBlanks = data.links.filter(l => blankSet.has(l.source) || blankSet.has(l.target));
console.log("\nLinks involving blank nodes:", linksWithBlanks.length, "of", data.links.length);

// What are the "real" semantic links between named nodes?
const meaningfulLinks = data.links.filter(l => {
  if (blankSet.has(l.source) || blankSet.has(l.target)) return false;
  return true;
});
console.log("Links between named nodes:", meaningfulLinks.length);

// Of those, predicate breakdown
const namedPreds = {};
meaningfulLinks.forEach(l => namedPreds[l.label] = (namedPreds[l.label] || 0) + 1);
console.log("\n=== Predicates (named-to-named only) ===");
Object.entries(namedPreds).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => console.log("  " + k + ": " + v));
