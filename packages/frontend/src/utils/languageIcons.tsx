import React from 'react';
import {
    Code as CodeIcon,
    Description as FileIcon,
} from '@mui/icons-material';

/**
 * Language Icons using SVG data from popular open source sets (DevIcon, VS Code)
 * These are high-quality, recognizable icons for developers.
 */

const TypeScriptIcon = ({ size = 16 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 128 128">
        <path fill="#3178C6" d="M1.503 1.859h124.966v124.417H1.503z" />
        <path fill="#FFF" d="M118.91 104.79c-1.34 7.42-7.1 12.39-16.14 12.39-9.52 0-16.14-5.26-17.75-15h8.92c1.07 4.96 4.3 7.57 8.83 7.57 4.88 0 7.37-2.3 7.37-6.04 0-4.13-2.6-5.83-8.88-8.48-9.43-3.95-15.61-7.94-15.61-17.58 0-8.92 6.77-15.25 16.5-15.25 9.1 0 14.89 4.3 16.42 12.42h-8.7c-.88-3.9-3.41-6.19-7.79-6.19-4.13 0-7.37 2.15-7.37 5.75 0 3.75 2.1 5.31 7.82 7.79 10.61 4.54 16.63 8.35 16.63 18.23 0 .14-.13 2.19-.25 2.39zM80.44 63.38v7.22h-13.6v45.96h-9.2V70.6h-13.6v-7.22h36.4z" />
    </svg>
);

const JavaScriptIcon = ({ size = 16 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 128 128">
        <path fill="#F7DF1E" d="M1.503 1.859h124.966v124.417H1.503z" />
        <path d="M114.77 101.89c-1.29 7.15-6.84 11.94-15.55 11.94-9.17 0-15.56-5.07-17.11-14.45h8.59c1.03 4.78 4.14 7.3 8.51 7.3 4.7 0 7.1-2.22 7.1-5.82 0-3.98-2.5-5.62-8.56-8.17-9.08-3.8-15.04-7.65-15.04-16.94 0-8.6 6.52-14.7 15.9-14.7 8.77 0 14.35 4.14 15.82 11.97h-8.38c-.85-3.76-3.29-5.97-7.51-5.97-3.98 0-7.1 2.07-7.1 5.54 0 3.62 2.02 5.12 7.54 7.5 10.22 4.37 16.03 8.05 16.03 17.57 0 .14-.14 2.19-.24 2.39zM76.4 103.73c.12 1.24 1 2.06 2.29 2.06 1.31 0 2.14-.66 2.14-2.06v-37.4h8.38v37.49c0 5.48-3.41 8.04-8.24 8.04-4.8 0-7.94-2.51-8.46-7.13h3.89z" />
    </svg>
);

const LuaIcon = ({ size = 16 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 128 128">
        <path fill="#000080" d="M64 4c-33.1 0-60 26.9-60 60s26.9 60 60 60 60-26.9 60-60-26.9-60-60-60zm0 10c27.6 0 50 22.4 50 50s-22.4 50-50 50-50-22.4-50-50 22.4-50 50-50z" />
        <circle cx="64" cy="64" r="30" fill="#000080" />
        <circle cx="108" cy="20" r="16" fill="#000080" />
    </svg>
);

const PythonIcon = ({ size = 16 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 128 128">
        <path fill="#3776AB" d="M64.1 4c-17.1 0-16 7.4-16 7.4v10.3h16.4v2.3H41.8c-10.3 0-18.6 8.9-18.6 19.3v14.4c0 10.3 8.3 18.6 18.6 18.6h5.6V67.7c0-10.1 8.5-18.4 18.6-18.4h19V30.3c0-17.1-13-26.3-30.9-26.3zm-10.4 7.6c2.5 0 4.5 2 4.5 4.5s-2 4.5-4.5 4.5-4.5-2-4.5-4.5 2.1-4.5 4.5-4.5z" />
        <path fill="#FFE052" d="M63.9 124c17.1 0 16-7.4 16-7.4v-10.3H63.5v-2.3h22.7c10.3 0 18.6-8.9 18.6-19.3V70.3c0-10.3-8.3-18.6-18.6-18.6h-5.6v8.6c0 10.1-8.5 18.4-18.6 18.4h-19v19c0 17.1 13 26.3 30.9 26.3zm10.4-7.6c-2.5 0-4.5-2-4.5-4.5s2-4.5 4.5-4.5 4.5 2 4.5 4.5-2 4.5-4.5 4.5z" />
    </svg>
);

const JavaIcon = ({ size = 16 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 128 128">
        <path fill="#5382A1" d="M96.7 94.3c-2.8 1.4-8 2.7-14.7 3.5-3.1 3-7.5 5.5-12.7 7.2-2.1.8-4.5 1.3-6.9 1.7 1.5.7 3.2 1.2 5.3 1.2 2 0 3.7-.4 5.3-.9 5-1.5 9-3.8 11.9-6.3.3-.2.6-.4.9-.6.2-.2.5-.4.7-.6.1-.2.4-.2.2-5.2z" />
        <path fill="#5382A1" d="M57 114c-13.7 0-21.7-4-21.7-8 0-1.8.4-3 2.1-4 1.7-1.1 4.5-2 8.5-2.7 0 .5-.1 1-.1 1.4-.1 2.5.3 4.1.8 5.6 1.7 4.1 6.8 6.5 14.5 7.6-1.4.1-2.8.2-4.1.1z" />
        <path fill="#EA2D2E" d="M102 59c-6.8-4.3-33-3.1-33-3.1s-10.1-1.2-12.2 4c-2.6 6.3 7 9.5 7.1 9.5s-14.1 2-15 14c-1.2 14.3 22 18.1 22 18.1s-16.1 4.8-17.7 13.9c-2.1 12.1 22.1 16.2 38 10 13.1-5.1 8-16.1 8-16.1s13-2.1 16-11.2c2.8-8.1-1-12.2-1-12.2s11.3-4.1 10.5-18.4c-.6-10.6-12.7-8.5-12.7-8.5z" />
    </svg>
);

const CSharpIcon = ({ size = 16 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 128 128">
        <path fill="#239120" d="M107 107H21V21h86v86zM32 32v64h64V32H32z" />
        <path fill="#239120" d="M82.8 54.1l2.4-1.4c-.4-.9-1.1-1.4-2.4-1.4-1.1 0-1.9.5-1.9 1.4 0 1 .6 1.4 2 2l.9.4c2.5 1.1 4.1 2.4 4.1 5 0 2.6-2 4.4-4.6 4.4-2.9 0-4.7-1.5-5.3-3.2l2.4-1.4c.4.9 1.1 1.8 2.8 1.8 1.3 0 2.1-.6 2.1-1.5 0-1.1-.9-1.5-2.5-2.2l-.9-.4c-2.5-1.1-4.1-2.4-4.1-5 0-2.6 1.9-4.4 4.6-4.4 2.2 0 3.9 1 4.7 2.7l.3-.6zM58 52v12.2c0 3.1 2 4.5 4.9 4.5 2.8 0 4.7-1.4 5-4.4l-2.7 0c-.1 1.3-.6 2.3-1.6 2.3-1 0-1.3-.8-1.3-2.3V52H58zm-11.6 13h1.8v1.8h-1.8V65zm-2.4-1h-1.8v1.4h1.8V64zm2.4 0V62h-1.8v2h1.8zm2.4 0h1.8v-1.4h-1.8V64z" />
    </svg>
);

const DartIcon = ({ size = 16 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 128 128">
        <path fill="#0175C2" d="M64 4L16 52 32 124 64 112 96 124 112 52 64 4z" />
        <path fill="#13B9FD" d="M64 112L96 124 112 52 64 36v76z" />
        <path fill="#01579B" d="M16 52L32 124 64 112V36L16 52z" />
    </svg>
);

/**
 * Returns the appropriate icon for a supported language.
 */
export const getLanguageIcon = (language: string | null, size: number = 16): React.ReactElement => {
    const normalized = language?.toLowerCase() || '';
    const sx = { fontSize: size };

    switch (normalized) {
        case 'typescript':
        case 'ts':
        case 'tsx':
            return <TypeScriptIcon size={size} />;
        case 'javascript':
        case 'js':
        case 'jsx':
            return <JavaScriptIcon size={size} />;
        case 'lua':
            return <LuaIcon size={size} />;
        case 'python':
        case 'py':
            return <PythonIcon size={size} />;
        case 'java':
            return <JavaIcon size={size} />;
        case 'csharp':
        case 'cs':
            return <CSharpIcon size={size} />;
        case 'dart':
            return <DartIcon size={size} />;
        case 'go':
        case 'golang':
            return <CodeIcon sx={{ ...sx, color: '#00ADD8' }} />;
        case 'kotlin':
        case 'kt':
            return <CodeIcon sx={{ ...sx, color: '#7F52FF' }} />;
        case 'rust':
        case 'rs':
            return <CodeIcon sx={{ ...sx, color: '#000000' }} />;
        case 'ruby':
        case 'rb':
            return <CodeIcon sx={{ ...sx, color: '#CC342D' }} />;
        case 'c':
        case 'cpp':
        case 'cxx':
        case 'h':
        case 'hpp':
            return <CodeIcon sx={{ ...sx, color: '#00599C' }} />;
        case 'php':
            return <CodeIcon sx={{ ...sx, color: '#777BB4' }} />;
        case 'swift':
            return <CodeIcon sx={{ ...sx, color: '#F05138' }} />;
        default:
            return <FileIcon sx={{ ...sx, color: 'text.secondary' }} />;
    }
};
