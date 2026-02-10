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
import "./docs.css";

const nodeTypes: NodeTypes = {
  service: ServiceNode,
};

// ── Layout constants ──
// 6 columns, evenly spaced for clean left-to-right flow
const COL = [0, 300, 620, 940, 1260, 1560];
const ROW_CENTER = 320;

// ── Nodes: clean tiered layout ──
const initialNodes: Node[] = [
  // ─── Column 0 — Entry ───
  {
    id: "user",
    type: "service",
    position: { x: COL[0], y: ROW_CENTER },
    data: {
      label: "USER",
      description: "End User / Wallet",
      icon: "User",
      status: "active",
      category: "external",
    },
  },

  // ─── Column 1 — Interface Layer ───
  {
    id: "frontend",
    type: "service",
    position: { x: COL[1], y: ROW_CENTER - 100 },
    data: {
      label: "FRONTEND",
      description: "Next.js · Vercel",
      image: "panorama",
      status: "active",
      category: "core",
    },
  },
  {
    id: "auth",
    type: "service",
    position: { x: COL[1], y: ROW_CENTER + 100 },
    data: {
      label: "AUTH SERVICE",
      description: "JWT · TON Proof · :3001",
      icon: "Shield",
      status: "active",
      category: "core",
    },
  },

  // ─── Column 2 — ZICO: The Brain ───
  {
    id: "zico",
    type: "service",
    position: { x: COL[2], y: ROW_CENTER },
    data: {
      label: "ZICO AGENT",
      description: "AI Orchestrator · Core Brain",
      image: "zico",
      status: "active",
      category: "zico",
    },
  },

  // ─── Column 3 — DeFi Modules ───
  {
    id: "liquid-swap",
    type: "service",
    position: { x: COL[3], y: ROW_CENTER - 260 },
    data: {
      label: "LIQUID SWAP",
      description: "Uniswap · DEX Aggregation · :3002",
      image: "uniswap",
      status: "active",
      category: "defi",
    },
  },
  {
    id: "lending",
    type: "service",
    position: { x: COL[3], y: ROW_CENTER - 90 },
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
    position: { x: COL[3], y: ROW_CENTER + 80 },
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
    position: { x: COL[3], y: ROW_CENTER + 250 },
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
    position: { x: COL[3], y: ROW_CENTER + 420 },
    data: {
      label: "BRIDGE",
      description: "ThirdWeb · Cross-chain · :3005",
      image: "thirdweb",
      status: "active",
      category: "defi",
    },
  },

  // ─── Column 4 — Infrastructure ───
  {
    id: "thirdweb-engine",
    type: "service",
    position: { x: COL[4], y: ROW_CENTER - 180 },
    data: {
      label: "THIRDWEB ENGINE",
      description: "ERC-4337 · Gasless Relayer",
      image: "thirdweb",
      status: "active",
      category: "external",
    },
  },
  {
    id: "database",
    type: "service",
    position: { x: COL[4], y: ROW_CENTER },
    data: {
      label: "DATABASE",
      description: "PostgreSQL · Redis",
      icon: "Database",
      status: "active",
      category: "infra",
    },
  },

  // ─── Column 5 — Blockchain ───
  {
    id: "blockchain",
    type: "service",
    position: { x: COL[5], y: ROW_CENTER },
    data: {
      label: "BLOCKCHAIN",
      description: "ETH · AVAX · TON · 7 chains",
      image: "avax",
      status: "active",
      category: "infra",
    },
  },
];

// ── Edge helpers ──
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
  animated,
  style: {
    stroke: color,
    strokeWidth: dashed ? 1.5 : 2,
    ...(dashed ? { strokeDasharray: "6 3" } : {}),
  },
  markerEnd: { type: MarkerType.ArrowClosed, color },
});

const PURPLE = "#8b5cf6";
const CYAN = "#06b6d4";
const AMBER = "#f59e0b";
const GRAY = "#475569";

// ── Edges: clean abstracted connections ──
const initialEdges: Edge[] = [
  // User → Interface
  flow("e1", "user", "frontend", PURPLE),
  flow("e2", "user", "auth", PURPLE),

  // Interface → Zico
  flow("e3", "frontend", "zico", PURPLE),
  flow("e4", "auth", "zico", PURPLE),

  // Zico → DeFi Modules (the brain orchestrates everything)
  flow("e5", "zico", "liquid-swap", CYAN),
  flow("e6", "zico", "lending", CYAN),
  flow("e7", "zico", "lido", CYAN),
  flow("e8", "zico", "dca", CYAN),
  flow("e9", "zico", "bridge", CYAN),

  // DeFi → ThirdWeb Engine (tx execution)
  flow("e10", "liquid-swap", "thirdweb-engine", GRAY, false, true),
  flow("e11", "lending", "thirdweb-engine", GRAY, false, true),
  flow("e12", "lido", "thirdweb-engine", GRAY, false, true),
  flow("e13", "dca", "thirdweb-engine", GRAY, false, true),

  // DeFi → Database (persistence)
  flow("e14", "dca", "database", GRAY, false, true),
  flow("e15", "bridge", "database", GRAY, false, true),
  flow("e16", "auth", "database", GRAY, false, true),

  // Infra → Blockchain
  flow("e17", "thirdweb-engine", "blockchain", AMBER),
  flow("e18", "database", "blockchain", AMBER, false, true),

  // Direct DeFi → Blockchain (RPC)
  flow("e19", "liquid-swap", "blockchain", GRAY, false, true),
  flow("e20", "lido", "blockchain", GRAY, false, true),
  flow("e21", "bridge", "blockchain", GRAY, false, true),
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
          <span className="docs-layer docs-layer--purple">Interface</span>
          <span className="docs-layer-arrow">&rarr;</span>
          <span className="docs-layer docs-layer--zico">AI Agent</span>
          <span className="docs-layer-arrow">&rarr;</span>
          <span className="docs-layer docs-layer--cyan">DeFi Modules</span>
          <span className="docs-layer-arrow">&rarr;</span>
          <span className="docs-layer docs-layer--amber">Infrastructure</span>
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
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.2}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#1e293b" gap={24} size={1} />
          <Controls
            position="bottom-right"
            style={{
              background: "rgba(15, 23, 42, 0.9)",
              border: "1px solid rgba(139, 92, 246, 0.3)",
              borderRadius: "12px",
              overflow: "hidden",
            }}
          />
          <MiniMap
            position="bottom-left"
            nodeColor={(node) => {
              const cat = node.data?.category;
              if (cat === "zico") return "#ec4899";
              if (cat === "core") return "#8b5cf6";
              if (cat === "defi") return "#06b6d4";
              if (cat === "infra") return "#f59e0b";
              return "#64748b";
            }}
            maskColor="rgba(15, 23, 42, 0.8)"
            style={{
              background: "rgba(15, 23, 42, 0.9)",
              border: "1px solid rgba(139, 92, 246, 0.3)",
              borderRadius: "12px",
            }}
          />
        </ReactFlow>
      </div>

      <div className="docs-legend">
        <span className="docs-legend__title">LEGEND</span>
        <div className="docs-legend__items">
          <span className="docs-legend__item">
            <span className="docs-legend__dot docs-legend__dot--purple" />
            Core Protocol
          </span>
          <span className="docs-legend__item">
            <span className="docs-legend__dot docs-legend__dot--pink" />
            Zico Agent (AI)
          </span>
          <span className="docs-legend__item">
            <span className="docs-legend__dot docs-legend__dot--cyan" />
            DeFi Module
          </span>
          <span className="docs-legend__item">
            <span className="docs-legend__dot docs-legend__dot--amber" />
            Infrastructure
          </span>
          <span className="docs-legend__item">
            <span className="docs-legend__line docs-legend__line--solid" />
            Active Data Flow
          </span>
          <span className="docs-legend__item">
            <span className="docs-legend__line docs-legend__line--dashed" />
            Service Link
          </span>
        </div>
      </div>
    </div>
  );
}
