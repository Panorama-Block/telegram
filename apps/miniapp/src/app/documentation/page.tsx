import type { Metadata } from "next";
import { DocumentationContent } from "./documentation-content";

export const metadata: Metadata = {
  title: "Documentation Hub | Panorama Block",
  description: "Panorama Block documentation hub with official guides, technical resources and architecture references.",
  alternates: {
    canonical: "/documentation",
  },
  openGraph: {
    title: "Documentation Hub | Panorama Block",
    description: "Official docs, technical resources and architecture references for Panorama Block.",
    url: "https://panoramablock.com/miniapp/documentation",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Documentation Hub | Panorama Block",
    description: "Official docs, technical resources and architecture references for Panorama Block.",
  },
};

export default function DocumentationPage() {
  return <DocumentationContent />;
}
