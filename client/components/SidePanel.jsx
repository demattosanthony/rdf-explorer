import React, { useMemo } from "react";

function labelFromURI(uri) {
  if (!uri) return uri;
  const h = uri.lastIndexOf("#");
  if (h !== -1) return uri.slice(h + 1);
  const s = uri.lastIndexOf("/");
  if (s !== -1) return uri.slice(s + 1);
  return uri;
}

function humanize(str) {
  return str.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2");
}

function isBlankNode(id) {
  return /^n3-\d+$/.test(id);
}

// Group and categorize relations for wiki-like display
function organizeRelations(outgoing, incoming) {
  const hierarchy = { parents: [], children: [], equivalents: [] };
  const semantics = { tags: [], quantities: [], substances: [], units: [] };
  const otherOut = [];
  const otherIn = [];

  for (const r of outgoing) {
    if (r.predicate === "subClassOf" || r.predicate === "subPropertyOf") {
      hierarchy.parents.push(r);
    } else if (r.predicate === "equivalentClass" || r.predicate === "aliasOf" || r.predicate === "sameAs") {
      hierarchy.equivalents.push(r);
    } else if (r.predicate === "hasAssociatedTag") {
      semantics.tags.push(r);
    } else if (r.predicate === "hasQuantity" || r.predicate === "hasQuantityKind") {
      semantics.quantities.push(r);
    } else if (r.predicate === "hasSubstance") {
      semantics.substances.push(r);
    } else if (r.predicate === "applicableUnit") {
      semantics.units.push(r);
    } else if (!isBlankNode(r.targetId)) {
      otherOut.push(r);
    }
  }

  for (const r of incoming) {
    if (r.predicate === "subClassOf" || r.predicate === "subPropertyOf") {
      hierarchy.children.push(r);
    } else if (r.predicate === "equivalentClass" || r.predicate === "aliasOf" || r.predicate === "sameAs") {
      // already captured from outgoing side
      if (!hierarchy.equivalents.some((e) => e.targetId === r.sourceId || e.sourceId === r.sourceId)) {
        hierarchy.equivalents.push(r);
      }
    } else if (!isBlankNode(r.sourceId)) {
      otherIn.push(r);
    }
  }

  return { hierarchy, semantics, otherOut, otherIn };
}

// Properties that get special treatment (shown in dedicated sections)
const SPECIAL_PROPS = new Set(["label", "definition", "description", "comment", "deprecated", "seeAlso"]);

function RelationLink({ id, label, onNavigate }) {
  if (isBlankNode(id)) return null;
  return (
    <button className="wiki-link" onClick={() => onNavigate(id)}>
      {humanize(label)}
    </button>
  );
}

export default function SidePanel({ node, links, nodes, onClose, onNavigate }) {
  const nodesMap = useMemo(() => {
    const map = new Map();
    for (const n of nodes) map.set(n.id, n);
    return map;
  }, [nodes]);

  // Resolve a URI to a human-readable label
  function resolve(id) {
    const n = nodesMap.get(id);
    if (n) {
      const lbl = n.properties?.label?.[0];
      if (lbl) return lbl;
      return humanize(n.label);
    }
    return humanize(labelFromURI(id));
  }

  // Build a subClassOf lookup for fast ancestor traversal
  const subClassOfMap = useMemo(() => {
    const map = new Map();
    for (const link of links) {
      const sourceId = typeof link.source === "object" ? link.source.id : link.source;
      const targetId = typeof link.target === "object" ? link.target.id : link.target;
      if (link.label === "subClassOf") {
        if (!map.has(sourceId)) map.set(sourceId, []);
        map.get(sourceId).push(targetId);
      }
    }
    return map;
  }, [links]);

  // Walk the full inheritance chain (breadth-first, preserving order)
  const inheritanceChain = useMemo(() => {
    const chain = [];
    const visited = new Set();
    let current = subClassOfMap.get(node.id) || [];
    // Skip direct parents (already shown in Hierarchy > Extends)
    const directParents = new Set(current);
    for (const p of current) visited.add(p);

    while (current.length > 0) {
      const next = [];
      for (const id of current) {
        const grandparents = subClassOfMap.get(id) || [];
        for (const gp of grandparents) {
          if (visited.has(gp)) continue;
          visited.add(gp);
          chain.push({ id: gp, label: resolve(gp) });
          next.push(gp);
        }
      }
      current = next;
    }
    return chain;
  }, [node.id, subClassOfMap, nodesMap]);

  const { outgoing, incoming } = useMemo(() => {
    const out = [];
    const inc = [];
    for (const link of links) {
      const sourceId = typeof link.source === "object" ? link.source.id : link.source;
      const targetId = typeof link.target === "object" ? link.target.id : link.target;
      if (sourceId === node.id) {
        out.push({ predicate: link.label, targetId, targetLabel: resolve(targetId) });
      }
      if (targetId === node.id) {
        inc.push({ predicate: link.label, sourceId, sourceLabel: resolve(sourceId) });
      }
    }
    return { outgoing: out, incoming: inc };
  }, [node, links, nodesMap]);

  const organized = useMemo(
    () => organizeRelations(outgoing, incoming),
    [outgoing, incoming]
  );

  // Display name: prefer rdfs:label property, fall back to humanized URI fragment
  const displayName = node.properties?.label?.[0] || humanize(node.label);
  const definition = node.properties?.definition?.[0] || node.properties?.description?.[0] || null;
  const comment = node.properties?.comment?.[0] || null;
  const isDeprecated = node.properties?.deprecated?.[0] === "true";
  const deprecationMsg = node.properties?.deprecationMitigationMessage?.[0] || null;
  const seeAlso = node.properties?.seeAlso || [];

  // Remaining properties (not shown in special sections)
  const extraProps = Object.entries(node.properties || {}).filter(
    ([key]) => !SPECIAL_PROPS.has(key) && key !== "deprecatedInVersion" && key !== "deprecationMitigationMessage"
  );

  const typeLabel = node.type ? humanize(labelFromURI(node.type)) : null;

  const { hierarchy, semantics, otherOut, otherIn } = organized;

  return (
    <div className="side-panel">
      <div className="panel-header">
        <div className="panel-header-text">
          <h2 className="panel-title">{displayName}</h2>
          {typeLabel && <span className="panel-type-badge">{typeLabel}</span>}
        </div>
        <button className="panel-close" onClick={onClose}>×</button>
      </div>

      <div className="panel-body">

        {isDeprecated && (
          <div className="wiki-deprecated">
            <span className="deprecated-badge">Deprecated</span>
            {deprecationMsg && <p className="deprecated-msg">{deprecationMsg}</p>}
          </div>
        )}

        {definition && (
          <section className="wiki-definition">
            <p>{definition}</p>
          </section>
        )}

        {comment && !definition && (
          <section className="wiki-definition">
            <p>{comment}</p>
          </section>
        )}

        {/* Hierarchy: Parent classes / Subclasses */}
        {(hierarchy.parents.length > 0 || hierarchy.children.length > 0) && (
          <section className="panel-section">
            <h3 className="section-title">Hierarchy</h3>
            {hierarchy.parents.length > 0 && (
              <div className="wiki-hierarchy-row">
                <span className="hierarchy-label">Extends</span>
                <div className="hierarchy-items">
                  {hierarchy.parents.map((r, i) => (
                    <RelationLink key={i} id={r.targetId} label={r.targetLabel} onNavigate={onNavigate} />
                  ))}
                </div>
              </div>
            )}
            {hierarchy.children.length > 0 && (
              <div className="wiki-hierarchy-row">
                <span className="hierarchy-label">
                  Subtypes
                  <span className="hierarchy-count">{hierarchy.children.length}</span>
                </span>
                <div className="hierarchy-items">
                  {hierarchy.children.map((r, i) => (
                    <RelationLink key={i} id={r.sourceId} label={r.sourceLabel} onNavigate={onNavigate} />
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Inherited From: full ancestor chain (excluding direct parents) */}
        {inheritanceChain.length > 0 && (
          <section className="panel-section">
            <h3 className="section-title">Inherited From</h3>
            <div className="wiki-inheritance-chain">
              {inheritanceChain.map((ancestor, i) => (
                <React.Fragment key={ancestor.id}>
                  {i > 0 && <span className="inheritance-separator">›</span>}
                  <button className="wiki-link wiki-link-inherited" onClick={() => onNavigate(ancestor.id)}>
                    {ancestor.label}
                  </button>
                </React.Fragment>
              ))}
            </div>
          </section>
        )}

        {/* Equivalents / Aliases */}
        {hierarchy.equivalents.length > 0 && (
          <section className="panel-section">
            <h3 className="section-title">Also Known As</h3>
            <div className="wiki-tags">
              {hierarchy.equivalents.map((r, i) => {
                const id = r.targetId || r.sourceId;
                const label = r.targetLabel || r.sourceLabel;
                return <RelationLink key={i} id={id} label={label} onNavigate={onNavigate} />;
              })}
            </div>
          </section>
        )}

        {/* Tags */}
        {semantics.tags.length > 0 && (
          <section className="panel-section">
            <h3 className="section-title">Tags</h3>
            <div className="wiki-tags">
              {semantics.tags.map((r, i) => (
                <span key={i} className="wiki-tag">{r.targetLabel}</span>
              ))}
            </div>
          </section>
        )}

        {/* Quantities & Substances */}
        {(semantics.quantities.length > 0 || semantics.substances.length > 0) && (
          <section className="panel-section">
            <h3 className="section-title">Measures</h3>
            {semantics.quantities.map((r, i) => (
              <div key={i} className="wiki-measure-row">
                <span className="measure-label">Quantity</span>
                <span className="measure-value">{humanize(r.targetLabel)}</span>
              </div>
            ))}
            {semantics.substances.map((r, i) => (
              <div key={i} className="wiki-measure-row">
                <span className="measure-label">Substance</span>
                <span className="measure-value">{humanize(r.targetLabel)}</span>
              </div>
            ))}
          </section>
        )}

        {/* Applicable Units */}
        {semantics.units.length > 0 && (
          <section className="panel-section">
            <h3 className="section-title">Units</h3>
            <div className="wiki-tags">
              {semantics.units.map((r, i) => (
                <span key={i} className="wiki-tag wiki-tag-unit">{humanize(r.targetLabel)}</span>
              ))}
            </div>
          </section>
        )}

        {/* Extra literal properties */}
        {extraProps.length > 0 && (
          <section className="panel-section">
            <h3 className="section-title">Properties</h3>
            <dl className="properties-list">
              {extraProps.map(([key, values]) => (
                <div key={key} className="property-item">
                  <dt className="property-key">{humanize(key)}</dt>
                  {values.map((v, i) => (
                    <dd key={i} className="property-value">{v}</dd>
                  ))}
                </div>
              ))}
            </dl>
          </section>
        )}

        {/* Other outgoing relations */}
        {otherOut.length > 0 && (
          <section className="panel-section">
            <h3 className="section-title">Relations</h3>
            <div className="wiki-relations-grouped">
              {groupByPredicate(otherOut).map(([pred, items]) => (
                <div key={pred} className="wiki-relation-group">
                  <span className="relation-group-label">{humanize(pred)}</span>
                  <div className="relation-group-items">
                    {items.map((r, i) => (
                      <RelationLink key={i} id={r.targetId} label={r.targetLabel} onNavigate={onNavigate} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Other incoming relations */}
        {otherIn.length > 0 && (
          <section className="panel-section">
            <h3 className="section-title">Referenced By</h3>
            <div className="wiki-relations-grouped">
              {groupByPredicate(otherIn, "source").map(([pred, items]) => (
                <div key={pred} className="wiki-relation-group">
                  <span className="relation-group-label">{humanize(pred)}</span>
                  <div className="relation-group-items">
                    {items.map((r, i) => (
                      <RelationLink key={i} id={r.sourceId} label={r.sourceLabel} onNavigate={onNavigate} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* See Also */}
        {seeAlso.length > 0 && (
          <section className="panel-section">
            <h3 className="section-title">See Also</h3>
            <div className="wiki-see-also">
              {seeAlso.map((uri, i) => (
                <a key={i} className="wiki-ext-link" href={uri} target="_blank" rel="noopener noreferrer">
                  {uri}
                </a>
              ))}
            </div>
          </section>
        )}

        {/* URI footer */}
        <section className="panel-section wiki-uri-section">
          <h3 className="section-title">URI</h3>
          <p className="uri-value">{node.id}</p>
        </section>
      </div>
    </div>
  );
}

function groupByPredicate(relations, side = "target") {
  const groups = new Map();
  for (const r of relations) {
    const key = r.predicate;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  return Array.from(groups.entries());
}
