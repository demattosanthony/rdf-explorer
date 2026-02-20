import { readFileSync } from "fs";
import { Parser as N3Parser } from "n3";

function labelFromURI(uri) {
  if (!uri) return uri;
  const hashIndex = uri.lastIndexOf("#");
  if (hashIndex !== -1) return uri.slice(hashIndex + 1);
  const slashIndex = uri.lastIndexOf("/");
  if (slashIndex !== -1) return uri.slice(slashIndex + 1);
  return uri;
}

// Predicates that represent real semantic relationships between domain things.
// Excludes structural/infrastructure predicates (rule, property, path, rest, first, etc.)
// and tag associations (shown in wiki panel instead — too dense for graph rendering).
const GRAPH_PREDICATES = new Set([
  "http://www.w3.org/2000/01/rdf-schema#subClassOf",
  "http://www.w3.org/2002/07/owl#equivalentClass",
  "http://www.w3.org/2002/07/owl#disjointWith",
  "http://www.w3.org/2002/07/owl#sameAs",
  "https://brickschema.org/schema/Brick#aliasOf",
  "https://brickschema.org/schema/Brick#isReplacedBy",
  "https://brickschema.org/schema/Brick#hasQuantity",
  "https://brickschema.org/schema/Brick#hasSubstance",
  "http://www.w3.org/2004/02/skos/core#broader",
  "http://www.w3.org/2004/02/skos/core#narrower",
]);

// Node types that are real domain "things" worth showing in the graph.
// Tags are excluded from graph nodes (too many, only connected by hasAssociatedTag)
// but they're still visible in the wiki panel.
const GRAPH_NODE_TYPES = new Set([
  "http://www.w3.org/ns/shacl#NodeShape",         // Brick concepts (equipment, sensors, locations, etc.)
  "https://brickschema.org/schema/Brick#Quantity",  // Quantities (Temperature, Pressure, etc.)
  "https://brickschema.org/schema/Brick#Substance", // Substances (Air, Water, etc.)
  "http://www.w3.org/2000/01/rdf-schema#Class",    // Additional RDF classes
  "http://www.w3.org/2002/07/owl#Class",           // OWL classes
]);

function isBlankNodeId(value) {
  return /^(n3-\d+|_:.+)$/.test(value);
}

export function parseRDF(filePath) {
  const content = readFileSync(filePath, "utf-8");
  const parser = new N3Parser();
  const quads = parser.parse(content);

  const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";

  // First pass: collect everything for full resolution
  const allNodesMap = new Map();
  const allLinks = [];

  function ensureNode(id) {
    if (!allNodesMap.has(id)) {
      allNodesMap.set(id, {
        id,
        label: labelFromURI(id),
        type: null,
        properties: {},
      });
    }
    return allNodesMap.get(id);
  }

  for (const quad of quads) {
    const subjectId = quad.subject.value;
    const predicateId = quad.predicate.value;
    const objectValue = quad.object.value;
    const objectType = quad.object.termType;

    const subjectNode = ensureNode(subjectId);

    if (objectType === "Literal") {
      const predLabel = labelFromURI(predicateId);
      if (!subjectNode.properties[predLabel]) {
        subjectNode.properties[predLabel] = [];
      }
      subjectNode.properties[predLabel].push(objectValue);
    } else {
      if (predicateId === RDF_TYPE) {
        subjectNode.type = objectValue;
      } else {
        ensureNode(objectValue);
        allLinks.push({
          source: subjectId,
          target: objectValue,
          predicate: predicateId,
          label: labelFromURI(predicateId),
        });
      }
    }
  }

  // Second pass: build clean graph with only domain things and semantic links
  const graphNodes = new Map();
  const classesSet = new Set();

  for (const [id, node] of allNodesMap) {
    if (isBlankNodeId(id)) continue;
    if (node.type === null || !GRAPH_NODE_TYPES.has(node.type)) continue;
    graphNodes.set(id, node);
    classesSet.add(node.type);
  }

  // Only keep semantic links between domain nodes
  const semanticLinks = [];
  for (const link of allLinks) {
    if (!GRAPH_PREDICATES.has(link.predicate)) continue;
    if (!graphNodes.has(link.source) || !graphNodes.has(link.target)) continue;
    semanticLinks.push(link);
  }

  const nodes = Array.from(graphNodes.values());

  // Friendly labels for graph classes shown in the filter UI
  const CLASS_LABELS = {
    "http://www.w3.org/ns/shacl#NodeShape": "Brick Concept",
    "https://brickschema.org/schema/Brick#Quantity": "Quantity",
    "https://brickschema.org/schema/Brick#Substance": "Substance",
    "http://www.w3.org/2000/01/rdf-schema#Class": "Class",
    "http://www.w3.org/2002/07/owl#Class": "OWL Class",
  };

  const classes = Array.from(classesSet).map((uri) => ({
    uri,
    label: CLASS_LABELS[uri] || labelFromURI(uri),
  }));

  // Compute category for each graph node by walking subClassOf to a useful root.
  // "Useful root" = highest ancestor that is still in the graph, stopping before
  // abstract roots like Entity/Class/Resource.
  const SUBCLASS_OF = "http://www.w3.org/2000/01/rdf-schema#subClassOf";
  const ABSTRACT_ROOTS = new Set([
    "https://brickschema.org/schema/Brick#Entity",
    "https://brickschema.org/schema/Brick#Class",  // Too abstract — children are Equipment, Location, etc.
    "https://brickschema.org/schema/Brick#Measurable",
    "http://www.w3.org/2000/01/rdf-schema#Resource",
    "http://www.w3.org/2002/07/owl#Thing",
  ]);

  // Build parent lookup (only within graph nodes)
  const parentLookup = new Map();
  for (const link of allLinks) {
    if (link.predicate !== SUBCLASS_OF) continue;
    if (!graphNodes.has(link.source)) continue;
    if (!parentLookup.has(link.source)) parentLookup.set(link.source, []);
    parentLookup.get(link.source).push(link.target);
  }

  const categoryCache = new Map();
  function getCategory(nodeId, visited) {
    if (categoryCache.has(nodeId)) return categoryCache.get(nodeId);
    if (!visited) visited = new Set();
    visited.add(nodeId);

    // Only follow non-abstract parents that are in the graph
    const parents = (parentLookup.get(nodeId) || []).filter(
      (p) => !visited.has(p) && graphNodes.has(p) && !ABSTRACT_ROOTS.has(p)
    );

    // If no concrete parents remain, this node is a root category
    if (parents.length === 0) {
      categoryCache.set(nodeId, nodeId);
      return nodeId;
    }

    const result = getCategory(parents[0], visited);
    categoryCache.set(nodeId, result);
    return result;
  }

  // Assign category to each node
  for (const node of nodes) {
    const catId = getCategory(node.id);
    const catNode = allNodesMap.get(catId);
    node.category = catId;
    node.categoryLabel =
      catNode?.properties?.label?.[0] ||
      catNode?.label?.replace(/_/g, " ") ||
      labelFromURI(catId);
  }

  return {
    nodes,
    links: semanticLinks,
    classes,
    allNodes: Array.from(allNodesMap.values()),
    allLinks,
  };
}
