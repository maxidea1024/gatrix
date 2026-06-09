import React, { useState } from 'react';
import { Box, Typography, Collapse, useTheme } from '@mui/material';
import { ExpandMore as ExpandMoreIcon, ChevronRight as ChevronRightIcon } from '@mui/icons-material';
import { AttrTreeNode } from './types';
import { AttrRow } from './AttrRow';

export function buildAttrTree(entries: [string, string][]): AttrTreeNode[] {
  const root: AttrTreeNode[] = [];

  for (const [fullKey, value] of entries) {
    const parts = fullKey.split('.');
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const segment = parts[i];
      const isLast = i === parts.length - 1;
      const partialKey = parts.slice(0, i + 1).join('.');

      let existing = current.find((n) => n.key === segment);
      if (!existing) {
        existing = {
          key: segment,
          fullKey: partialKey,
          value: isLast ? value : undefined,
          children: [],
        };
        current.push(existing);
      } else if (isLast) {
        existing.value = value;
        existing.fullKey = partialKey;
      }
      current = existing.children;
    }
  }

  return root;
}

export const AttrTreeRenderer: React.FC<{
  nodes: AttrTreeNode[];
  depth: number;
  isDark: boolean;
  onFilter: (key: string, value: string, exclude: boolean) => void;
}> = ({ nodes, depth, isDark, onFilter }) => {
  return (
    <>
      {nodes.map((node) => {
        const isGroup = node.children.length > 0;
        if (isGroup) {
          return (
            <TreeGroupNode
              key={node.fullKey}
              node={node}
              depth={depth}
              isDark={isDark}
              onFilter={onFilter}
            />
          );
        }
        return (
          <Box key={node.fullKey} sx={{ pl: depth * 1.5 }}>
            <AttrRow
              label={node.key}
              value={node.value || ''}
              isDark={isDark}
              onFilter={(_, v, ex) => onFilter(node.fullKey, v, ex)}
            />
          </Box>
        );
      })}
    </>
  );
};

export const TreeGroupNode: React.FC<{
  node: AttrTreeNode;
  depth: number;
  isDark: boolean;
  onFilter: (key: string, value: string, exclude: boolean) => void;
}> = ({ node, depth, isDark, onFilter }) => {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(true);

  return (
    <Box>
      <Box
        onClick={() => setExpanded((e) => !e)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          pl: depth * 1.5 + 0.5,
          pr: 1.5,
          py: 0.5,
          cursor: 'pointer',
          userSelect: 'none',
          borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}`,
          '&:hover': {
            backgroundColor: isDark
              ? 'rgba(255,255,255,0.02)'
              : 'rgba(0,0,0,0.015)',
          },
        }}
      >
        {expanded ? (
          <ExpandMoreIcon sx={{ fontSize: 13, color: 'text.disabled' }} />
        ) : (
          <ChevronRightIcon sx={{ fontSize: 13, color: 'text.disabled' }} />
        )}
        <Typography
          sx={{
            fontSize: '0.7rem',
            fontWeight: 600,
            color: theme.palette.primary.main,
            opacity: 0.85,
          }}
        >
          {node.key}
        </Typography>
        <Typography
          sx={{ fontSize: '0.6rem', color: 'text.disabled', ml: 0.5 }}
        >
          ({node.children.length})
        </Typography>
        {node.value && (
          <Typography
            sx={{
              fontSize: '0.68rem',
              color: 'text.secondary',
              ml: 1,
              fontStyle: 'italic',
            }}
          >
            {node.value}
          </Typography>
        )}
      </Box>
      <Collapse in={expanded}>
        <AttrTreeRenderer
          nodes={node.children}
          depth={depth + 1}
          isDark={isDark}
          onFilter={onFilter}
        />
      </Collapse>
    </Box>
  );
};
