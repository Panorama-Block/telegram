import type { Metadata } from "next";
import { DocsContent } from "./docs-content";

export const metadata: Metadata = {
  title: "Architecture | Panorama Block",
  description: "Interactive architecture diagram of the Panorama Block protocol",
};

export default function DocsPage() {
  return <DocsContent />;
}
