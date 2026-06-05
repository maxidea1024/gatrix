const fs = require('fs');
let code = fs.readFileSync('packages/frontend/src/pages/argus/ArgusLogsPage.tsx', 'utf8');

const startIdx = code.indexOf('const ArgusLogsSearchInput: React.FC<{');
const endIdx = code.indexOf('const ArgusLogsPage: React.FC = () => {');

code = code.slice(0, startIdx) + code.slice(endIdx);
code = code.replace(/ArgusLogsSearchInput/g, 'ArgusSearchInput');

const importStatement = "import { ArgusSearchInput } from '@/components/argus/ArgusSearchInput';\n";
code = code.replace("import { ListSkeleton } from '@/components/argus/ArgusSkeletons';", "import { ListSkeleton } from '@/components/argus/ArgusSkeletons';\n" + importStatement);

fs.writeFileSync('packages/frontend/src/pages/argus/ArgusLogsPage.tsx', code);
