'use strict';
(globalThis.webpackChunkdocs = globalThis.webpackChunkdocs || []).push([
  [4583],
  {
    8198(e, t, i) {
      (i.r(t), i.d(t, { default: () => v }));
      var s = i(4164),
        n = i(8774),
        a = i(4586),
        r = i(1656),
        l = i(1107),
        c = i(1312);
      const o = 'heroBanner_qdFl',
        d = 'heroTitle_qg2I',
        h = 'heroSubtitle_jFu1',
        u = 'features_cAfv',
        j = 'featureCard_Jbd_',
        m = 'featureLink_uZjA',
        x = 'links_ykh6',
        p = 'linkRow_zjpl',
        f = 'linkItem_EqW_';
      var g = i(4848);
      function N() {
        const { siteConfig: e } = (0, a.A)();
        return (0, g.jsx)('header', {
          className: o,
          children: (0, g.jsxs)('div', {
            className: 'container',
            children: [
              (0, g.jsx)(l.A, { as: 'h1', className: d, children: e.title }),
              (0, g.jsx)('p', { className: h, children: e.tagline }),
            ],
          }),
        });
      }
      const b = [
        {
          titleId: 'homepage.feature.docs.title',
          titleDefault: 'Documentation',
          descriptionId: 'homepage.feature.docs.description',
          descriptionDefault:
            'Complete guide to get started with Gatrix. Learn about installation, configuration, and all features.',
          link: '/intro',
        },
        {
          titleId: 'homepage.feature.github.title',
          titleDefault: 'GitHub Project',
          descriptionId: 'homepage.feature.github.description',
          descriptionDefault:
            'This project source code is available on GitHub. Star or Watch the project to stay updated.',
          link: 'https://github.com/your-org/gatrix',
        },
      ];
      function k({
        titleId: e,
        titleDefault: t,
        descriptionId: i,
        descriptionDefault: a,
        link: r,
      }) {
        const o = r.startsWith('http');
        return (0, g.jsx)('div', {
          className: (0, s.A)('col col--6'),
          children: (0, g.jsxs)('div', {
            className: j,
            children: [
              (0, g.jsx)(l.A, { as: 'h3', children: (0, g.jsx)(c.A, { id: e, children: t }) }),
              (0, g.jsx)('p', { children: (0, g.jsx)(c.A, { id: i, children: a }) }),
              o
                ? (0, g.jsxs)('a', {
                    href: r,
                    target: '_blank',
                    rel: 'noopener noreferrer',
                    className: m,
                    children: [(0, g.jsx)(c.A, { id: e, children: t }), ' \u2192'],
                  })
                : (0, g.jsxs)(n.A, {
                    to: r,
                    className: m,
                    children: [(0, g.jsx)(c.A, { id: e, children: t }), ' \u2192'],
                  }),
            ],
          }),
        });
      }
      function A() {
        return (0, g.jsx)('section', {
          className: u,
          children: (0, g.jsx)('div', {
            className: 'container',
            children: (0, g.jsx)('div', {
              className: 'row',
              children: b.map((e, t) => (0, g.jsx)(k, { ...e }, t)),
            }),
          }),
        });
      }
      function _() {
        return (0, g.jsx)('section', {
          className: x,
          children: (0, g.jsx)('div', {
            className: 'container',
            children: (0, g.jsx)('div', {
              className: p,
              children: (0, g.jsx)(n.A, {
                to: '/intro',
                className: f,
                children: (0, g.jsx)(c.A, { id: 'homepage.link.docs', children: 'Documentation' }),
              }),
            }),
          }),
        });
      }
      function v() {
        return (0, g.jsxs)(r.A, {
          title: 'Home',
          description: 'Gatrix - Online Game Platform Management System',
          children: [
            (0, g.jsx)(N, {}),
            (0, g.jsxs)('main', { children: [(0, g.jsx)(A, {}), (0, g.jsx)(_, {})] }),
          ],
        });
      }
    },
  },
]);
