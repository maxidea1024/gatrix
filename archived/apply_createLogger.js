const fs = require('fs');
const path = require('path');

const base = 'c:/work/uwo/gatrix/packages/edge/src';

// File to category mapping
const fileCategories = {
  'services/tokenMirrorService.ts': 'TokenMirror',
  'services/tokenUsageTracker.ts': 'TokenUsageTracker',
  'services/sdkManager.ts': 'SDKManager',
  'services/metricsAggregator.ts': 'MetricsAggregator',
  'services/FlagStreamingService.ts': 'FlagStreaming',
  'routes/server.ts': 'ServerRoute',
  'routes/public.ts': 'PublicRoute',
  'routes/client.ts': 'ClientRoute',
  'middleware/clientAuth.ts': 'ClientAuth',
  'utils/evaluationHelper.ts': 'EvaluationHelper',
  'utils/apiResponse.ts': 'ApiResponse',
  'index.ts': 'EdgeServer',
  'app.ts': 'EdgeApp',
  'internalApp.ts': 'InternalApp',
};

// Prefix patterns to strip per category (the [CategoryName] prefix in log messages)
const prefixPatterns = {
  'TokenMirror': '[TokenMirror] ',
  'TokenUsageTracker': '[TokenUsageTracker] ',
  'FlagStreaming': 'Edge FlagStreamingService: ',
  'FlagStreaming2': 'Edge FlagStreamingService ',
  'FlagStreaming3': 'Edge streaming ',
  'FlagStreaming4': 'Edge WebSocket ',
};

let totalChanged = 0;

for (const [relPath, category] of Object.entries(fileCategories)) {
  const filePath = path.join(base, relPath);
  if (!fs.existsSync(filePath)) {
    console.log('SKIP (not found): ' + relPath);
    continue;
  }

  let content = fs.readFileSync(filePath, 'utf-8');
  let changed = false;

  // 1. Change import statement
  // import logger from '../config/logger' -> import { createLogger } from '../config/logger'
  // import logger from './config/logger' -> import { createLogger } from './config/logger'
  const importPatterns = [
    /import logger from '\.\.\/config\/logger';/,
    /import logger from '\.\/config\/logger';/,
    /import logger from '\.\.\/\.\.\/config\/logger';/,
  ];
  
  for (const pattern of importPatterns) {
    if (pattern.test(content)) {
      const importPath = content.match(pattern)[0].match(/'([^']+)'/)[1];
      content = content.replace(pattern, `import { createLogger } from '${importPath}';\n\nconst logger = createLogger('${category}');`);
      changed = true;
      break;
    }
  }

  // 2. Remove manual prefix patterns from log messages
  // logger.info('[TokenMirror] message') -> logger.info('message')
  // logger.error('[TokenMirror] message') -> logger.error('message')
  const prefixesToRemove = [];
  
  // Add category-specific prefix (e.g., [TokenMirror])
  prefixesToRemove.push(`[${category}] `);
  
  // Add additional known prefixes for specific services
  if (category === 'FlagStreaming') {
    prefixesToRemove.push('Edge FlagStreamingService: ');
    prefixesToRemove.push('Edge FlagStreamingService ');
    prefixesToRemove.push('Edge streaming ');
    prefixesToRemove.push('Edge WebSocket ');
    prefixesToRemove.push('Edge ');
  }

  for (const prefix of prefixesToRemove) {
    // Handle both single-quoted and backtick-quoted strings
    // logger.info('[TokenMirror] message')
    const singleQuoteRegex = new RegExp(
      `(logger\\.(info|warn|error|debug)\\()(['\`])` + escapeRegex(prefix),
      'g'
    );
    if (singleQuoteRegex.test(content)) {
      content = content.replace(singleQuoteRegex, '$1$3');
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log('UPDATED: ' + relPath + ' (category: ' + category + ')');
    totalChanged++;
  } else {
    console.log('NO CHANGE: ' + relPath);
  }
}

console.log('\nTotal: ' + totalChanged + ' files updated');

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
