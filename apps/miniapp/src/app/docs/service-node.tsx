"use client";

import React, { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  User,
  Monitor,
  Shield,
  Database,
  Boxes,
  Zap,
  MessageSquare,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";

/* ── Icon fallback map (only for nodes without brand images) ── */
const iconMap: Record<string, LucideIcon> = {
  User,
  Monitor,
  Shield,
  Database,
  Boxes,
  Zap,
  MessageSquare,
};

/* ── Brand image map (basePath-relative paths from /public) ── */
const imageMap: Record<string, string> = {
  zico: "/icons/zico_blue.svg",
  benqi: "/icons/benqui_logo.png",
  lido: "/icons/lido_logo.png",
  avax: "/icons/Avalanche_Blockchain_Logo.svg",
  thirdweb: "/icons/thirdweb_logo.png",
  uniswap: "/icons/uniswap.svg",
  panorama: "/panorama_block.svg",
  swap: "/icons/Swap.svg",
};

type Status = "active" | "beta" | "inactive" | "planned";
type Category = "core" | "defi" | "external" | "infra" | "zico" | "future";

interface ServiceNodeData {
  label: string;
  description: string;
  icon?: string;
  image?: string;
  status: Status;
  category: Category;
  [key: string]: unknown;
}

const statusConfig: Record<Status, { label: string; className: string }> = {
  active: { label: "ACTIVE", className: "snode-badge--active" },
  beta: { label: "BETA", className: "snode-badge--beta" },
  inactive: { label: "INACTIVE", className: "snode-badge--inactive" },
  planned: { label: "PLANNED", className: "snode-badge--planned" },
};

const categoryClass: Record<Category, string> = {
  core: "snode--core",
  defi: "snode--defi",
  external: "snode--external",
  infra: "snode--infra",
  zico: "snode--zico",
  future: "snode--future",
};

const handleColor: Record<Category, string> = {
  core: "#8b5cf6",
  defi: "#06b6d4",
  external: "#64748b",
  infra: "#f59e0b",
  zico: "#ec4899",
  future: "#7c3aed",
};

const BASE_PATH = "/miniapp";

function ServiceNodeComponent({ data }: NodeProps) {
  const { label, description, icon, image, status, category } =
    data as unknown as ServiceNodeData;

  const { label: statusLabel, className: statusClass } = statusConfig[status];
  const nodeClass = categoryClass[category];
  const hColor = handleColor[category];

  const imageSrc = image ? imageMap[image] : null;
  const FallbackIcon = icon ? iconMap[icon] : null;

  const invisibleHandle = {
    background: "transparent",
    border: "none",
    width: 0,
    height: 0,
  };

  const visibleHandle = {
    background: hColor,
    border: `2px solid ${hColor}`,
    width: 10,
    height: 10,
    boxShadow: `0 0 8px ${hColor}`,
  };

  return (
    <div className={`snode ${nodeClass}`}>
      {/* Main visible handles */}
      <Handle type="target" position={Position.Left} id="left" style={visibleHandle} />
      <Handle type="source" position={Position.Right} id="right" style={visibleHandle} />
      {/* Extra invisible handles for flexible routing */}
      <Handle type="target" position={Position.Top} id="top" style={invisibleHandle} />
      <Handle type="source" position={Position.Top} id="top-src" style={invisibleHandle} />
      <Handle type="target" position={Position.Bottom} id="bottom" style={invisibleHandle} />
      <Handle type="source" position={Position.Bottom} id="bottom-src" style={invisibleHandle} />

      <div className="snode__inner">
        <div className={`snode__icon-wrap ${imageSrc ? "snode__icon-wrap--img" : ""}`}>
          {imageSrc ? (
            <Image
              src={`${BASE_PATH}${imageSrc}`}
              alt={label}
              width={category === "zico" ? 32 : 24}
              height={category === "zico" ? 32 : 24}
              className="snode__brand-img"
              unoptimized
            />
          ) : FallbackIcon ? (
            <FallbackIcon size={20} strokeWidth={1.5} />
          ) : (
            <Boxes size={20} strokeWidth={1.5} />
          )}
        </div>
        <div className="snode__text">
          <span className="snode__label">{label}</span>
          <span className="snode__desc">{description}</span>
        </div>
      </div>

      <div className={`snode-badge ${statusClass}`}>{statusLabel}</div>
    </div>
  );
}

export const ServiceNode = memo(ServiceNodeComponent);
