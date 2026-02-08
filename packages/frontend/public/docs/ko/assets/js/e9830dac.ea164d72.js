'use strict';
(globalThis.webpackChunkdocs = globalThis.webpackChunkdocs || []).push([
  [5522],
  {
    2311(e, s, n) {
      (n.r(s),
        n.d(s, {
          assets: () => c,
          contentTitle: () => d,
          default: () => h,
          frontMatter: () => l,
          metadata: () => r,
          toc: () => o,
        }));
      const r = JSON.parse(
        '{"id":"guide/surveys","title":"Surveys","description":"Overview","source":"@site/docs/guide/surveys.md","sourceDirName":"guide","slug":"/guide/surveys","permalink":"/docs/ko/guide/surveys","draft":false,"unlisted":false,"editUrl":"https://github.com/your-org/gatrix/tree/main/docs/docs/guide/surveys.md","tags":[],"version":"current","sidebarPosition":4,"frontMatter":{"sidebar_position":4,"sidebar_label":"Surveys"},"sidebar":"tutorialSidebar","previous":{"title":"Coupons","permalink":"/docs/ko/guide/coupons"},"next":{"title":"Store Products","permalink":"/docs/ko/guide/store-products"}}'
      );
      var i = n(4848),
        t = n(8453);
      const l = { sidebar_position: 4, sidebar_label: 'Surveys' },
        d = 'Surveys',
        c = {},
        o = [
          { value: 'Overview', id: 'overview', level: 2 },
          { value: 'Features', id: 'features', level: 2 },
          { value: 'Creating a Survey', id: 'creating-a-survey', level: 2 },
          { value: 'Question Types', id: 'question-types', level: 2 },
          { value: 'Response Analysis', id: 'response-analysis', level: 2 },
        ];
      function a(e) {
        const s = {
          h1: 'h1',
          h2: 'h2',
          header: 'header',
          li: 'li',
          ol: 'ol',
          p: 'p',
          strong: 'strong',
          table: 'table',
          tbody: 'tbody',
          td: 'td',
          th: 'th',
          thead: 'thead',
          tr: 'tr',
          ul: 'ul',
          ...(0, t.R)(),
          ...e.components,
        };
        return (0, i.jsxs)(i.Fragment, {
          children: [
            (0, i.jsx)(s.header, {
              children: (0, i.jsx)(s.h1, { id: 'surveys', children: 'Surveys' }),
            }),
            '\n',
            (0, i.jsx)(s.h2, { id: 'overview', children: 'Overview' }),
            '\n',
            (0, i.jsx)(s.p, {
              children: 'Create and manage in-game surveys to collect player feedback.',
            }),
            '\n',
            (0, i.jsxs)(s.p, {
              children: [
                (0, i.jsx)(s.strong, { children: 'Navigation:' }),
                ' Game Operations \u2192 Surveys',
              ],
            }),
            '\n',
            (0, i.jsx)(s.h2, { id: 'features', children: 'Features' }),
            '\n',
            (0, i.jsxs)(s.ul, {
              children: [
                '\n',
                (0, i.jsx)(s.li, { children: 'Create surveys with multiple question types' }),
                '\n',
                (0, i.jsx)(s.li, { children: 'Target specific user segments' }),
                '\n',
                (0, i.jsx)(s.li, { children: 'Set survey periods' }),
                '\n',
                (0, i.jsx)(s.li, { children: 'Analyze response data' }),
                '\n',
                (0, i.jsx)(s.li, { children: 'Export results' }),
                '\n',
              ],
            }),
            '\n',
            (0, i.jsx)(s.h2, { id: 'creating-a-survey', children: 'Creating a Survey' }),
            '\n',
            (0, i.jsxs)(s.ol, {
              children: [
                '\n',
                (0, i.jsxs)(s.li, {
                  children: [
                    'Navigate to ',
                    (0, i.jsx)(s.strong, { children: 'Game Operations' }),
                    ' > ',
                    (0, i.jsx)(s.strong, { children: 'Surveys' }),
                  ],
                }),
                '\n',
                (0, i.jsxs)(s.li, {
                  children: ['Click ', (0, i.jsx)(s.strong, { children: 'Add Survey' }), ' button'],
                }),
                '\n',
                (0, i.jsx)(s.li, { children: 'Configure the survey:' }),
                '\n',
              ],
            }),
            '\n',
            (0, i.jsxs)(s.table, {
              children: [
                (0, i.jsx)(s.thead, {
                  children: (0, i.jsxs)(s.tr, {
                    children: [
                      (0, i.jsx)(s.th, { children: 'Field' }),
                      (0, i.jsx)(s.th, { children: 'Type' }),
                      (0, i.jsx)(s.th, { children: 'Required' }),
                      (0, i.jsx)(s.th, { children: 'Description' }),
                    ],
                  }),
                }),
                (0, i.jsxs)(s.tbody, {
                  children: [
                    (0, i.jsxs)(s.tr, {
                      children: [
                        (0, i.jsx)(s.td, { children: 'Title' }),
                        (0, i.jsx)(s.td, { children: 'Text' }),
                        (0, i.jsx)(s.td, { children: 'Required' }),
                        (0, i.jsx)(s.td, { children: 'Survey title' }),
                      ],
                    }),
                    (0, i.jsxs)(s.tr, {
                      children: [
                        (0, i.jsx)(s.td, { children: 'Description' }),
                        (0, i.jsx)(s.td, { children: 'Textarea' }),
                        (0, i.jsx)(s.td, { children: '-' }),
                        (0, i.jsx)(s.td, { children: 'Survey description' }),
                      ],
                    }),
                    (0, i.jsxs)(s.tr, {
                      children: [
                        (0, i.jsx)(s.td, { children: 'Start Date' }),
                        (0, i.jsx)(s.td, { children: 'DateTime' }),
                        (0, i.jsx)(s.td, { children: '-' }),
                        (0, i.jsx)(s.td, { children: 'When survey opens' }),
                      ],
                    }),
                    (0, i.jsxs)(s.tr, {
                      children: [
                        (0, i.jsx)(s.td, { children: 'End Date' }),
                        (0, i.jsx)(s.td, { children: 'DateTime' }),
                        (0, i.jsx)(s.td, { children: '-' }),
                        (0, i.jsx)(s.td, { children: 'When survey closes' }),
                      ],
                    }),
                    (0, i.jsxs)(s.tr, {
                      children: [
                        (0, i.jsx)(s.td, { children: 'Target Segment' }),
                        (0, i.jsx)(s.td, { children: 'Select' }),
                        (0, i.jsx)(s.td, { children: '-' }),
                        (0, i.jsx)(s.td, { children: 'Target audience' }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
            '\n',
            (0, i.jsxs)(s.ol, {
              start: '4',
              children: [
                '\n',
                (0, i.jsx)(s.li, { children: 'Add questions' }),
                '\n',
                (0, i.jsxs)(s.li, {
                  children: ['Click ', (0, i.jsx)(s.strong, { children: 'Create' }), ' to save'],
                }),
                '\n',
              ],
            }),
            '\n',
            (0, i.jsx)(s.h2, { id: 'question-types', children: 'Question Types' }),
            '\n',
            (0, i.jsxs)(s.ul, {
              children: [
                '\n',
                (0, i.jsxs)(s.li, {
                  children: [
                    (0, i.jsx)(s.strong, { children: 'Single Choice' }),
                    ' - Radio buttons, one answer',
                  ],
                }),
                '\n',
                (0, i.jsxs)(s.li, {
                  children: [
                    (0, i.jsx)(s.strong, { children: 'Multiple Choice' }),
                    ' - Checkboxes, multiple answers',
                  ],
                }),
                '\n',
                (0, i.jsxs)(s.li, {
                  children: [
                    (0, i.jsx)(s.strong, { children: 'Text' }),
                    ' - Free-form text response',
                  ],
                }),
                '\n',
                (0, i.jsxs)(s.li, {
                  children: [(0, i.jsx)(s.strong, { children: 'Rating' }), ' - 1-5 star rating'],
                }),
                '\n',
                (0, i.jsxs)(s.li, {
                  children: [
                    (0, i.jsx)(s.strong, { children: 'Scale' }),
                    ' - Numeric scale (1-10)',
                  ],
                }),
                '\n',
              ],
            }),
            '\n',
            (0, i.jsx)(s.h2, { id: 'response-analysis', children: 'Response Analysis' }),
            '\n',
            (0, i.jsx)(s.p, { children: 'View survey results including:' }),
            '\n',
            (0, i.jsxs)(s.ul, {
              children: [
                '\n',
                (0, i.jsx)(s.li, { children: 'Total responses' }),
                '\n',
                (0, i.jsx)(s.li, { children: 'Response rate' }),
                '\n',
                (0, i.jsx)(s.li, { children: 'Answer distribution' }),
                '\n',
                (0, i.jsx)(s.li, { children: 'Average ratings' }),
                '\n',
                (0, i.jsx)(s.li, { children: 'Export to CSV' }),
                '\n',
              ],
            }),
          ],
        });
      }
      function h(e = {}) {
        const { wrapper: s } = { ...(0, t.R)(), ...e.components };
        return s ? (0, i.jsx)(s, { ...e, children: (0, i.jsx)(a, { ...e }) }) : a(e);
      }
    },
    8453(e, s, n) {
      n.d(s, { R: () => l, x: () => d });
      var r = n(6540);
      const i = {},
        t = r.createContext(i);
      function l(e) {
        const s = r.useContext(t);
        return r.useMemo(
          function () {
            return 'function' == typeof e ? e(s) : { ...s, ...e };
          },
          [s, e]
        );
      }
      function d(e) {
        let s;
        return (
          (s = e.disableParentContext
            ? 'function' == typeof e.components
              ? e.components(i)
              : e.components || i
            : l(e.components)),
          r.createElement(t.Provider, { value: s }, e.children)
        );
      }
    },
  },
]);
