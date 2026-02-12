"use client";

import { SeniorAppShell } from "@/components/layout";
import { ArchitectureDiagram } from "./architecture-diagram";

export function DocsContent() {
  return (
    <SeniorAppShell pageTitle="Architecture">
      <ArchitectureDiagram />
    </SeniorAppShell>
  );
}
