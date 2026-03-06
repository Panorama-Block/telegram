export const OFFICIAL_DOCS_BASE = "https://docs.panoramablock.com";
export const OFFICIAL_DOCS_HOME = `${OFFICIAL_DOCS_BASE}/`;
export const INTERNAL_ARCHITECTURE_PATH = "/docs";

export interface DocLink {
  title: string;
  description: string;
  href: string;
  lastUpdated?: string;
}

export interface DocCategory {
  id: string;
  title: string;
  description: string;
  links: DocLink[];
}

export interface DocResource {
  title: string;
  description: string;
  href: string;
  external: boolean;
}

const toOfficialDocUrl = (path: string) => {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${OFFICIAL_DOCS_BASE}${normalized}`;
};

export const documentationCategories: DocCategory[] = [
  {
    id: "overview",
    title: "Overview",
    description: "Start with the product vision and top-level documentation.",
    links: [
      {
        title: "Documentation Home",
        description: "Entry point for all Panorama Block technical and product docs.",
        href: toOfficialDocUrl("/"),
      },
      {
        title: "Our Vision",
        description: "Mission, positioning and long-term direction.",
        href: toOfficialDocUrl("/overview/our-vision"),
      },
    ],
  },
  {
    id: "core-infrastructure",
    title: "Core Infrastructure",
    description: "Core architecture and operational components behind the protocol.",
    links: [
      {
        title: "Technical Architecture",
        description: "System-level architecture, layers and core services.",
        href: toOfficialDocUrl("/core-infrastructure/technical-architecture"),
      },
      {
        title: "The Zico Agent",
        description: "How the agent layer orchestrates workflows and actions.",
        href: toOfficialDocUrl("/core-infrastructure/the-zico-agent"),
      },
    ],
  },
  {
    id: "verticals",
    title: "Verticals",
    description: "Functional pillars and product tracks across the ecosystem.",
    links: [
      {
        title: "DeFi Vista",
        description: "DeFi vertical overview and integration surface.",
        href: toOfficialDocUrl("/our-verticals/defi-vista"),
      },
      {
        title: "Panorama Chain View",
        description: "Cross-chain observability and analytics layer.",
        href: toOfficialDocUrl("/our-verticals/panorama-chain-view"),
      },
      {
        title: "AI Marketplace",
        description: "Marketplace mechanics and agent-facing capabilities.",
        href: toOfficialDocUrl("/our-verticals/ai-marketplace"),
      },
    ],
  },
  {
    id: "tokenomics",
    title: "Tokenomics",
    description: "Utility design and revenue architecture.",
    links: [
      {
        title: "Token Utility",
        description: "Token purpose, usage and economic role.",
        href: toOfficialDocUrl("/tokenomics/token-utility"),
      },
      {
        title: "Revenue Streams",
        description: "How value is captured across protocol operations.",
        href: toOfficialDocUrl("/tokenomics/revenue-streams"),
      },
    ],
  },
];

export const technicalResources: DocResource[] = [
  {
    title: "Architecture Diagram",
    description: "Internal technical view of Panorama Block components.",
    href: INTERNAL_ARCHITECTURE_PATH,
    external: false,
  },
  {
    title: "Official Documentation",
    description: "Open full official docs in a dedicated tab.",
    href: OFFICIAL_DOCS_HOME,
    external: true,
  },
];
