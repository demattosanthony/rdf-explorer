import React, { useState, useMemo, useRef, useEffect } from "react";

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

export default function SearchBar({
  classes,
  nodes,
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
  const wrapperRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowResults(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const searchResults = useMemo(() => {
    if (!query.trim()) return { nodes: [], classes: [] };
    const q = normalizeForSearch(query);

    // Search nodes
    const matchedNodes = [];
    for (const node of nodes) {
      const labelNorm = normalizeForSearch(node.label);
      if (labelNorm.includes(q)) {
        matchedNodes.push(node);
        if (matchedNodes.length >= MAX_RESULTS) break;
      }
    }

    // Search classes
    const matchedClasses = classes.filter((c) => {
      const labelNorm = normalizeForSearch(c.label);
      const uriNorm = normalizeForSearch(c.uri);
      return labelNorm.includes(q) || uriNorm.includes(q);
    });

    return { nodes: matchedNodes, classes: matchedClasses };
  }, [query, nodes, classes]);

  const activeClass = classes.find((c) => c.uri === activeFilter);

  const sliderIndex = LIMIT_STEPS.findIndex((s) => s >= nodeLimit);
  const effectiveIndex = sliderIndex === -1 ? LIMIT_STEPS.length - 1 : sliderIndex;

  const hasResults = searchResults.nodes.length > 0 || searchResults.classes.length > 0;

  return (
    <div className="search-bar" ref={wrapperRef}>
      <div className="search-input-wrapper">
        <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          placeholder="Search nodes and classes…"
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
            onClick={() => {
              setQuery("");
              setShowResults(false);
            }}
          >
            ×
          </button>
        )}
      </div>

      {activeFilter && activeClass && (
        <div className="active-filter">
          <span className="filter-pill">
            {activeClass.label}
            <button
              className="filter-clear"
              onClick={() => {
                onFilterChange(null);
                setQuery("");
              }}
            >
              ×
            </button>
          </span>
        </div>
      )}

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
                    setQuery("");
                    setShowResults(false);
                  }}
                >
                  <span className="result-icon">◆</span>
                  <div className="result-text">
                    <span className="result-label">{c.label}</span>
                    <span className="result-meta">Filter graph to this class</span>
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
                  <span className="result-count"> (showing first {MAX_RESULTS})</span>
                )}
              </div>
              {searchResults.nodes.map((node) => (
                <div
                  key={node.id}
                  className="result-item result-node"
                  onClick={() => {
                    onNodeSelect(node);
                    setQuery("");
                    setShowResults(false);
                  }}
                >
                  <span className="result-icon">●</span>
                  <div className="result-text">
                    <span className="result-label">{node.label.replace(/_/g, " ")}</span>
                    <span className="result-meta">
                      {node.type ? labelFromURI(node.type) : "No type"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="stats-bar">
        <span className="stats-text">
          {displayedNodes === totalNodes
            ? `${totalNodes} nodes · ${totalLinks} links`
            : `${displayedNodes} of ${totalNodes} nodes · ${displayedLinks} links`}
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
