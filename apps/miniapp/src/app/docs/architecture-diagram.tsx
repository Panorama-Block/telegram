"use client";

import React, { useCallback } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeTypes,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ServiceNode } from "./service-node";
import { GroupNode } from "./group-node";
import "./docs.css";

const nodeTypes: NodeTypes = {
  service: ServiceNode,
  group: GroupNode,
};

// ── Edge helper ──
const flow = (
  id: string,
  source: string,
  target: string,
  color: string,
  animated = true,
  dashed = false
): Edge => ({
  id,
  source,
  target,
  sourceHandle: "right",
  targetHandle: "left",
  animated,
  style: {
    stroke: color,
    strokeWidth: dashed ? 1.5 : 2,
    ...(dashed ? { strokeDasharray: "6 3" } : {}),
  },
  markerEnd: { type: MarkerType.ArrowClosed, color },
});

const CYAN = "#22d3ee";
const CYAN_DIM = "#0891b2";
const AMBER = "#f59e0b";
const PURPLE = "#7c3aed";
const MUTED = "rgba(255,255,255,0.2)";

// ── Layout ──
const ROW_CENTER = 300;

// Blockchain container
const BLOCK_X = 720;
const BLOCK_Y = 0;
const BLOCK_W = 820;
const BLOCK_H = 700;

// Engine inside blockchain
const ENGINE_X = 40;
const ENGINE_Y = 55;
const ENGINE_W = 740;
const ENGINE_H = 610;

// Protocols grid inside engine
const P_COL1 = 40;
const P_COL2 = 380;
const P_ROW1 = 55;
const P_ROW2 = 220;
const P_ROW3 = 385;

const initialNodes: Node[] = [
  // ─── Left: User → Auth → Zico ───
  {
    id: "user",
    type: "service",
    position: { x: -87, y: 304 },
    data: {
      label: "USER",
      description: "End User / Wallet",
      icon: "User",
      status: "active",
      category: "external",
    },
  },
  {
    id: "auth",
    type: "service",
    position: { x: 199, y: 302 },
    data: {
      label: "AUTH SERVICE",
      description: "JWT · TON Proof · :3001",
      icon: "Shield",
      status: "active",
      category: "core",
    },
  },
  {
    id: "zico",
    type: "service",
    position: { x: 480, y: 300 },
    data: {
      label: "ZICO AGENT",
      description: "AI Orchestrator · Core Brain",
      image: "zico",
      status: "active",
      category: "zico",
    },
  },

  // ─── Below: Database ───
  {
    id: "database",
    type: "service",
    position: { x: 1693, y: 276 },
    data: {
      label: "DATABASE",
      description: "PostgreSQL · Redis",
      icon: "Database",
      status: "active",
      category: "infra",
    },
  },

  // ─── BLOCKCHAIN: outer container ───
  {
    id: "blockchain",
    type: "group",
    position: { x: 801, y: 4 },
    data: {
      label: "BLOCKCHAIN",
      description: "ETH · AVAX · TON · 7 chains",
      image: "avax",
      variant: "blockchain",
    },
    style: { width: BLOCK_W, height: BLOCK_H },
  },

  // ─── THIRDWEB ENGINE: inner container ───
  {
    id: "thirdweb-engine",
    type: "group",
    position: { x: ENGINE_X, y: ENGINE_Y },
    parentId: "blockchain",
    data: {
      label: "THIRDWEB ENGINE",
      description: "ERC-4337 · Gasless Relayer",
      image: "thirdweb",
      variant: "engine",
    },
    style: { width: ENGINE_W, height: ENGINE_H },
  },

  // ─── Protocols INSIDE ThirdWeb Engine ───
  {
    id: "liquid-swap",
    type: "service",
    position: { x: P_COL1, y: P_ROW1 },
    parentId: "thirdweb-engine",
    extent: "parent",
    data: {
      label: "LIQUID SWAP",
      description: "Uniswap · DEX · :3002",
      image: "uniswap",
      status: "active",
      category: "defi",
    },
  },
  {
    id: "lending",
    type: "service",
    position: { x: P_COL2, y: P_ROW1 },
    parentId: "thirdweb-engine",
    extent: "parent",
    data: {
      label: "LENDING",
      description: "Benqi · Avalanche · :3006",
      image: "benqi",
      status: "beta",
      category: "defi",
    },
  },
  {
    id: "lido",
    type: "service",
    position: { x: P_COL1, y: P_ROW2 },
    parentId: "thirdweb-engine",
    extent: "parent",
    data: {
      label: "STAKING",
      description: "Lido · ETH Yield · :3004",
      image: "lido",
      status: "active",
      category: "defi",
    },
  },
  {
    id: "dca",
    type: "service",
    position: { x: P_COL2, y: P_ROW2 },
    parentId: "thirdweb-engine",
    extent: "parent",
    data: {
      label: "DCA ENGINE",
      description: "Automated Investing · :3007",
      image: "panorama",
      status: "active",
      category: "defi",
    },
  },
  {
    id: "bridge",
    type: "service",
    position: { x: P_COL1 + 170, y: P_ROW3 },
    parentId: "thirdweb-engine",
    extent: "parent",
    data: {
      label: "BRIDGE",
      description: "ThirdWeb · Cross-chain · :3005",
      image: "thirdweb",
      status: "active",
      category: "defi",
    },
  },

  // ─── Future: SNS Topic ───
  {
    id: "sns",
    type: "service",
    position: { x: 550, y: 760 },
    data: {
      label: "SNS TOPIC",
      description: "Notification · Fan-out",
      icon: "Zap",
      status: "planned",
      category: "future",
    },
  },

  // ─── Future: Messaging / Event Queue ───
  {
    id: "messaging",
    type: "service",
    position: { x: 200, y: 760 },
    data: {
      label: "MESSAGING",
      description: "Event Queue · Pub/Sub",
      icon: "MessageSquare",
      status: "planned",
      category: "future",
    },
  },
];

const initialEdges: Edge[] = [
  // User → Auth → Zico
  flow("e1", "user", "auth", CYAN),
  flow("e2", "auth", "zico", CYAN),

  // Auth → Database
  flow("e3", "auth", "database", MUTED, false, true),

  // Zico → Protocols
  flow("e5", "zico", "liquid-swap", CYAN_DIM),
  flow("e6", "zico", "lending", CYAN_DIM),
  flow("e7", "zico", "lido", CYAN_DIM),
  flow("e8", "zico", "dca", CYAN_DIM),
  flow("e9", "zico", "bridge", CYAN_DIM),

  // Protocols → Database
  flow("e10", "dca", "database", MUTED, false, true),
  flow("e11", "bridge", "database", MUTED, false, true),
  flow("e14", "liquid-swap", "database", MUTED, false, true),
  flow("e15", "lending", "database", MUTED, false, true),

  // Blockchain ↔ SNS ↔ Messaging ↔ User (future, bidirectional)
  {
    id: "e12a",
    source: "blockchain",
    sourceHandle: "bottom-src",
    target: "sns",
    targetHandle: "top",
    type: "smoothstep",
    animated: false,
    style: { stroke: PURPLE, strokeWidth: 1.5, strokeDasharray: "6 3" },
    markerStart: { type: MarkerType.ArrowClosed, color: PURPLE },
    markerEnd: { type: MarkerType.ArrowClosed, color: PURPLE },
  },
  {
    id: "e12b",
    source: "messaging",
    sourceHandle: "right",
    target: "sns",
    targetHandle: "left",
    type: "smoothstep",
    animated: false,
    style: { stroke: PURPLE, strokeWidth: 1.5, strokeDasharray: "6 3" },
    markerStart: { type: MarkerType.ArrowClosed, color: PURPLE },
    markerEnd: { type: MarkerType.ArrowClosed, color: PURPLE },
  },
  {
    id: "e13a",
    source: "messaging",
    sourceHandle: "bottom-src",
    target: "user",
    targetHandle: "bottom",
    type: "smoothstep",
    animated: false,
    style: { stroke: PURPLE, strokeWidth: 1.5, strokeDasharray: "6 3" },
    markerStart: { type: MarkerType.ArrowClosed, color: PURPLE },
    markerEnd: { type: MarkerType.ArrowClosed, color: PURPLE },
  },
];

export function ArchitectureDiagram() {
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  const onInit = useCallback(() => {}, []);

  return (
    <div className="docs-root">
      <div className="docs-glow docs-glow--purple" />
      <div className="docs-glow docs-glow--cyan" />

      <header className="docs-header">
        <div className="docs-header__content">
          <h1 className="docs-header__title">
            <span className="docs-header__title-accent">PANORAMA</span> BLOCK
          </h1>
          <p className="docs-header__subtitle">Protocol Architecture</p>
        </div>
        <div className="docs-header__layers">
          <span className="docs-layer docs-layer--purple">User</span>
          <span className="docs-layer-arrow">&rarr;</span>
          <span className="docs-layer docs-layer--purple">Auth</span>
          <span className="docs-layer-arrow">&rarr;</span>
          <span className="docs-layer docs-layer--zico">Zico Agent</span>
          <span className="docs-layer-arrow">&rarr;</span>
          <span className="docs-layer docs-layer--cyan">Protocols</span>
          <span className="docs-layer-arrow">&harr;</span>
          <span className="docs-layer docs-layer--amber" style={{backgroundColor: "rgba(255, 165, 0, 0.5)"}}>Blockchain</span>
        </div>
      </header>

      <div className="docs-canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onInit={onInit}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          minZoom={0.2}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="rgba(255,255,255,0.03)" gap={24} size={1} />
          <Controls
            position="bottom-right"
            style={{
              background: "rgba(20, 20, 20, 0.95)",
              border: "1px solid rgba(255, 0, 0, 0)",
              borderRadius: "12px",
              overflow: "hidden",
            }}
          />
          <MiniMap
            position="bottom-left"
            nodeColor={(node) => {
              const cat = node.data?.category;
              const variant = node.data?.variant;
              if (cat === "zico") return "#22d3ee";
              if (cat === "core") return "rgba(255,255,255,0.5)";
              if (cat === "defi") return "#06b6d4";
              if (cat === "future") return "#7c3aed";
              if (cat === "infra") return "#f59e0b";
              if (variant === "blockchain") return "#f59e0b";
              if (variant === "engine") return "rgba(255,255,255,0.15)";
              return "rgba(255,255,255,0.3)";
            }}
            maskColor="rgba(5, 5, 5, 0.85)"
            style={{
              background: "rgba(20, 20, 20, 0.95)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "12px",
            }}
          />
        </ReactFlow>
      </div>

      <div className="docs-legend">
        <span className="docs-legend__title">LEGEND</span>
        <div className="docs-legend__items">
          <span className="docs-legend__item">
            <span className="docs-legend__dot docs-legend__dot--pink" />
            Zico Agent
          </span>
          <span className="docs-legend__item">
            <span className="docs-legend__dot docs-legend__dot--cyan" />
            DeFi Protocol
          </span>
          <span className="docs-legend__item">
            <span className="docs-legend__dot docs-legend__dot--amber" />
            Blockchain
          </span>
          <span className="docs-legend__item">
            <span className="docs-legend__dot docs-legend__dot--future" />
            Future
          </span>
          <span className="docs-legend__item">
            <span className="docs-legend__line docs-legend__line--solid" />
            Active Flow
          </span>
          <span className="docs-legend__item">
            <span className="docs-legend__line docs-legend__line--dashed" />
            Data Link
          </span>
        </div>
      </div>
    </div>
  );
}
