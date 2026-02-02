// Vite plugin to import INI files as flat JavaScript objects
// Does NOT convert dot notation to nested objects - keeps keys as-is

import { Plugin } from "vite";
import fs from "fs";

function parseIni(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith(";"))
      continue;

    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;

    const key = trimmed.substring(0, eqIndex);
    const value = trimmed.substring(eqIndex + 1);

    // Keep flat - no nested object conversion
    result[key] = value;
  }

  return result;
}

export default function iniPlugin(): Plugin {
  return {
    name: "vite-plugin-ini",
    transform(code, id) {
      if (!id.endsWith(".ini")) return null;

      const content = fs.readFileSync(id, "utf-8");
      const parsed = parseIni(content);

      return {
        code: `export default ${JSON.stringify(parsed)};`,
        map: null,
      };
    },
  };
}
