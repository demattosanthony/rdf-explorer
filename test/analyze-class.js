import { parseRDF } from "../server/parse-rdf.js";
const data = parseRDF("/Users/anthonydemattos/Brick.ttl");

// The "Class" category — what are these?
const classId = "https://brickschema.org/schema/Brick#Class";
const classNode = data.allNodes.find(n => n.id === classId);
console.log("Class node:", classNode?.properties?.label?.[0], classNode?.properties?.definition?.[0]?.slice(0, 100));

// What are its direct children?
const children = data.links
  .filter(l => l.target === classId && l.label === "subClassOf")
  .map(l => {
    const n = data.allNodes.find(n => n.id === l.source);
    return n?.properties?.label?.[0] || l.source.split("#").pop();
  });
console.log("Direct children of Class:", children);

// Check what "Equipment" looks like
const equipId = "https://brickschema.org/schema/Brick#Equipment";
const equip = data.allNodes.find(n => n.id === equipId);
console.log("\nEquipment:", equip?.properties?.label?.[0]);
const equipChildren = data.links
  .filter(l => l.target === equipId && l.label === "subClassOf")
  .map(l => {
    const n = data.allNodes.find(n => n.id === l.source);
    return n?.properties?.label?.[0] || l.source.split("#").pop();
  });
console.log("Equipment children:", equipChildren.length, equipChildren.slice(0, 10));

// What are Point's direct children?
const pointId = "https://brickschema.org/schema/Brick#Point";
const pointChildren = data.links
  .filter(l => l.target === pointId && l.label === "subClassOf")
  .map(l => {
    const n = data.allNodes.find(n => n.id === l.source);
    return n?.properties?.label?.[0] || l.source.split("#").pop();
  });
console.log("\nPoint children:", pointChildren);
