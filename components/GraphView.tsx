"use client";

import { useMemo, type CSSProperties } from "react";
import {
  Background,
  Controls,
  MarkerType,
  Panel,
  ReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import type { ResourceSet } from "../src/parser";
import { INTERNET } from "../src/graph";
import type { CombinedNode, CombinedView } from "../lib/combinedView";
import { associationEdges } from "../lib/associations";

const DANGER = "#e0483d";
const SAFE = "#2fa36b";
const NEUTRAL_EDGE = "#cbd5e1";

type Side = "before" | "after";

/** Drop the "from <cidr>" tail; the INTERNET source already implies it. */
function shortLabel(detail: string | null): string | null {
  if (detail === null) return null;
  const idx = detail.indexOf(" from ");
  return idx === -1 ? detail : detail.slice(0, idx);
}

function nodeStyle(node: CombinedNode, onPath: boolean, fadingGreen: boolean): CSSProperties {
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
  if (fadingGreen) {
    return { ...base, border: `2px solid ${SAFE}`, color: SAFE };
  }
  if (node.isDataStore) {
    return { ...base, border: `2px solid ${onPath ? DANGER : "#d97706"}`, fontWeight: 600, color: onPath ? "#b91c1c" : "#334155" };
  }
  if (onPath) {
    return { ...base, border: `2px solid ${DANGER}`, color: "#b91c1c" };
  }
  return base;
}

export default function GraphView({
  combined,
  side,
  resourceSet,
}: {
  combined: CombinedView;
  side: Side;
  resourceSet: ResourceSet;
}) {
  const activePaths = side === "after" ? combined.after : combined.before;
  const reachable = side === "after" ? combined.reachableAfter : combined.reachableBefore;

  const nodes = useMemo<Node[]>(
    () =>
      combined.nodes.map((n) => {
        const present = side === "before" ? n.inBefore : n.inAfter;
        const position = side === "before" ? n.posBefore : n.posAfter;
        const onPath = activePaths.nodeIds.has(n.id);
        const isAdded = combined.added.nodeIds.has(n.id);
        const isRemoved = combined.removed.nodeIds.has(n.id);
        // Green only what actually leaves in "after"; an element on a removed
        // path may still exist (e.g. db-sg->rds persists after the internet edge
        // closes) and must not render solid green.
        const fadingGreen = isRemoved && side === "after" && !present;
        const glow = isAdded && side === "after" && present;
        return {
          id: n.id,
          position,
          data: { label: n.id === INTERNET ? "INTERNET" : n.label },
          draggable: false,
          className: glow ? "asd-node asd-glow" : "asd-node",
          style: { ...nodeStyle(n, onPath, fadingGreen), opacity: present ? 1 : 0 },
        };
      }),
    [combined, side, activePaths],
  );

  const edges = useMemo<Edge[]>(() => {
    const diffEdges: Edge[] = combined.edges.map((e) => {
      const present = side === "before" ? e.inBefore : e.inAfter;
      const onPath = activePaths.edgeKeys.has(e.key);
      const isAdded = combined.added.edgeKeys.has(e.key);
      const isRemoved = combined.removed.edgeKeys.has(e.key);
      const fadingGreen = isRemoved && side === "after";
      const color = fadingGreen ? SAFE : onPath ? DANGER : NEUTRAL_EDGE;
      const label = shortLabel(e.detail);
      return {
        id: e.id,
        source: e.from,
        target: e.to,
        className: isAdded && side === "after" && present ? "asd-edge asd-edge-glow" : "asd-edge",
        ...(label ? { label } : {}),
        labelBgStyle: { fill: "#ffffff", fillOpacity: 0.85 },
        labelBgPadding: [4, 2] as [number, number],
        labelStyle: { fontSize: 10, fill: "#64748b" },
        markerEnd: { type: MarkerType.ArrowClosed, color },
        style: { stroke: color, strokeWidth: onPath ? 2.5 : 1.5, opacity: present ? 1 : 0 },
      };
    });

    // UI-only dashed edges tying an S3 public-access block to its bucket.
    const assocEdges: Edge[] = associationEdges(resourceSet).map((a) => ({
      id: `assoc:${a.from}->${a.to}`,
      source: a.from,
      target: a.to,
      className: "asd-edge",
      style: { stroke: "#94a3b8", strokeWidth: 1.25, strokeDasharray: "4 3", opacity: 0.7 },
    }));

    return [...diffEdges, ...assocEdges];
  }, [combined, side, activePaths, resourceSet]);

  const hasIsolated = combined.nodes.some((n) => {
    const present = side === "before" ? n.inBefore : n.inAfter;
    return present && n.id !== INTERNET && !reachable.has(n.id);
  });

  return (
    <div className="h-[560px] overflow-hidden rounded-lg border border-slate-200 bg-white">
      <ReactFlow nodes={nodes} edges={edges} fitView minZoom={0.2} nodesDraggable={false}>
        <Background color="#e2e8f0" />
        <Controls showInteractive={false} />
        {hasIsolated && (
          <Panel
            position="bottom-left"
            className="rounded border border-slate-200 bg-white/90 px-2 py-1 text-[11px] text-slate-500"
          >
            Bottom lane: not reachable from the internet
          </Panel>
        )}
      </ReactFlow>
    </div>
  );
}
