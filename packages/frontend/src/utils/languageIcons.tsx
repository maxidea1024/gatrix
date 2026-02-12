import React from 'react';
import {
    Description as FileIcon,
} from '@mui/icons-material';

/**
 * Language icons sourced from Devicon (MIT License)
 * https://devicon.dev/
 * Files stored locally at /assets/lang-icons/
 */

const ICON_BASE = '/assets/lang-icons';

// Map of canonical language identifiers to their local icon filenames
const LANGUAGE_ICON_MAP: Record<string, string> = {
    // Tier 1
    typescript: `${ICON_BASE}/typescript.svg`,
    javascript: `${ICON_BASE}/javascript.svg`,
    dart: `${ICON_BASE}/dart.svg`,
    java: `${ICON_BASE}/java.svg`,
    kotlin: `${ICON_BASE}/kotlin.svg`,
    csharp: `${ICON_BASE}/csharp.svg`,
    go: `${ICON_BASE}/go.svg`,
    swift: `${ICON_BASE}/swift.svg`,
    rust: `${ICON_BASE}/rust.svg`,

    // Tier 2
    python: `${ICON_BASE}/python.svg`,
    ruby: `${ICON_BASE}/ruby.svg`,
    php: `${ICON_BASE}/php.svg`,
    c: `${ICON_BASE}/c.svg`,
    cpp: `${ICON_BASE}/cpp.svg`,
    gdscript: `${ICON_BASE}/godot.svg`,

    // Tier 3
    lua: `${ICON_BASE}/lua.svg`,
};

// Alias map: alternative names -> canonical key
const LANGUAGE_ALIASES: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    py: 'python',
    cs: 'csharp',
    golang: 'go',
    kt: 'kotlin',
    kts: 'kotlin',
    rs: 'rust',
    rb: 'ruby',
    cxx: 'cpp',
    cc: 'cpp',
    h: 'c',
    hpp: 'cpp',
    hh: 'cpp',
    gd: 'gdscript',
};

/**
 * Returns the appropriate icon for a supported language.
 * Uses locally stored Devicon SVG files for high-quality, recognizable icons.
 */
export const getLanguageIcon = (language: string | null, size: number = 16): React.ReactElement => {
    const normalized = language?.toLowerCase() || '';
    const canonical = LANGUAGE_ALIASES[normalized] || normalized;
    const iconPath = LANGUAGE_ICON_MAP[canonical];

    if (iconPath) {
        return (
            <img
                src={iconPath}
                alt={canonical}
                width={size}
                height={size}
                style={{ display: 'block' }}
            />
        );
    }

    return <FileIcon sx={{ fontSize: size, color: 'text.secondary' }} />;
};
