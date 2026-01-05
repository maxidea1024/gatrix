import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  tutorialSidebar: [
    'intro',
    {
      type: 'category',
      label: '게임 관리',
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
      label: 'API 레퍼런스',
      items: [
        'api/client-api',
        'api/server-sdk-api',
      ],
    },
    {
      type: 'category',
      label: '배포 가이드',
      items: [
        'deployment/docker',
        'deployment/edge-server',
      ],
    },
  ],
};

export default sidebars;
