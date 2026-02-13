"use client";

import React, { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import Image from "next/image";

const BASE_PATH = "/miniapp";

const imageMap: Record<string, string> = {
  thirdweb: "/icons/thirdweb_logo.png",
  avax: "/icons/Avalanche_Blockchain_Logo.svg",
};

interface GroupNodeData {
  label: string;
  description: string;
  image?: string;
  variant: "blockchain" | "engine";
  [key: string]: unknown;
}

function GroupNodeComponent({ data }: NodeProps) {
  const { label, description, image, variant } = data as unknown as GroupNodeData;
  const imageSrc = image ? imageMap[image] : null;
  const isBlockchain = variant === "blockchain";

  const handleStyle = {
    background: "transparent",
    border: "none",
    width: 0,
    height: 0,
  };

  return (
    <div className={`gnode gnode--${variant}`}>
      {/* Corner accents */}
      <div className="gnode__corner gnode__corner--tl" />
      <div className="gnode__corner gnode__corner--tr" />
      <div className="gnode__corner gnode__corner--bl" />
      <div className="gnode__corner gnode__corner--br" />

      <Handle type="target" position={Position.Left} id="left" style={handleStyle} />
      <Handle type="source" position={Position.Right} id="right" style={handleStyle} />
      <Handle type="target" position={Position.Top} id="top" style={handleStyle} />
      <Handle type="source" position={Position.Top} id="top-src" style={handleStyle} />
      <Handle type="target" position={Position.Bottom} id="bottom" style={handleStyle} />
      <Handle type="source" position={Position.Bottom} id="bottom-src" style={handleStyle} />

      {/* Label badge */}
      <div className="gnode__badge">
        {imageSrc && (
          <Image
            src={`${BASE_PATH}${imageSrc}`}
            alt={label}
            width={16}
            height={16}
            className="gnode__logo"
            unoptimized
          />
        )}
        <span className="gnode__label">{label}</span>
        <span className="gnode__sep">·</span>
        <span className="gnode__desc">{description}</span>
      </div>

      {/* Subtle inner glow */}
      {isBlockchain && <div className="gnode__glow" />}
    </div>
  );
}

export const GroupNode = memo(GroupNodeComponent);
