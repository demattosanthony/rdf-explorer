import { parseRDF } from "../server/parse-rdf.js";
const data = parseRDF(process.env.HOME + "/Brick.ttl");

const noTagLinks = data.links.filter(l => l.label !== "hasAssociatedTag");
console.log("Links without hasAssociatedTag:", noTagLinks.length);

const linkedNodes = new Set();
noTagLinks.forEach(l => { linkedNodes.add(l.source); linkedNodes.add(l.target); });
const tags = data.nodes.filter(n => n.type && n.type.includes("Tag"));
const orphanTags = tags.filter(n => !linkedNodes.has(n.id));
console.log("Tags that become orphans:", orphanTags.length, "of", tags.length);

const preds = {};
noTagLinks.forEach(l => preds[l.label] = (preds[l.label] || 0) + 1);
console.log("\nRemaining predicates:");
Object.entries(preds).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log("  " + k + ": " + v));
console.log("\nNodes connected by remaining links:", linkedNodes.size);
console.log("Total graph nodes:", data.nodes.length);
