'use strict';
(globalThis.webpackChunkdocs = globalThis.webpackChunkdocs || []).push([
  [4583],
  {
    8198(e, t, s) {
      (s.r(t), s.d(t, { default: () => q }));
      s(6540);
      var i = s(1656),
        a = s(4586),
        n = s(6025),
        r = s(8774),
        l = s(1107),
        c = s(1312);
      const o = 'hero_aEcG',
        d = 'heroInner_V4lS',
        h = 'heroTitle_qg2I',
        u = 'heroLogo_U6bI',
        m = 'heroTitleText_aZJw',
        g = 'heroSubtitle_jFu1',
        f = 'heroCtas_rCrO',
        p = 'ctaCard_L2rm',
        x = 'ctaCardContent_xk4P',
        j = 'ctaIcon_tj1O',
        N = 'features_cAfv',
        v = 'featuresInner_FluU',
        _ = 'sectionTitle_Ut5p',
        A = 'featureGrid_hfN5',
        I = 'featureCard_Jbd_',
        k = 'featureIcon_qaBM',
        C = 'featureTitle_cv5G',
        D = 'featureDesc_g4Vk';
      var b = s(4848);
      function w() {
        const { siteConfig: e } = (0, a.A)();
        return (0, b.jsx)('div', {
          className: o,
          children: (0, b.jsxs)('div', {
            className: d,
            children: [
              (0, b.jsxs)(l.A, {
                as: 'h1',
                className: h,
                children: [
                  (0, b.jsx)('img', {
                    alt: 'Gatrix Logo',
                    className: u,
                    src: (0, n.Ay)('/img/logo.svg'),
                    width: '120',
                    height: '120',
                  }),
                  (0, b.jsxs)('span', {
                    className: m,
                    children: [
                      (0, b.jsx)(c.A, { id: 'homepage.welcome', children: 'Welcome to' }),
                      ' ',
                      (0, b.jsx)('b', { children: e.title }),
                    ],
                  }),
                ],
              }),
              (0, b.jsx)('p', { className: g, children: e.tagline }),
              (0, b.jsxs)('div', {
                className: f,
                children: [
                  (0, b.jsx)(r.A, {
                    to: '/intro',
                    className: p,
                    children: (0, b.jsxs)('div', {
                      className: x,
                      children: [
                        (0, b.jsx)('span', { className: j, children: '\ud83d\udcd6' }),
                        (0, b.jsx)(c.A, { id: 'homepage.cta.docs', children: 'Documentation' }),
                      ],
                    }),
                  }),
                  (0, b.jsx)(r.A, {
                    to: '/getting-started/quick-start',
                    className: p,
                    children: (0, b.jsxs)('div', {
                      className: x,
                      children: [
                        (0, b.jsx)('span', { className: j, children: '\ud83d\ude80' }),
                        (0, b.jsx)(c.A, { id: 'homepage.cta.quickstart', children: 'Quick Start' }),
                      ],
                    }),
                  }),
                ],
              }),
            ],
          }),
        });
      }
      const T = [
        {
          titleId: 'homepage.feature.flags.title',
          titleDefault: 'Feature Flags',
          descriptionId: 'homepage.feature.flags.desc',
          descriptionDefault: 'Control features in real-time without code deployment',
          icon: '\ud83d\ude80',
          link: '/features/feature-flags',
        },
        {
          titleId: 'homepage.feature.gameops.title',
          titleDefault: 'Game Operations',
          descriptionId: 'homepage.feature.gameops.desc',
          descriptionDefault: 'Notices, coupons, surveys, banners and more',
          icon: '\ud83c\udfae',
          link: '/guide/service-notices',
        },
        {
          titleId: 'homepage.feature.integrations.title',
          titleDefault: 'Integrations',
          descriptionId: 'homepage.feature.integrations.desc',
          descriptionDefault: 'Slack, Teams, Webhook, New Relic and more',
          icon: '\ud83d\udd17',
          link: '/integrations/overview',
        },
        {
          titleId: 'homepage.feature.monitoring.title',
          titleDefault: 'Monitoring',
          descriptionId: 'homepage.feature.monitoring.desc',
          descriptionDefault: 'Event analytics, Grafana dashboards, audit logs',
          icon: '\ud83d\udcca',
          link: '/api/client-api',
        },
      ];
      function G({
        titleId: e,
        titleDefault: t,
        descriptionId: s,
        descriptionDefault: i,
        icon: a,
        link: n,
      }) {
        return (0, b.jsxs)(r.A, {
          to: n,
          className: I,
          children: [
            (0, b.jsx)('div', { className: k, children: a }),
            (0, b.jsx)(l.A, {
              as: 'h3',
              className: C,
              children: (0, b.jsx)(c.A, { id: e, children: t }),
            }),
            (0, b.jsx)('p', { className: D, children: (0, b.jsx)(c.A, { id: s, children: i }) }),
          ],
        });
      }
      function F() {
        return (0, b.jsx)('div', {
          className: N,
          children: (0, b.jsxs)('div', {
            className: v,
            children: [
              (0, b.jsx)(l.A, {
                as: 'h2',
                className: _,
                children: (0, b.jsx)(c.A, {
                  id: 'homepage.features.title',
                  children: 'Core Features',
                }),
              }),
              (0, b.jsx)('div', {
                className: A,
                children: T.map((e, t) => (0, b.jsx)(G, { ...e }, t)),
              }),
            ],
          }),
        });
      }
      function q() {
        const { siteConfig: e } = (0, a.A)();
        return (0, b.jsxs)(i.A, {
          title: e.title,
          description: e.tagline,
          children: [(0, b.jsx)(w, {}), (0, b.jsx)(F, {})],
        });
      }
    },
  },
]);
