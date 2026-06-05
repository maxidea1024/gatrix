const fs = require('fs');
let code = fs.readFileSync('packages/frontend/src/components/argus/ArgusSearchInput.tsx', 'utf8');

const additionalImports = `
import SafeTooltip from '@/components/common/SafeTooltip';
import ArgusQueryBuilder from '@/components/argus/ArgusQueryBuilder';
import { FilterList as FilterIcon } from '@mui/icons-material';
`;

code = code.replace("import { Search as SearchIcon, FilterList as FilterListIcon, Close as CloseIcon } from '@mui/icons-material';", "import { Search as SearchIcon, Close as CloseIcon } from '@mui/icons-material';" + additionalImports);

fs.writeFileSync('packages/frontend/src/components/argus/ArgusSearchInput.tsx', code);
