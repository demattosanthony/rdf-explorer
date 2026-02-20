import { parseRDF } from "../server/parse-rdf.js";
const data = parseRDF(process.env.HOME + "/Brick.ttl");

// Nodes with no type
const noType = data.nodes.filter(n => n.type === null);
console.log("Nodes with no type:", noType.length);
const nsByNs = {};
noType.forEach(n => {
  const parts = n.id.split("#");
  const ns = parts.length > 1 ? parts[0] : "(other)";
  nsByNs[ns] = (nsByNs[ns] || 0) + 1;
});
console.log("No-type by namespace:");
Object.entries(nsByNs).sort((a,b)=>b[1]-a[1]).forEach(([k,v]) => console.log("  "+k+": "+v));

console.log("\nSample no-type nodes:");
noType.slice(0, 15).forEach(n => console.log("  " + n.label + " | " + n.id.slice(0,80)));

// PropertyShape named nodes
const ps = data.nodes.filter(n => n.type && n.type.includes("PropertyShape"));
console.log("\nNamed PropertyShape nodes:", ps.length);
ps.slice(0, 3).forEach(n => console.log("  " + n.label + " | keys:", Object.keys(n.properties)));

// EntityPropertyValue
const epv = data.nodes.filter(n => n.type && n.type.includes("EntityPropertyValue"));
console.log("\nEntityPropertyValue nodes:", epv.length);
epv.slice(0, 3).forEach(n => console.log("  " + n.label));

// What types are pure infrastructure vs domain?
console.log("\n=== Type analysis ===");
const typeGroups = {};
data.nodes.forEach(n => {
  const t = n.type || "(none)";
  if (!typeGroups[t]) typeGroups[t] = [];
  typeGroups[t].push(n);
});
for (const [type, items] of Object.entries(typeGroups).sort((a,b)=>b[1].length-a[1].length)) {
  const label = type.split(/[#/]/).pop();
  const sample = items.slice(0, 3).map(n => n.label).join(", ");
  console.log(`  ${label} (${items.length}): ${sample}`);
}
