import type { MenuFailure } from "@/application/dto/ingest-menus";

// The CLI only sees the use case DTOs, not the ports (ADR-001 §3): the source error reaches it inside a failure.
type SourceError = MenuFailure["error"];

export const describeSourceError = (error: SourceError): string => {
  switch (error.kind) {
    case "missing-raw-directory":
      return `raw directory not found: ${error.path}`;
    case "missing-file":
      return `${error.file} not found`;
    case "unreadable-document":
      return `unreadable document: ${error.reason}`;
    case "no-table":
      return "no table found";
    case "missing-header":
      return "no Lunes..Domingo header row";
    case "missing-meal-row":
      return `missing meal row (${error.meal})`;
    case "missing-section":
      return `missing section (${error.section})`;
  }
};
