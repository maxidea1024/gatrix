const fs = require('fs');
let code = fs.readFileSync('packages/frontend/src/components/argus/ArgusSearchInput.tsx', 'utf8');

const imports = `import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Box, Typography, Paper, Chip, InputBase, alpha, Tooltip, IconButton, Popover } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { Search as SearchIcon, FilterList as FilterListIcon, Close as CloseIcon } from '@mui/icons-material';
import SearchAutocompletePopover, { SearchAutocompletePopoverHandle } from './SearchAutocompletePopover';

const RECENT_KEY = 'argusLogs.recentSearch';

`;

code = imports + code;
code = code.replace('const ArgusLogsSearchInput:', 'export const ArgusSearchInput:');
code = code.replace(/ArgusLogsSearchInput/g, 'ArgusSearchInput');

fs.writeFileSync('packages/frontend/src/components/argus/ArgusSearchInput.tsx', code);
