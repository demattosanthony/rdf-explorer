import React, { useRef, useEffect, useCallback, useMemo, useState, forwardRef, useImperativeHandle } from "react";
import ForceGraph2D from "react-force-graph-2d";

const TYPE_COLORS = [
  "#00d4aa", "#ff6b6b", "#4ecdc4", "#ffa726", "#ab47bc",
  "#42a5f5", "#ef5350", "#66bb6a", "#ffca28", "#8d6e63",
];

function humanize(str) {
  return str.replace(/_/g, " ");
}

// Lighten a hex color by a factor (0–1)
function lighten(hex, factor) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.round(r + (255 - r) * factor)}, ${Math.round(g + (255 - g) * factor)}, ${Math.round(b + (255 - b) * factor)})`;
}

// Minimum nodes in a cluster to show its label
const MIN_CLUSTER_SIZE = 5;

const GraphCanvas = forwardRef(function GraphCanvas(
  { graphData, selectedNode, focusNodeId, onNodeClick, onBackgroundClick, isLargeDataset },
  ref
) {
  const fgRef = useRef();
  const containerRef = useRef();
  const [zoom, setZoom] = useState(1);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Track container size
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDimensions({ width: Math.floor(width), height: Math.floor(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Pre-compute color map
  const colorMap = useMemo(() => {
    const map = new Map();
    if (graphData?.classes) {
      graphData.classes.forEach((c, i) => {
        map.set(c.uri, TYPE_COLORS[i % TYPE_COLORS.length]);
      });
    }
    return map;
  }, [graphData?.classes]);

  // Pre-compute connection counts for sizing + label priority
  const connectionCounts = useMemo(() => {
    const counts = new Map();
    if (!graphData) return counts;
    for (const link of graphData.links) {
      const src = typeof link.source === "object" ? link.source.id : link.source;
      const tgt = typeof link.target === "object" ? link.target.id : link.target;
      counts.set(src, (counts.get(src) || 0) + 1);
      counts.set(tgt, (counts.get(tgt) || 0) + 1);
    }
    return counts;
  }, [graphData]);

  // Pre-compute clusters (grouped by category)
  const clusters = useMemo(() => {
    if (!graphData) return [];
    const groups = new Map();
    for (const node of graphData.nodes) {
      if (!node.category) continue;
      if (!groups.has(node.category)) {
        groups.set(node.category, { id: node.category, label: node.categoryLabel, nodes: [] });
      }
      groups.get(node.category).nodes.push(node);
    }
    // Only keep clusters with enough nodes
    return Array.from(groups.values()).filter((g) => g.nodes.length >= MIN_CLUSTER_SIZE);
  }, [graphData]);

  useImperativeHandle(ref, () => ({
    focusOnNode(nodeId) {
      if (!fgRef.current || !graphData) return;
      const node = graphData.nodes.find((n) => n.id === nodeId);
      if (node && node.x !== undefined) {
        fgRef.current.centerAt(node.x, node.y, 1000);
        fgRef.current.zoom(4, 1000);
      }
    },
  }));

  useEffect(() => {
    if (fgRef.current && graphData?.nodes?.length) {
      const delay = isLargeDataset ? 1200 : 400;
      setTimeout(() => fgRef.current.zoomToFit(400, 40), delay);
    }
  }, [graphData, isLargeDataset]);

  // Focus on a node
  useEffect(() => {
    if (!focusNodeId || !fgRef.current || !graphData) return;
    const delay = isLargeDataset ? 1500 : 500;
    const timer = setTimeout(() => {
      const node = graphData.nodes.find((n) => n.id === focusNodeId);
      if (node && node.x !== undefined) {
        fgRef.current.centerAt(node.x, node.y, 1000);
        fgRef.current.zoom(4, 1000);
      }
    }, delay);
    return () => clearTimeout(timer);
  }, [focusNodeId, graphData, isLargeDataset]);

  // Tune forces
  useEffect(() => {
    if (!fgRef.current) return;
    const fg = fgRef.current;
    if (isLargeDataset) {
      fg.d3Force("charge").strength(-50);
      fg.d3Force("link").distance(60);
    } else {
      fg.d3Force("charge").strength(-120);
      fg.d3Force("link").distance(80);
    }
  }, [isLargeDataset, graphData]);

  const handleZoom = useCallback((transform) => {
    setZoom(transform.k);
  }, []);

  // Custom canvas rendering: node circle + conditional label
  const nodeCanvasObject = useCallback((node, ctx, globalScale) => {
    if (node.x == null || node.y == null) return;

    const connections = connectionCounts.get(node.id) || 0;
    const isSelected = (selectedNode && node.id === selectedNode.id) ||
                       (focusNodeId && node.id === focusNodeId);

    const color = colorMap.get(node.type) || "#666666";

    // Node radius: base size scaled by connections
    const r = isSelected ? 5 : Math.max(2.5, Math.min(6, 1.5 + connections * 0.4));

    // Outer glow for selected node
    if (isSelected) {
      const glow = ctx.createRadialGradient(node.x, node.y, r, node.x, node.y, r * 4);
      glow.addColorStop(0, "rgba(255, 255, 255, 0.15)");
      glow.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.beginPath();
      ctx.arc(node.x, node.y, r * 4, 0, 2 * Math.PI);
      ctx.fillStyle = glow;
      ctx.fill();
    }

    // Subtle glow halo for all visible nodes
    if (globalScale > 0.6) {
      const halo = ctx.createRadialGradient(node.x, node.y, r * 0.5, node.x, node.y, r * 2.5);
      halo.addColorStop(0, isSelected ? "rgba(255,255,255,0.12)" : color.replace(")", ",0.10)").replace("rgb(", "rgba("));
      halo.addColorStop(1, "rgba(0,0,0,0)");
      ctx.beginPath();
      ctx.arc(node.x, node.y, r * 2.5, 0, 2 * Math.PI);
      ctx.fillStyle = halo;
      ctx.fill();
    }

    // Main node: gradient fill
    const grad = ctx.createRadialGradient(node.x - r * 0.3, node.y - r * 0.3, 0, node.x, node.y, r);
    if (isSelected) {
      grad.addColorStop(0, "#ffffff");
      grad.addColorStop(1, "#b0b0b0");
    } else {
      grad.addColorStop(0, lighten(color, 0.3));
      grad.addColorStop(1, color);
    }

    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
    ctx.fillStyle = grad;
    ctx.fill();

    // Thin border ring
    ctx.strokeStyle = isSelected ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.08)";
    ctx.lineWidth = isSelected ? 1.2 : 0.5;
    ctx.stroke();

    // Node labels: show based on zoom level and node importance
    const labelThreshold =
      globalScale > 3   ? 0 :
      globalScale > 1.5 ? 3 :
      globalScale > 0.8 ? 8 :
      globalScale > 0.4 ? 15 :
      999;

    const showLabel = isSelected || connections >= labelThreshold;

    if (showLabel) {
      const displayLabel = node.properties?.label?.[0] || humanize(node.label);
      const fontSize = Math.max(10, Math.min(14, 12 / globalScale));

      ctx.font = `500 ${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
      const text = displayLabel;

      const textWidth = ctx.measureText(text).width;
      const padX = 5 / globalScale;
      const padY = 2.5 / globalScale;
      const yOffset = r + fontSize * 0.8;
      const pillH = fontSize * 0.75;
      const pillR = pillH / 2;

      // Label background pill
      ctx.fillStyle = "rgba(8, 8, 8, 0.82)";
      ctx.beginPath();
      ctx.roundRect(
        node.x - textWidth / 2 - padX,
        node.y + yOffset - pillH / 2,
        textWidth + padX * 2,
        pillH,
        pillR
      );
      ctx.fill();

      // Subtle border on pill
      ctx.strokeStyle = isSelected ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.05)";
      ctx.lineWidth = 0.5;
      ctx.stroke();

      // Label text
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = isSelected ? "#ffffff" : "rgba(210, 210, 210, 0.92)";
      ctx.fillText(text, node.x, node.y + yOffset);
    }
  }, [colorMap, connectionCounts, selectedNode, focusNodeId]);

  // Draw cluster labels on top of everything when zoomed out
  const onRenderFramePost = useCallback((ctx, globalScale) => {
    // Only show cluster labels when zoomed out enough that individual labels are sparse
    if (globalScale > 1.2) return;

    for (const cluster of clusters) {
      // Compute centroid of cluster nodes that have positions
      let sumX = 0, sumY = 0, count = 0;
      for (const node of cluster.nodes) {
        if (node.x !== undefined && node.y !== undefined) {
          sumX += node.x;
          sumY += node.y;
          count++;
        }
      }
      if (count === 0) continue;

      const cx = sumX / count;
      const cy = sumY / count;

      // Font size: bigger when more zoomed out, caps at a readable size
      const fontSize = Math.min(48, Math.max(18, 28 / globalScale));

      // Fade in as we zoom out: fully visible below 0.6, start appearing at 1.2
      const opacity = Math.min(1, Math.max(0, (1.2 - globalScale) / 0.6)) * 0.6;
      if (opacity <= 0) continue;

      ctx.save();
      ctx.font = `700 ${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // Draw text with background for readability
      const text = cluster.label;
      const textWidth = ctx.measureText(text).width;
      const padX = fontSize * 0.4;
      const padY = fontSize * 0.25;

      ctx.fillStyle = `rgba(10, 10, 10, ${opacity * 0.6})`;
      ctx.beginPath();
      ctx.roundRect(
        cx - textWidth / 2 - padX,
        cy - fontSize / 2 - padY,
        textWidth + padX * 2,
        fontSize + padY * 2,
        fontSize * 0.2
      );
      ctx.fill();

      ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
      ctx.fillText(text, cx, cy);

      // Subtle count underneath
      const countText = `${cluster.nodes.length}`;
      const countSize = fontSize * 0.4;
      ctx.font = `400 ${countSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
      ctx.fillStyle = `rgba(255, 255, 255, ${opacity * 0.4})`;
      ctx.fillText(countText, cx, cy + fontSize * 0.55);

      ctx.restore();
    }
  }, [clusters]);

  // Hit area for pointer detection — covers both the node circle and its label
  const nodePointerAreaPaint = useCallback((node, color, ctx, globalScale) => {
    const connections = connectionCounts.get(node.id) || 0;
    const r = Math.max(4, Math.min(8, 2 + connections * 0.5));

    // Always paint circle hit area
    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();

    // If a label would be visible at this zoom, extend hit area to cover it
    const isSelected = (selectedNode && node.id === selectedNode.id) ||
                       (focusNodeId && node.id === focusNodeId);
    const labelThreshold =
      globalScale > 3   ? 0 :
      globalScale > 1.5 ? 3 :
      globalScale > 0.8 ? 8 :
      globalScale > 0.4 ? 15 :
      999;
    const showLabel = isSelected || connections >= labelThreshold;

    if (showLabel) {
      const displayLabel = node.properties?.label?.[0] || humanize(node.label);
      const fontSize = Math.max(10, Math.min(14, 12 / globalScale));
      ctx.font = `500 ${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
      const halfWidth = Math.max(60 / globalScale, ctx.measureText(displayLabel).width / 2 + 6 / globalScale);
      const yOffset = r + fontSize * 0.8;
      ctx.fillRect(node.x - halfWidth, node.y - r, halfWidth * 2, r * 2 + fontSize * 1.2);
    }
  }, [connectionCounts, selectedNode, focusNodeId]);

  if (!graphData) return null;

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%" }}>
      <ForceGraph2D
        ref={fgRef}
        width={dimensions.width}
        height={dimensions.height}
        graphData={graphData}
        nodeId="id"
        nodeLabel={(node) => node.properties?.label?.[0] || humanize(node.label)}
        nodeCanvasObject={nodeCanvasObject}
        nodePointerAreaPaint={nodePointerAreaPaint}
        onRenderFramePost={onRenderFramePost}
        linkColor={() => "rgba(255,255,255,0.06)"}
        linkWidth={0.4}
        linkDirectionalArrowLength={3.5}
        linkDirectionalArrowRelPos={1}
        linkDirectionalArrowColor={() => "rgba(255,255,255,0.12)"}
        linkCurvature={0.07}
        backgroundColor="#0a0a0a"
        onNodeClick={onNodeClick}
        onBackgroundClick={onBackgroundClick}
        onZoom={handleZoom}
        warmupTicks={isLargeDataset ? 100 : 0}
        cooldownTicks={isLargeDataset ? 300 : Infinity}
        enableNodeDrag={true}
        minZoom={0.1}
        maxZoom={20}
      />
    </div>
  );
});

export default GraphCanvas;
