"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  addEdge,
  ReactFlowProvider,
  type Node,
  type Edge,
  type NodeTypes,
  type Connection,
  MarkerType,
} from "@xyflow/react";
import { toPng } from "html-to-image";
import { Download, Plus, Trash2, Pencil, Save } from "lucide-react";
import "@xyflow/react/dist/style.css";
import { ServiceNode } from "./service-node";
import { GroupNode } from "./group-node";
import { NodeModal, type NodeFormData } from "./node-modal";
import "./docs.css";

const nodeTypes: NodeTypes = {
  service: ServiceNode,
  group: GroupNode,
};

// ── API ──
const API_BASE =
  process.env.NEXT_PUBLIC_DIAGRAM_API || "http://localhost:3010";

async function fetchDiagram() {
  const res = await fetch(`${API_BASE}/diagram`);
  return res.json();
}

async function saveDiagram(nodes: Node[], edges: Edge[]) {
  await fetch(`${API_BASE}/diagram`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nodes, edges }),
  });
}

async function seedDiagram(nodes: Node[], edges: Edge[]) {
  await fetch(`${API_BASE}/diagram/seed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nodes, edges }),
  });
}

// ── Edge helper ──
const CYAN = "#22d3ee";
const CYAN_DIM = "#0891b2";

const makeEdge = (
  id: string,
  source: string,
  target: string,
  color = CYAN_DIM,
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

// ── Default seed data ──
const BLOCK_W = 820, BLOCK_H = 700;
const ENGINE_W = 740, ENGINE_H = 610;
const PURPLE = "#7c3aed";
const MUTED = "rgba(255,255,255,0.2)";

const defaultNodes: Node[] = [
  { id: "user", type: "service", position: { x: -87, y: 304 }, data: { label: "USER", description: "End User / Wallet", icon: "User", status: "active", category: "external" } },
  { id: "auth", type: "service", position: { x: 199, y: 302 }, data: { label: "AUTH SERVICE", description: "JWT · TON Proof · :3001", icon: "Shield", status: "active", category: "core" } },
  { id: "zico", type: "service", position: { x: 480, y: 300 }, data: { label: "ZICO AGENT", description: "AI Orchestrator · Core Brain", image: "zico", status: "active", category: "zico" } },
  { id: "database", type: "service", position: { x: 1693, y: 276 }, data: { label: "DATABASE", description: "PostgreSQL · Redis", icon: "Database", status: "active", category: "infra" } },
  { id: "blockchain", type: "group", position: { x: 801, y: 4 }, data: { label: "BLOCKCHAIN", description: "ETH · AVAX · TON · 7 chains", image: "avax", variant: "blockchain" }, style: { width: BLOCK_W, height: BLOCK_H } },
  { id: "thirdweb-engine", type: "group", position: { x: 40, y: 55 }, parentId: "blockchain", data: { label: "THIRDWEB ENGINE", description: "ERC-4337 · Gasless Relayer", image: "thirdweb", variant: "engine" }, style: { width: ENGINE_W, height: ENGINE_H } },
  { id: "liquid-swap", type: "service", position: { x: 40, y: 55 }, parentId: "thirdweb-engine", extent: "parent", data: { label: "LIQUID SWAP", description: "Uniswap · DEX · :3002", image: "uniswap", status: "active", category: "defi" } },
  { id: "lending", type: "service", position: { x: 380, y: 55 }, parentId: "thirdweb-engine", extent: "parent", data: { label: "LENDING", description: "Benqi · Avalanche · :3006", image: "benqi", status: "beta", category: "defi" } },
  { id: "lido", type: "service", position: { x: 40, y: 220 }, parentId: "thirdweb-engine", extent: "parent", data: { label: "STAKING", description: "Lido · ETH Yield · :3004", image: "lido", status: "active", category: "defi" } },
  { id: "dca", type: "service", position: { x: 380, y: 220 }, parentId: "thirdweb-engine", extent: "parent", data: { label: "DCA ENGINE", description: "Automated Investing · :3007", image: "panorama", status: "active", category: "defi" } },
  { id: "bridge", type: "service", position: { x: 210, y: 385 }, parentId: "thirdweb-engine", extent: "parent", data: { label: "BRIDGE", description: "ThirdWeb · Cross-chain · :3005", image: "thirdweb", status: "active", category: "defi" } },
  { id: "sns", type: "service", position: { x: 550, y: 760 }, data: { label: "SNS TOPIC", description: "Notification · Fan-out", icon: "Zap", status: "planned", category: "future" } },
  { id: "messaging", type: "service", position: { x: 200, y: 760 }, data: { label: "MESSAGING", description: "Event Queue · Pub/Sub", icon: "MessageSquare", status: "planned", category: "future" } },
];

const defaultEdges: Edge[] = [
  makeEdge("e1", "user", "auth", CYAN),
  makeEdge("e2", "auth", "zico", CYAN),
  makeEdge("e3", "auth", "database", MUTED, false, true),
  makeEdge("e5", "zico", "liquid-swap", CYAN_DIM),
  makeEdge("e6", "zico", "lending", CYAN_DIM),
  makeEdge("e7", "zico", "lido", CYAN_DIM),
  makeEdge("e8", "zico", "dca", CYAN_DIM),
  makeEdge("e9", "zico", "bridge", CYAN_DIM),
  makeEdge("e10", "dca", "database", MUTED, false, true),
  makeEdge("e11", "bridge", "database", MUTED, false, true),
  makeEdge("e14", "liquid-swap", "database", MUTED, false, true),
  makeEdge("e15", "lending", "database", MUTED, false, true),
  { id: "e12a", source: "blockchain", sourceHandle: "bottom-src", target: "sns", targetHandle: "top", type: "smoothstep", animated: false, style: { stroke: PURPLE, strokeWidth: 1.5, strokeDasharray: "6 3" }, markerStart: { type: MarkerType.ArrowClosed, color: PURPLE }, markerEnd: { type: MarkerType.ArrowClosed, color: PURPLE } },
  { id: "e12b", source: "messaging", sourceHandle: "right", target: "sns", targetHandle: "left", type: "smoothstep", animated: false, style: { stroke: PURPLE, strokeWidth: 1.5, strokeDasharray: "6 3" }, markerStart: { type: MarkerType.ArrowClosed, color: PURPLE }, markerEnd: { type: MarkerType.ArrowClosed, color: PURPLE } },
  { id: "e13a", source: "messaging", sourceHandle: "bottom-src", target: "user", targetHandle: "bottom", type: "smoothstep", animated: false, style: { stroke: PURPLE, strokeWidth: 1.5, strokeDasharray: "6 3" }, markerStart: { type: MarkerType.ArrowClosed, color: PURPLE }, markerEnd: { type: MarkerType.ArrowClosed, color: PURPLE } },
];

// ── Component ──
function DiagramInner() {
  const [nodes, setNodes, onNodesChange] = useNodesState(defaultNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(defaultEdges);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editData, setEditData] = useState<Partial<NodeFormData> | undefined>();
  const [loaded, setLoaded] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load from API
  useEffect(() => {
    fetchDiagram()
      .then((d) => {
        if (d && Array.isArray(d.nodes) && d.nodes.length > 0) {
          setNodes(d.nodes);
          setEdges(d.edges || []);
        } else {
          // Seed defaults if empty
          seedDiagram(defaultNodes, defaultEdges);
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true)); // fallback to defaults on error
  }, [setNodes, setEdges]);

  // Debounced auto-save
  const debouncedSave = useCallback(
    (n: Node[], e: Edge[]) => {
      if (!loaded) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => saveDiagram(n, e), 1500);
    },
    [loaded]
  );

  useEffect(() => {
    if (loaded) debouncedSave(nodes, edges);
  }, [nodes, edges, debouncedSave, loaded]);

  // Connect handler
  const onConnect = useCallback(
    (conn: Connection) => {
      const edge = {
        ...conn,
        id: `e-${Date.now()}`,
        animated: true,
        style: { stroke: CYAN_DIM, strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: CYAN_DIM },
      };
      setEdges((eds) => addEdge(edge, eds));
    },
    [setEdges]
  );

  // Node click → select
  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node.id);
    setSelectedEdge(null);
  }, []);

  // Edge click → select
  const onEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    setSelectedEdge(edge.id);
    setSelectedNode(null);
  }, []);

  // Pane click → deselect
  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    setSelectedEdge(null);
  }, []);

  // Add node
  const handleAddNode = useCallback(() => {
    setEditData(undefined);
    setModalOpen(true);
  }, []);

  // Edit selected node
  const handleEditNode = useCallback(() => {
    if (!selectedNode) return;
    const node = nodes.find((n) => n.id === selectedNode);
    if (!node) return;
    setEditData(node.data as Partial<NodeFormData>);
    setModalOpen(true);
  }, [selectedNode, nodes]);

  // Save from modal
  const handleModalSave = useCallback(
    (data: NodeFormData) => {
      if (editData?.label && selectedNode) {
        // Update existing
        setNodes((nds) =>
          nds.map((n) =>
            n.id === selectedNode ? { ...n, data: { ...n.data, ...data } } : n
          )
        );
      } else {
        // Create new
        const id = `node-${Date.now()}`;
        const newNode: Node = {
          id,
          type: "service",
          position: { x: 300, y: 400 },
          data: {
            ...data,
            ...(data.image ? {} : { icon: data.icon || "Boxes" }),
          },
        };
        setNodes((nds) => [...nds, newNode]);
      }
      setModalOpen(false);
      setEditData(undefined);
    },
    [editData, selectedNode, setNodes]
  );

  // Delete selected node
  const handleDeleteNode = useCallback(() => {
    if (!selectedNode) return;
    setNodes((nds) => nds.filter((n) => n.id !== selectedNode));
    setEdges((eds) =>
      eds.filter((e) => e.source !== selectedNode && e.target !== selectedNode)
    );
    setSelectedNode(null);
  }, [selectedNode, setNodes, setEdges]);

  // Delete selected edge
  const handleDeleteEdge = useCallback(() => {
    if (!selectedEdge) return;
    setEdges((eds) => eds.filter((e) => e.id !== selectedEdge));
    setSelectedEdge(null);
  }, [selectedEdge, setEdges]);

  // Manual save
  const handleManualSave = useCallback(() => {
    saveDiagram(nodes, edges);
  }, [nodes, edges]);

  // Download PNG
  const handleDownload = useCallback(() => {
    const viewport = document.querySelector(
      ".docs-canvas .react-flow__viewport"
    ) as HTMLElement | null;
    if (!viewport) return;
    toPng(viewport, {
      backgroundColor: "#050606",
      pixelRatio: 2,
      skipFonts: true,
      filter: (node) => {
        if (node?.classList?.contains("react-flow__controls")) return false;
        return true;
      },
    }).then((dataUrl) => {
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = "panorama-architecture.png";
      a.click();
    });
  }, []);

  return (
    <div className="docs-root">
      {/* Toolbar */}
      <div className="docs-toolbar">
        <div className="docs-toolbar__left">
          <button className="docs-tb-btn docs-tb-btn--primary" onClick={handleAddNode}>
            <Plus size={14} /> Add Node
          </button>
          {selectedNode && (
            <>
              <button className="docs-tb-btn" onClick={handleEditNode}>
                <Pencil size={14} /> Edit
              </button>
              <button className="docs-tb-btn docs-tb-btn--danger" onClick={handleDeleteNode}>
                <Trash2 size={14} /> Delete Node
              </button>
            </>
          )}
          {selectedEdge && (
            <button className="docs-tb-btn docs-tb-btn--danger" onClick={handleDeleteEdge}>
              <Trash2 size={14} /> Delete Edge
            </button>
          )}
        </div>
        <div className="docs-toolbar__right">
          <button className="docs-tb-btn" onClick={handleManualSave}>
            <Save size={14} /> Save
          </button>
          <button className="docs-tb-btn" onClick={handleDownload}>
            <Download size={14} /> Export PNG
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="docs-canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onEdgeClick={onEdgeClick}
          onPaneClick={onPaneClick}
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
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "12px",
              overflow: "hidden",
            }}
          />
        </ReactFlow>
      </div>

      {/* Legend */}
      <div className="docs-legend">
        <span className="docs-legend__title">LEGEND</span>
        <div className="docs-legend__items">
          <span className="docs-legend__item"><span className="docs-legend__dot docs-legend__dot--pink" /> Zico Agent</span>
          <span className="docs-legend__item"><span className="docs-legend__dot docs-legend__dot--cyan" /> DeFi Protocol</span>
          <span className="docs-legend__item"><span className="docs-legend__dot docs-legend__dot--amber" /> Blockchain</span>
          <span className="docs-legend__item"><span className="docs-legend__dot docs-legend__dot--future" /> Future</span>
          <span className="docs-legend__item"><span className="docs-legend__line docs-legend__line--solid" /> Active Flow</span>
          <span className="docs-legend__item"><span className="docs-legend__line docs-legend__line--dashed" /> Data Link</span>
        </div>
      </div>

      {/* Modal */}
      <NodeModal
        open={modalOpen}
        initial={editData}
        onSave={handleModalSave}
        onClose={() => { setModalOpen(false); setEditData(undefined); }}
      />
    </div>
  );
}

export function ArchitectureDiagram() {
  return (
    <ReactFlowProvider>
      <DiagramInner />
    </ReactFlowProvider>
  );
}
