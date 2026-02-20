import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import GraphCanvas from "./components/GraphCanvas.jsx";
import ExplorerPanel from "./components/ExplorerPanel.jsx";
import SidePanel from "./components/SidePanel.jsx";

const DEFAULT_NODE_LIMIT = 500;
const LARGE_DATASET_THRESHOLD = 1000;

function getInitialParam(key) {
  return new URLSearchParams(window.location.search).get(key) || null;
}

function setParam(key, value) {
  const params = new URLSearchParams(window.location.search);
  if (value) params.set(key, value);
  else params.delete(key);
  const qs = params.toString();
  const url = window.location.pathname + (qs ? "?" + qs : "");
  window.history.replaceState(null, "", url);
}

export default function App() {
  const [graphData, setGraphData] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [activeFilter, setActiveFilter] = useState(null);
  const [nodeLimit, setNodeLimit] = useState(DEFAULT_NODE_LIMIT);
  const [focusNodeId, setFocusNodeId] = useState(null);
  const graphRef = useRef();
  const initialNodeId = useRef(getInitialParam("node"));

  useEffect(() => {
    // Fetch graph (named nodes + semantic links) for rendering
    fetch("/api/graph")
      .then((res) => res.json())
      .then((data) => {
        setGraphData(data);
        // Restore selected node from URL
        if (initialNodeId.current) {
          const node = data.nodes.find((n) => n.id === initialNodeId.current);
          if (node) {
            setSelectedNode(node);
            setFocusNodeId(node.id);
          }
        }
      });
    // Fetch full data (all nodes + all links) for the detail panel
    fetch("/api/detail")
      .then((res) => res.json())
      .then(setDetailData);
  }, []);

  // Sync selected node to URL search params
  useEffect(() => {
    setParam("node", selectedNode?.id || null);
  }, [selectedNode]);

  const isLargeDataset = graphData && graphData.nodes.length > LARGE_DATASET_THRESHOLD;

  const displayData = useMemo(() => {
    if (!graphData) return null;

    let nodes = graphData.nodes;
    let links = graphData.links;

    // Apply class filter
    if (activeFilter) {
      const matchingNodes = new Set(
        nodes.filter((n) => n.type === activeFilter).map((n) => n.id)
      );

      const neighborIds = new Set(matchingNodes);
      for (const link of links) {
        const sourceId = typeof link.source === "object" ? link.source.id : link.source;
        const targetId = typeof link.target === "object" ? link.target.id : link.target;
        if (matchingNodes.has(sourceId)) neighborIds.add(targetId);
        if (matchingNodes.has(targetId)) neighborIds.add(sourceId);
      }

      nodes = nodes.filter((n) => neighborIds.has(n.id));
    }

    // If we have a focused node, ensure it and its neighbors are included
    if (focusNodeId) {
      const hasNode = nodes.some((n) => n.id === focusNodeId);
      if (!hasNode) {
        const focusNeighbors = new Set([focusNodeId]);
        for (const link of graphData.links) {
          const sourceId = typeof link.source === "object" ? link.source.id : link.source;
          const targetId = typeof link.target === "object" ? link.target.id : link.target;
          if (sourceId === focusNodeId) focusNeighbors.add(targetId);
          if (targetId === focusNodeId) focusNeighbors.add(sourceId);
        }
        const extraNodes = graphData.nodes.filter(
          (n) => focusNeighbors.has(n.id) && !nodes.some((existing) => existing.id === n.id)
        );
        nodes = [...nodes, ...extraNodes];
      }
    }

    // Apply node limit for large datasets
    if (nodes.length > nodeLimit) {
      const connectionCount = new Map();
      for (const link of links) {
        const sourceId = typeof link.source === "object" ? link.source.id : link.source;
        const targetId = typeof link.target === "object" ? link.target.id : link.target;
        connectionCount.set(sourceId, (connectionCount.get(sourceId) || 0) + 1);
        connectionCount.set(targetId, (connectionCount.get(targetId) || 0) + 1);
      }

      const sorted = [...nodes].sort(
        (a, b) => (connectionCount.get(b.id) || 0) - (connectionCount.get(a.id) || 0)
      );

      if (focusNodeId) {
        const focusNeighbors = new Set([focusNodeId]);
        for (const link of graphData.links) {
          const sourceId = typeof link.source === "object" ? link.source.id : link.source;
          const targetId = typeof link.target === "object" ? link.target.id : link.target;
          if (sourceId === focusNodeId) focusNeighbors.add(targetId);
          if (targetId === focusNodeId) focusNeighbors.add(sourceId);
        }
        const kept = sorted.filter((n) => focusNeighbors.has(n.id));
        const rest = sorted.filter((n) => !focusNeighbors.has(n.id));
        nodes = [...kept, ...rest.slice(0, nodeLimit - kept.length)];
      } else {
        nodes = sorted.slice(0, nodeLimit);
      }
    }

    const nodeIds = new Set(nodes.map((n) => n.id));
    links = graphData.links.filter((l) => {
      const sourceId = typeof l.source === "object" ? l.source.id : l.source;
      const targetId = typeof l.target === "object" ? l.target.id : l.target;
      return nodeIds.has(sourceId) && nodeIds.has(targetId);
    });

    return { nodes, links, classes: graphData.classes };
  }, [graphData, activeFilter, nodeLimit, focusNodeId]);

  const handleNodeClick = useCallback((node) => {
    setSelectedNode(node);
  }, []);

  const handleBackgroundClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const handleClosePanel = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const handleNodeSelect = useCallback((node) => {
    setFocusNodeId(node.id);
    setSelectedNode(node);
  }, []);

  // Navigate to a node from the side panel (clicking a relation link)
  const handleNavigate = useCallback((nodeId) => {
    if (!graphData) return;
    const target = graphData.nodes.find((n) => n.id === nodeId);
    if (target) {
      setFocusNodeId(nodeId);
      setSelectedNode(target);
    }
  }, [graphData]);

  const handleFilterChange = useCallback((classUri) => {
    setActiveFilter(classUri);
    setFocusNodeId(null);
    setSelectedNode(null);
  }, []);

  if (!graphData) {
    return <div className="loading">Loading graph data…</div>;
  }

  return (
    <>
      <ExplorerPanel
        graphData={graphData}
        selectedNode={selectedNode}
        activeFilter={activeFilter}
        onFilterChange={handleFilterChange}
        onNodeSelect={handleNodeSelect}
        totalNodes={graphData.nodes.length}
        totalLinks={graphData.links.length}
        displayedNodes={displayData?.nodes.length || 0}
        displayedLinks={displayData?.links.length || 0}
        isLargeDataset={isLargeDataset}
        nodeLimit={nodeLimit}
        onNodeLimitChange={setNodeLimit}
      />
      <div className="graph-area">
        <GraphCanvas
          ref={graphRef}
          graphData={displayData}
          selectedNode={selectedNode}
          focusNodeId={focusNodeId}
          onNodeClick={handleNodeClick}
          onBackgroundClick={handleBackgroundClick}
          isLargeDataset={isLargeDataset}
        />
      </div>
      {selectedNode && (
        <SidePanel
          node={selectedNode}
          links={detailData ? detailData.allLinks : graphData.links}
          nodes={detailData ? detailData.allNodes : graphData.nodes}
          onClose={handleClosePanel}
          onNavigate={handleNavigate}
        />
      )}
    </>
  );
}
