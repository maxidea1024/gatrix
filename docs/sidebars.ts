import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  tutorialSidebar: [
    'intro',
    {
      type: 'category',
      label: 'Getting Started',
      collapsed: false,
      items: [
        'getting-started/quick-start',
        'getting-started/installation',
        'getting-started/configuration',
      ],
    },
    {
      type: 'category',
      label: 'Feature Flags',
      items: ['features/feature-flags', 'features/segments', 'features/environments'],
    },
    {
      type: 'category',
      label: 'Game Operations',
      items: [
        'guide/service-notices',
        'guide/popup-notices',
        'guide/coupons',
        'guide/surveys',
        'guide/store-products',
        'guide/banners',
        'guide/planning-data',
      ],
    },
    {
      type: 'category',
      label: 'System Management',
      items: [
        'admin/maintenance',
        'admin/whitelist',
        'admin/game-worlds',
        'admin/client-versions',
        'admin/users',
      ],
    },
    {
      type: 'category',
      label: 'Integrations',
      items: [
        'integrations/overview',
        'integrations/slack',
        'integrations/teams',
        'integrations/webhook',
        'integrations/new-relic',
      ],
    },
    {
      type: 'category',
      label: 'SDKs',
      items: ['sdks/server-side', 'sdks/client-side', 'sdks/game-engines'],
    },
    {
      type: 'category',
      label: 'API Reference',
      items: ['api/client-api', 'api/server-sdk-api'],
    },
    {
      type: 'category',
      label: 'Deployment',
      items: ['deployment/docker', 'deployment/edge-server'],
    },
  ],
};

export default sidebars;
