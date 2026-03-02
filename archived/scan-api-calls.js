/**
 * Transform frontend service files to use projectApiPath
 * for routes that moved from flat to project-scoped.
 *
 * Strategy:
 * - If file already has basePath(projectApiPath), update fallback
 * - If file uses direct '/admin/XXX', add projectApiPath parameter and replace paths
 */
const fs = require('fs');
const path = require('path');

const svcDir = path.join(__dirname, '..', 'packages', 'frontend', 'src', 'services');

// Routes that moved to project-scoped
const MOVED_ROUTES = {
    'actionSetService.ts': '/admin/actions',
    'signalEndpointService.ts': '/admin/signal-endpoints',
    'serviceAccountService.ts': '/admin/service-accounts',
    'planningDataService.ts': '/admin/planning-data',
    'dataManagementService.ts': '/admin/data-management',
    'clientVersionService.ts': '/admin/client-versions',
    'gameWorldService.ts': '/admin/game-worlds',
    'maintenanceService.ts': '/admin/maintenance',
    'messageTemplateService.ts': '/admin/message-templates',
    'serviceNoticeService.ts': '/admin/service-notices',
    'ingamePopupNoticeService.ts': '/admin/ingame-popup-notices',
    'surveyService.ts': '/admin/surveys',
    'rewardTemplateService.ts': '/admin/reward-templates',
    'storeProductService.ts': '/admin/store-products',  // also has /admin/cms/cash-shop
    'bannerService.ts': '/admin/banners',
    'couponSettingsService.ts': '/admin/coupon-settings',
    'serverLifecycleService.ts': '/admin/server-lifecycle',
    'varsService.ts': '/admin/vars',
};

for (const [filename, adminPath] of Object.entries(MOVED_ROUTES)) {
    const filePath = path.join(svcDir, filename);
    if (!fs.existsSync(filePath)) {
        console.log(`SKIP (not found): ${filename}`);
        continue;
    }

    const content = fs.readFileSync(filePath, 'utf8');

    // Check current pattern
    const hasBasePath = content.includes('function basePath');
    const hasDirectAdmin = content.includes(`'${adminPath}`) || content.includes(`\`${adminPath}`);

    console.log(`${filename}: basePath=${hasBasePath}, directAdmin=${hasDirectAdmin}`);

    // Count occurrences
    const regex = new RegExp(adminPath.replace(/\//g, '\\/'), 'g');
    const matches = content.match(regex);
    console.log(`  Occurrences of "${adminPath}": ${matches ? matches.length : 0}`);
}
