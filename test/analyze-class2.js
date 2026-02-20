import { parseRDF } from "../server/parse-rdf.js";
const data = parseRDF("/Users/anthonydemattos/Brick.ttl");

// What are the children of Class?
const classId = "https://brickschema.org/schema/Brick#Class";
const children = data.links
  .filter(l => l.target === classId && l.label === "subClassOf")
  .map(l => l.source);

console.log("Children of Class in graph:");
children.forEach(c => {
  const node = data.nodes.find(n => n.id === c);
  if (!node) return;
  const label = node.properties?.label?.[0] || node.label;
  // Count descendants
  let count = 0;
  const stack = [c];
  const visited = new Set([c]);
  while (stack.length > 0) {
    const id = stack.pop();
    const kids = data.links.filter(l => l.target === id && l.label === "subClassOf").map(l => l.source);
    for (const k of kids) {
      if (visited.has(k)) continue;
      visited.add(k);
      count++;
      stack.push(k);
    }
  }
  console.log("  " + label + ": " + count + " descendants");
});
