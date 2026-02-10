import type { Metadata } from "next";
import { ArchitectureDiagram } from "./architecture-diagram";

export const metadata: Metadata = {
  title: "Architecture | Panorama Block",
  description: "Interactive architecture diagram of the Panorama Block protocol",
};

export default function DocsPage() {
  return <ArchitectureDiagram />;
}
