'use strict';
(globalThis.webpackChunkdocs = globalThis.webpackChunkdocs || []).push([
  [4583],
  {
    8198(e, t, i) {
      (i.r(t), i.d(t, { default: () => N }));
      var l = i(4164),
        a = i(8774),
        s = i(4586),
        n = i(1656),
        o = i(1107),
        r = i(1312);
      const c = 'heroBanner_qdFl',
        d = 'buttons_AeoN',
        m = 'categories_YpyD',
        g = 'categoryCol_UiYB',
        u = 'categoryCard_zKVX',
        h = 'categoryHeader_rlzX',
        p = 'categoryIcon_us5F',
        f = 'categoryTitle_IklN',
        x = 'categoryItems_u32e',
        j = 'categoryLink_yOph';
      var k = i(4848);
      function y() {
        const { siteConfig: e } = (0, s.A)();
        return (0, k.jsx)('header', {
          className: (0, l.A)('hero hero--primary', c),
          children: (0, k.jsxs)('div', {
            className: 'container',
            children: [
              (0, k.jsx)(o.A, { as: 'h1', className: 'hero__title', children: e.title }),
              (0, k.jsx)('p', { className: 'hero__subtitle', children: e.tagline }),
              (0, k.jsx)('div', {
                className: d,
                children: (0, k.jsx)(a.A, {
                  className: 'button button--secondary button--lg',
                  to: '/intro',
                  children: (0, k.jsx)(r.A, { id: 'homepage.getStarted', children: 'Get Started' }),
                }),
              }),
            ],
          }),
        });
      }
      const I = [
        {
          titleId: 'homepage.category.intro.title',
          titleDefault: 'Introduction to Gatrix',
          icon: '\ud83d\udcd6',
          items: [
            {
              titleId: 'homepage.item.quickstart',
              titleDefault: 'Quickstart Guide',
              link: '/getting-started/quick-start',
            },
            {
              titleId: 'homepage.item.installation',
              titleDefault: 'Installation',
              link: '/getting-started/installation',
            },
            {
              titleId: 'homepage.item.configuration',
              titleDefault: 'Configuration',
              link: '/getting-started/configuration',
            },
          ],
        },
        {
          titleId: 'homepage.category.features.title',
          titleDefault: 'Feature Flags',
          icon: '\ud83d\ude80',
          items: [
            {
              titleId: 'homepage.item.featureFlags',
              titleDefault: 'Basic Flag Management',
              link: '/features/feature-flags',
            },
            {
              titleId: 'homepage.item.segments',
              titleDefault: 'Segments',
              link: '/features/segments',
            },
            {
              titleId: 'homepage.item.environments',
              titleDefault: 'Environments',
              link: '/features/environments',
            },
          ],
        },
        {
          titleId: 'homepage.category.gameOps.title',
          titleDefault: 'Game Operations',
          icon: '\ud83c\udfae',
          items: [
            {
              titleId: 'homepage.item.notices',
              titleDefault: 'Service Notices',
              link: '/guide/service-notices',
            },
            { titleId: 'homepage.item.coupons', titleDefault: 'Coupons', link: '/guide/coupons' },
            { titleId: 'homepage.item.surveys', titleDefault: 'Surveys', link: '/guide/surveys' },
          ],
        },
        {
          titleId: 'homepage.category.deployment.title',
          titleDefault: 'Deployment',
          icon: '\ud83d\udea2',
          items: [
            {
              titleId: 'homepage.item.docker',
              titleDefault: 'Docker Deployment',
              link: '/deployment/docker',
            },
            {
              titleId: 'homepage.item.edge',
              titleDefault: 'Edge Server',
              link: '/deployment/edge-server',
            },
            {
              titleId: 'homepage.item.integrations',
              titleDefault: 'Integrations',
              link: '/integrations/overview',
            },
          ],
        },
      ];
      function D({ titleId: e, titleDefault: t, icon: i, items: s }) {
        return (0, k.jsx)('div', {
          className: (0, l.A)('col col--6', g),
          children: (0, k.jsxs)('div', {
            className: u,
            children: [
              (0, k.jsxs)('div', {
                className: h,
                children: [
                  (0, k.jsx)('span', { className: p, children: i }),
                  (0, k.jsx)(o.A, {
                    as: 'h3',
                    className: f,
                    children: (0, k.jsx)(r.A, { id: e, children: t }),
                  }),
                ],
              }),
              (0, k.jsx)('ul', {
                className: x,
                children: s.map((e, t) =>
                  (0, k.jsx)(
                    'li',
                    {
                      children: (0, k.jsx)(a.A, {
                        to: e.link,
                        className: j,
                        children: (0, k.jsx)(r.A, { id: e.titleId, children: e.titleDefault }),
                      }),
                    },
                    t
                  )
                ),
              }),
            ],
          }),
        });
      }
      function v() {
        return (0, k.jsx)('section', {
          className: m,
          children: (0, k.jsx)('div', {
            className: 'container',
            children: (0, k.jsx)('div', {
              className: 'row',
              children: I.map((e, t) => (0, k.jsx)(D, { ...e }, t)),
            }),
          }),
        });
      }
      function N() {
        return (0, k.jsxs)(n.A, {
          title: 'Home',
          description: 'Gatrix - Online Game Platform Management System',
          children: [(0, k.jsx)(y, {}), (0, k.jsx)('main', { children: (0, k.jsx)(v, {}) })],
        });
      }
    },
  },
]);
