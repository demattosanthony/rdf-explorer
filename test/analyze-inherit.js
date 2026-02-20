import { parseRDF } from "../server/parse-rdf.js";
const data = parseRDF("/Users/anthonydemattos/Brick.ttl");

const subClassOf = "http://www.w3.org/2000/01/rdf-schema#subClassOf";

function getAncestors(nodeId) {
  const chain = [];
  const visited = new Set();
  let current = [nodeId];
  while (current.length > 0) {
    const next = [];
    for (const id of current) {
      const parents = data.allLinks
        .filter(l => l.source === id && l.predicate === subClassOf)
        .map(l => l.target);
      for (const p of parents) {
        if (visited.has(p)) continue;
        visited.add(p);
        chain.push(p);
        next.push(p);
      }
    }
    current = next;
  }
  return chain;
}

const ahuId = "https://brickschema.org/schema/Brick#Air_Handler_Unit";
const ancestors = getAncestors(ahuId);
console.log("Air_Handler_Unit inheritance chain:");
ancestors.forEach(a => {
  const node = data.allNodes.find(n => n.id === a);
  const label = node?.properties?.label?.[0] || a.split("#").pop();
  console.log("  " + label);
});

const tsId = "https://brickschema.org/schema/Brick#Temperature_Sensor";
const tsAncestors = getAncestors(tsId);
console.log("\nTemperature_Sensor inheritance chain:");
tsAncestors.forEach(a => {
  const node = data.allNodes.find(n => n.id === a);
  const label = node?.properties?.label?.[0] || a.split("#").pop();
  console.log("  " + label);
});
