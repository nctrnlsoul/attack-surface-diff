"use client";

import { useMemo, type CSSProperties } from "react";
import { Background, Controls, MarkerType, ReactFlow, type Edge, type Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import type { AttackGraph, AttackPath, GraphNode } from "../src/graph";
import { INTERNET } from "../src/graph";
import { layoutGraph } from "../lib/layout";
import { attackPathHighlights, edgeKey } from "../lib/viewModel";

const DANGER = "#e0483d";
const NEUTRAL_EDGE = "#cbd5e1";

function nodeStyle(node: GraphNode, onPath: boolean): CSSProperties {
  const base: CSSProperties = {
    borderRadius: 8,
    padding: "8px 12px",
    fontSize: 12,
    fontFamily: "ui-monospace, monospace",
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#334155",
    width: 180,
    textAlign: "center",
  };
  if (node.kind === "internet") {
    return { ...base, background: "#4392E6", color: "#ffffff", border: "1px solid #2f6fb8", fontFamily: "inherit", fontWeight: 600 };
  }
  if (node.isDataStore) {
    return { ...base, border: `2px solid ${onPath ? DANGER : "#d97706"}`, fontWeight: 600, color: onPath ? "#b91c1c" : "#334155" };
  }
  if (onPath) {
    return { ...base, border: `2px solid ${DANGER}`, color: "#b91c1c" };
  }
  return base;
}

export default function GraphView({ graph, paths }: { graph: AttackGraph; paths: AttackPath[] }) {
  const layout = useMemo(() => layoutGraph(graph), [graph]);
  const highlights = useMemo(() => attackPathHighlights(paths), [paths]);

  const nodes = useMemo<Node[]>(
    () =>
      graph.nodes.map((n) => ({
        id: n.id,
        position: layout.get(n.id) ?? { x: 0, y: 0 },
        data: { label: n.id === INTERNET ? "INTERNET" : n.label },
        draggable: true,
        style: nodeStyle(n, highlights.nodeIds.has(n.id)),
      })),
    [graph, layout, highlights],
  );

  const edges = useMemo<Edge[]>(
    () =>
      graph.edges.map((e) => {
        const onPath = highlights.edgeKeys.has(edgeKey(e.from, e.to));
        const color = onPath ? DANGER : NEUTRAL_EDGE;
        return {
          // Reason-qualified so two edges between the same pair never collide.
          id: `${e.from}->${e.to}:${e.reason}`,
          source: e.from,
          target: e.to,
          ...(e.detail ? { label: e.detail } : {}),
          markerEnd: { type: MarkerType.ArrowClosed, color },
          style: { stroke: color, strokeWidth: onPath ? 2.5 : 1.5 },
        };
      }),
    [graph, highlights],
  );

  return (
    <div className="h-[560px] overflow-hidden rounded-lg border border-slate-200 bg-white">
      <ReactFlow nodes={nodes} edges={edges} fitView minZoom={0.2}>
        <Background color="#e2e8f0" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
