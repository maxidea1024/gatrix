const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const servicesDir = path.join(rootDir, 'packages', 'frontend', 'src', 'services');
const hooksDir = path.join(rootDir, 'packages', 'frontend', 'src', 'hooks');
const pagesDir = path.join(rootDir, 'packages', 'frontend', 'src', 'pages');
const componentsDir = path.join(rootDir, 'packages', 'frontend', 'src', 'components');

function findFiles(dir, extensions = ['.ts', '.tsx']) {
    if (!fs.existsSync(dir)) return [];
    const results = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results.push(...findFiles(fullPath, extensions));
        } else if (extensions.some(ext => entry.name.endsWith(ext))) {
            results.push(fullPath);
        }
    }
    return results;
}

function extractApiPaths(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const relativePath = path.relative(path.join(rootDir, 'packages', 'frontend', 'src'), filePath).replace(/\\/g, '/');
    const paths = [];
    const seen = new Set();

    // Template literal patterns
    const patterns = [
        // api.get/post/put/delete/patch with template literals
        /(?:api|apiService)\.(get|post|put|delete|patch)\s*(?:<[^>]*>)?\s*\(\s*`((?:[^`\\]|\\.|\$\{[^}]*\})+)`/g,
        // api.get/post/put/delete/patch with string literals
        /(?:api|apiService)\.(get|post|put|delete|patch)\s*(?:<[^>]*>)?\s*\(\s*['"]([^'"]+)['"]/g,
        // useSWR with template literals
        /useSWR\s*(?:<[^>]*>)?\s*\(\s*`((?:[^`\\]|\\.|\$\{[^}]*\})+)`/g,
        // useSWR with string literals
        /useSWR\s*(?:<[^>]*>)?\s*\(\s*['"]([^'"]+)['"]/g,
    ];

    for (const regex of patterns) {
        let match;
        while ((match = regex.exec(content)) !== null) {
            const method = match[1] ? match[1].toUpperCase() : 'GET(SWR)';
            const rawPath = match[2] || match[1]; // For SWR patterns, group index differs
            const normalizedPath = rawPath.replace(/\$\{[^}]+\}/g, ':param');
            const key = `${method}|${normalizedPath}`;
            if (!seen.has(key)) {
                seen.add(key);
                paths.push({
                    method,
                    path: normalizedPath,
                    rawPath,
                    file: relativePath,
                });
            }
        }
    }

    return paths;
}

const allFiles = [
    ...findFiles(servicesDir),
    ...findFiles(hooksDir),
    ...findFiles(pagesDir),
    ...findFiles(componentsDir),
];

const allPaths = [];
for (const file of allFiles) {
    allPaths.push(...extractApiPaths(file));
}

// Group by normalized path
const byPath = new Map();
for (const p of allPaths) {
    const key = `${p.method} ${p.path}`;
    if (!byPath.has(key)) {
        byPath.set(key, { ...p, files: [p.file] });
    } else {
        const existing = byPath.get(key);
        if (!existing.files.includes(p.file)) {
            existing.files.push(p.file);
        }
    }
}

const sorted = Array.from(byPath.values()).sort((a, b) => a.path.localeCompare(b.path));

// =============== Now extract backend routes ===============
const backendRoutesDir = path.join(rootDir, 'packages', 'backend', 'src', 'routes');

function findTsFiles(dir) {
    const results = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results.push(...findTsFiles(fullPath));
        } else if (entry.name.endsWith('.ts')) {
            results.push(fullPath);
        }
    }
    return results;
}

function extractBackendRoutes(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const relativePath = path.relative(backendRoutesDir, filePath).replace(/\\/g, '/');
    const routes = [];

    const methodRegex = /(?:router|projectRouter)\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g;
    let match;
    while ((match = methodRegex.exec(content)) !== null) {
        routes.push({
            method: match[1].toUpperCase(),
            path: match[2],
            file: relativePath,
        });
    }

    return routes;
}

// Build the full backend path map based on mount structure
// Routes index.ts mounts at /api/v1
// admin/index.ts mounts sub-routers
const adminIndexContent = fs.readFileSync(path.join(backendRoutesDir, 'admin', 'index.ts'), 'utf8');

// Parse admin/index.ts mount points
const adminMounts = {};
const useRegex = /(?:router|projectRouter)\.use\s*\(\s*['"`]([^'"`]+)['"`]/g;
let m;
while ((m = useRegex.exec(adminIndexContent)) !== null) {
    adminMounts[m[1]] = true;
}

// Build route prefix map
const routePrefixMap = {
    'admin/admin.ts': '/admin',
    'admin/users.ts': '/admin/users',
    'admin/whitelist.ts': '/admin/whitelist',
    'admin/ipWhitelist.ts': '/admin/ip-whitelist',
    'admin/clientVersionRoutes.ts': '/admin/client-versions',
    'admin/auditLogs.ts': '/admin/audit-logs',
    'admin/tags.ts': '/admin/orgs/:orgId/projects/:projectId/tags',
    'admin/messageTemplates.ts': '/admin/message-templates',
    'admin/translation.ts': '/admin/translation',
    'admin/vars.ts': '/admin/vars',
    'admin/gameWorlds.ts': '/admin/game-worlds',
    'admin/apiTokens.ts': '/admin/api-tokens',
    'admin/notifications.ts': '/admin/notifications',
    'admin/environments.ts': '/admin/orgs/:orgId/projects/:projectId/environments',
    'admin/jobs.ts': '/admin/jobs',
    'admin/maintenance.ts': '/admin/maintenance',
    'admin/invitations.ts': '/admin/invitations',
    'admin/crashEvents.ts': '/admin/crash-events',
    'admin/console.ts': '/admin/console',
    'admin/surveys.ts': '/admin/surveys',
    'admin/rewardTemplates.ts': '/admin/reward-templates',
    'admin/storeProducts.ts': '/admin/store-products',
    'admin/serviceNotices.ts': '/admin/service-notices',
    'admin/ingamePopupNotices.ts': '/admin/ingame-popup-notices',
    'admin/planningData.ts': '/admin/planning-data',
    'admin/couponSettings.ts': '/admin/coupon-settings',
    'admin/serviceDiscovery.ts': '/admin/services',
    'admin/monitoringAlerts.ts': '/admin/monitoring/alerts',
    'admin/dataManagement.ts': '/admin/data-management',
    'admin/banners.ts': '/admin/banners',
    'admin/cmsCashShop.ts': '/admin/cms/cash-shop',
    'admin/serverLifecycle.ts': '/admin/server-lifecycle',
    'admin/changeRequests.ts': '/admin/orgs/:orgId/projects/:projectId/change-requests',
    'admin/features.ts': '/admin/orgs/:orgId/projects/:projectId/features',
    'admin/platformDefaults.ts': '/admin/platform-defaults',
    'admin/unknownFlags.ts': '/admin/orgs/:orgId/projects/:projectId/unknown-flags',
    'admin/integrations.ts': '/admin/integrations',
    'admin/releaseFlows.ts': '/admin/orgs/:orgId/projects/:projectId/release-flows',
    'admin/serviceAccounts.ts': '/admin/service-accounts',
    'admin/signalEndpoints.ts': '/admin/signal-endpoints',
    'admin/actionSets.ts': '/admin/actions',
    'admin/queueMonitor.ts': '/admin/queue-monitor',
    'admin/rbac.ts': '/admin/rbac',
    'admin/index.ts': '/admin',
    'auth/auth.ts': '/auth',
    'auth/index.ts': '/auth',
    'client/client.ts': '/client',
    'client/index.ts': '/client',
    'server/index.ts': '/server',
    'server/serviceDiscovery.ts': '/server/services',
    'users.ts': '/users',
    'mails.ts': '/mails',
    'coupons.ts': '/coupons',
    'linkPreview.ts': '/link-preview',
    'analytics.ts': '/analytics',
    'public/index.ts': '/public',
    'public/invitations.ts': '/public/invitations',
    'public/serviceNotices.ts': '/public/service-notices',
    'public/monitoring.ts': '/public/monitoring',
    'public/signals.ts': '/public/signals',
    'public/upload.ts': '/public/upload',
    'index.ts': '',
    'chat/index.ts': '/chat',
};

const backendFiles = findTsFiles(backendRoutesDir);
const backendRoutes = [];

for (const file of backendFiles) {
    const routes = extractBackendRoutes(file);
    const relativePath = path.relative(backendRoutesDir, file).replace(/\\/g, '/');
    const prefix = routePrefixMap[relativePath] || '';

    for (const r of routes) {
        if (r.path === '/') {
            backendRoutes.push({ ...r, fullPath: prefix || '/' });
        } else {
            backendRoutes.push({ ...r, fullPath: prefix + r.path });
        }
    }
}

// Write output to file
let output = '';

output += '# Backend API Routes (Full Paths)\n\n';
output += '| Method | Full Path | Route File |\n';
output += '|--------|-----------|------------|\n';
for (const r of backendRoutes.sort((a, b) => a.fullPath.localeCompare(b.fullPath))) {
    output += `| ${r.method} | ${r.fullPath} | ${r.file} |\n`;
}

output += `\n\nTotal backend routes: ${backendRoutes.length}\n\n`;

output += '---\n\n';
output += '# Frontend API Calls\n\n';
output += '| Method | Path | Source Files |\n';
output += '|--------|------|-------------|\n';
for (const p of sorted) {
    output += `| ${p.method} | ${p.path} | ${p.files.join(', ')} |\n`;
}

output += `\n\nTotal frontend unique API paths: ${sorted.length}\n`;

// Write to archived folder
const outputPath = path.join(__dirname, 'api-routes-analysis.md');
fs.writeFileSync(outputPath, output);
console.log(`Analysis written to: ${outputPath}`);
console.log(`Backend routes: ${backendRoutes.length}`);
console.log(`Frontend API paths: ${sorted.length}`);
