import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";

const LIMIT_STEPS = [100, 250, 500, 1000, 2000, 5000, 10000];
const MAX_RESULTS = 50;

function labelFromURI(uri) {
  if (!uri) return "";
  const h = uri.lastIndexOf("#");
  if (h !== -1) return uri.slice(h + 1);
  const s = uri.lastIndexOf("/");
  if (s !== -1) return uri.slice(s + 1);
  return uri;
}

function normalizeForSearch(str) {
  return str.toLowerCase().replace(/[_\-]/g, " ");
}

function humanize(str) {
  return str.replace(/_/g, " ");
}

// ── Tree Node (recursive) ──
function TreeNode({ node, childrenMap, depth, selectedNodeId, onNodeClick, expandedSet, toggleExpanded }) {
  const kids = childrenMap.get(node.id) || [];
  const hasChildren = kids.length > 0;
  const isExpanded = expandedSet.has(node.id);
  const isSelected = node.id === selectedNodeId;
  const label = node.properties?.label?.[0] || humanize(node.label);

  return (
    <>
      <div
        className={`tree-item ${isSelected ? "tree-item-selected" : ""}`}
        style={{ paddingLeft: 12 + depth * 16 }}
        data-node-id={node.id}
        onClick={(e) => {
          e.stopPropagation();
          onNodeClick(node);
        }}
      >
        <span
          className={`tree-chevron ${hasChildren ? (isExpanded ? "tree-chevron-open" : "") : "tree-chevron-hidden"}`}
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) toggleExpanded(node.id);
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <path d="M4.5 2L8.5 6L4.5 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <span className="tree-label">{label}</span>
        {hasChildren && <span className="tree-count">{kids.length}</span>}
      </div>
      {isExpanded && kids.map((child) => (
        <TreeNode
          key={child.id}
          node={child}
          childrenMap={childrenMap}
          depth={depth + 1}
          selectedNodeId={selectedNodeId}
          onNodeClick={onNodeClick}
          expandedSet={expandedSet}
          toggleExpanded={toggleExpanded}
        />
      ))}
    </>
  );
}

export default function ExplorerPanel({
  graphData,
  selectedNode,
  activeFilter,
  onFilterChange,
  onNodeSelect,
  totalNodes,
  totalLinks,
  displayedNodes,
  displayedLinks,
  isLargeDataset,
  nodeLimit,
  onNodeLimitChange,
}) {
  const [query, setQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [expandedSet, setExpandedSet] = useState(new Set());
  const searchRef = useRef(null);
  const treeBodyRef = useRef(null);

  const nodes = graphData?.nodes || [];
  const links = graphData?.links || [];
  const classes = graphData?.classes || [];

  // Build parent→children map from subClassOf links
  const { childrenMap, roots } = useMemo(() => {
    const cMap = new Map();
    const hasParent = new Set();

    for (const link of links) {
      if (link.label !== "subClassOf") continue;
      const parentId = link.target;
      const childId = link.source;
      hasParent.add(childId);
      if (!cMap.has(parentId)) cMap.set(parentId, []);
      cMap.get(parentId).push(childId);
    }

    // Sort children alphabetically at each level
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    for (const [key, kids] of cMap) {
      const resolved = kids
        .map((id) => nodeMap.get(id))
        .filter(Boolean)
        .sort((a, b) => {
          const la = (a.properties?.label?.[0] || a.label).toLowerCase();
          const lb = (b.properties?.label?.[0] || b.label).toLowerCase();
          return la.localeCompare(lb);
        });
      cMap.set(key, resolved);
    }

    // Root nodes: in graph, no parent
    const rootNodes = nodes
      .filter((n) => !hasParent.has(n.id))
      .sort((a, b) => {
        // Sort by descendant count (largest first)
        const ca = (cMap.get(a.id) || []).length;
        const cb = (cMap.get(b.id) || []).length;
        return cb - ca;
      });

    return { childrenMap: cMap, roots: rootNodes };
  }, [nodes, links]);

  // Auto-expand to show selected node
  useEffect(() => {
    if (!selectedNode) return;

    // Build child→parent map
    const parentMap = new Map();
    for (const link of links) {
      if (link.label !== "subClassOf") continue;
      parentMap.set(link.source, link.target);
    }

    // Walk ancestors and expand them
    const toExpand = new Set();
    let current = selectedNode.id;
    while (parentMap.has(current)) {
      const parent = parentMap.get(current);
      toExpand.add(parent);
      current = parent;
    }

    if (toExpand.size > 0) {
      setExpandedSet((prev) => {
        const next = new Set(prev);
        for (const id of toExpand) next.add(id);
        return next;
      });
    }

    // Scroll selected item into view
    requestAnimationFrame(() => {
      const el = treeBodyRef.current?.querySelector(`[data-node-id="${CSS.escape(selectedNode.id)}"]`);
      if (el) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  }, [selectedNode, links]);

  const toggleExpanded = useCallback((nodeId) => {
    setExpandedSet((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }, []);

  // Search
  const searchResults = useMemo(() => {
    if (!query.trim()) return { nodes: [], classes: [] };
    const q = normalizeForSearch(query);

    const matchedNodes = [];
    for (const node of nodes) {
      const labelNorm = normalizeForSearch(node.label);
      if (labelNorm.includes(q)) {
        matchedNodes.push(node);
        if (matchedNodes.length >= MAX_RESULTS) break;
      }
    }

    const matchedClasses = classes.filter((c) => {
      const labelNorm = normalizeForSearch(c.label);
      const uriNorm = normalizeForSearch(c.uri);
      return labelNorm.includes(q) || uriNorm.includes(q);
    });

    return { nodes: matchedNodes, classes: matchedClasses };
  }, [query, nodes, classes]);

  // Close search dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowResults(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const hasResults = searchResults.nodes.length > 0 || searchResults.classes.length > 0;
  const activeClass = classes.find((c) => c.uri === activeFilter);

  const sliderIndex = LIMIT_STEPS.findIndex((s) => s >= nodeLimit);
  const effectiveIndex = sliderIndex === -1 ? LIMIT_STEPS.length - 1 : sliderIndex;

  return (
    <div className="explorer-panel">
      {/* Search */}
      <div className="explorer-search" ref={searchRef}>
        <div className="search-input-wrapper">
          <svg className="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowResults(true);
            }}
            onFocus={() => query.trim() && setShowResults(true)}
            className="search-input"
          />
          {query && (
            <button
              className="search-clear"
              onClick={() => { setQuery(""); setShowResults(false); }}
            >
              ×
            </button>
          )}
        </div>

        {showResults && query.trim() && (
          <div className="search-results">
            {!hasResults && (
              <div className="result-empty">No results for "{query}"</div>
            )}
            {searchResults.classes.length > 0 && (
              <div className="result-group">
                <div className="result-group-header">Classes</div>
                {searchResults.classes.map((c) => (
                  <div
                    key={c.uri}
                    className="result-item result-class"
                    onClick={() => {
                      onFilterChange(c.uri);
                      setQuery(""); setShowResults(false);
                    }}
                  >
                    <span className="result-icon">◆</span>
                    <div className="result-text">
                      <span className="result-label">{c.label}</span>
                      <span className="result-meta">Filter graph</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {searchResults.nodes.length > 0 && (
              <div className="result-group">
                <div className="result-group-header">
                  Nodes
                  {searchResults.nodes.length >= MAX_RESULTS && (
                    <span className="result-count"> (first {MAX_RESULTS})</span>
                  )}
                </div>
                {searchResults.nodes.map((node) => (
                  <div
                    key={node.id}
                    className="result-item result-node"
                    onClick={() => {
                      onNodeSelect(node);
                      setQuery(""); setShowResults(false);
                    }}
                  >
                    <span className="result-icon">●</span>
                    <div className="result-text">
                      <span className="result-label">{humanize(node.label)}</span>
                      <span className="result-meta">{node.type ? labelFromURI(node.type) : ""}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Active filter pill */}
      {activeFilter && activeClass && (
        <div className="explorer-filter">
          <span className="filter-pill">
            {activeClass.label}
            <button className="filter-clear" onClick={() => { onFilterChange(null); setQuery(""); }}>×</button>
          </span>
        </div>
      )}

      {/* Tree */}
      <div className="explorer-tree">
        <div className="explorer-tree-header">Ontology</div>
        <div className="explorer-tree-body" ref={treeBodyRef}>
          {roots.map((root) => (
            <TreeNode
              key={root.id}
              node={root}
              childrenMap={childrenMap}
              depth={0}
              selectedNodeId={selectedNode?.id}
              onNodeClick={onNodeSelect}
              expandedSet={expandedSet}
              toggleExpanded={toggleExpanded}
            />
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="explorer-stats">
        <span className="stats-text">
          {displayedNodes === totalNodes
            ? `${totalNodes} nodes · ${totalLinks} links`
            : `${displayedNodes}/${totalNodes} nodes · ${displayedLinks} links`}
        </span>
        {isLargeDataset && (
          <div className="limit-control">
            <label className="limit-label">
              Limit: {nodeLimit >= totalNodes ? "All" : nodeLimit}
            </label>
            <input
              type="range"
              className="limit-slider"
              min={0}
              max={LIMIT_STEPS.length - 1}
              value={effectiveIndex}
              onChange={(e) => onNodeLimitChange(LIMIT_STEPS[e.target.value])}
            />
          </div>
        )}
      </div>
    </div>
  );
}
