'use strict';
(globalThis.webpackChunkdocs = globalThis.webpackChunkdocs || []).push([
  [6366],
  {
    6307(e, s, n) {
      (n.r(s),
        n.d(s, {
          assets: () => c,
          contentTitle: () => l,
          default: () => h,
          frontMatter: () => d,
          metadata: () => r,
          toc: () => a,
        }));
      const r = JSON.parse(
        '{"id":"admin/users","title":"User Management","description":"Overview","source":"@site/docs/admin/users.md","sourceDirName":"admin","slug":"/admin/users","permalink":"/docs/ko/admin/users","draft":false,"unlisted":false,"editUrl":"https://github.com/your-org/gatrix/tree/main/docs/docs/admin/users.md","tags":[],"version":"current","sidebarPosition":5,"frontMatter":{"sidebar_position":5,"sidebar_label":"Users"},"sidebar":"tutorialSidebar","previous":{"title":"Client Versions","permalink":"/docs/ko/admin/client-versions"},"next":{"title":"Overview","permalink":"/docs/ko/integrations/overview"}}'
      );
      var i = n(4848),
        t = n(8453);
      const d = { sidebar_position: 5, sidebar_label: 'Users' },
        l = 'User Management',
        c = {},
        a = [
          { value: 'Overview', id: 'overview', level: 2 },
          { value: 'Features', id: 'features', level: 2 },
          { value: 'User Roles', id: 'user-roles', level: 2 },
          { value: 'Creating a User', id: 'creating-a-user', level: 2 },
          { value: 'Password Policy', id: 'password-policy', level: 2 },
          { value: 'Two-Factor Authentication', id: 'two-factor-authentication', level: 2 },
        ];
      function o(e) {
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
              children: (0, i.jsx)(s.h1, { id: 'user-management', children: 'User Management' }),
            }),
            '\n',
            (0, i.jsx)(s.h2, { id: 'overview', children: 'Overview' }),
            '\n',
            (0, i.jsx)(s.p, { children: 'Manage admin users and their permissions.' }),
            '\n',
            (0, i.jsxs)(s.p, {
              children: [
                (0, i.jsx)(s.strong, { children: 'Navigation:' }),
                ' System Management \u2192 Users',
              ],
            }),
            '\n',
            (0, i.jsx)(s.h2, { id: 'features', children: 'Features' }),
            '\n',
            (0, i.jsxs)(s.ul, {
              children: [
                '\n',
                (0, i.jsx)(s.li, { children: 'Create admin accounts' }),
                '\n',
                (0, i.jsx)(s.li, { children: 'Assign roles and permissions' }),
                '\n',
                (0, i.jsx)(s.li, { children: 'Enable/disable accounts' }),
                '\n',
                (0, i.jsx)(s.li, { children: 'View audit logs' }),
                '\n',
              ],
            }),
            '\n',
            (0, i.jsx)(s.h2, { id: 'user-roles', children: 'User Roles' }),
            '\n',
            (0, i.jsxs)(s.table, {
              children: [
                (0, i.jsx)(s.thead, {
                  children: (0, i.jsxs)(s.tr, {
                    children: [
                      (0, i.jsx)(s.th, { children: 'Role' }),
                      (0, i.jsx)(s.th, { children: 'Description' }),
                    ],
                  }),
                }),
                (0, i.jsxs)(s.tbody, {
                  children: [
                    (0, i.jsxs)(s.tr, {
                      children: [
                        (0, i.jsx)(s.td, {
                          children: (0, i.jsx)(s.strong, { children: 'Super Admin' }),
                        }),
                        (0, i.jsx)(s.td, { children: 'Full access to all features' }),
                      ],
                    }),
                    (0, i.jsxs)(s.tr, {
                      children: [
                        (0, i.jsx)(s.td, { children: (0, i.jsx)(s.strong, { children: 'Admin' }) }),
                        (0, i.jsx)(s.td, { children: 'Access to most features' }),
                      ],
                    }),
                    (0, i.jsxs)(s.tr, {
                      children: [
                        (0, i.jsx)(s.td, {
                          children: (0, i.jsx)(s.strong, { children: 'Operator' }),
                        }),
                        (0, i.jsx)(s.td, { children: 'Limited to operations features' }),
                      ],
                    }),
                    (0, i.jsxs)(s.tr, {
                      children: [
                        (0, i.jsx)(s.td, {
                          children: (0, i.jsx)(s.strong, { children: 'Viewer' }),
                        }),
                        (0, i.jsx)(s.td, { children: 'Read-only access' }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
            '\n',
            (0, i.jsx)(s.h2, { id: 'creating-a-user', children: 'Creating a User' }),
            '\n',
            (0, i.jsxs)(s.ol, {
              children: [
                '\n',
                (0, i.jsxs)(s.li, {
                  children: [
                    'Navigate to ',
                    (0, i.jsx)(s.strong, { children: 'System Management' }),
                    ' > ',
                    (0, i.jsx)(s.strong, { children: 'Users' }),
                  ],
                }),
                '\n',
                (0, i.jsxs)(s.li, {
                  children: ['Click ', (0, i.jsx)(s.strong, { children: 'Add User' }), ' button'],
                }),
                '\n',
                (0, i.jsx)(s.li, { children: 'Configure:' }),
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
                        (0, i.jsx)(s.td, { children: 'Email' }),
                        (0, i.jsx)(s.td, { children: 'Email' }),
                        (0, i.jsx)(s.td, { children: 'Required' }),
                        (0, i.jsx)(s.td, { children: 'Login email' }),
                      ],
                    }),
                    (0, i.jsxs)(s.tr, {
                      children: [
                        (0, i.jsx)(s.td, { children: 'Name' }),
                        (0, i.jsx)(s.td, { children: 'Text' }),
                        (0, i.jsx)(s.td, { children: 'Required' }),
                        (0, i.jsx)(s.td, { children: 'Display name' }),
                      ],
                    }),
                    (0, i.jsxs)(s.tr, {
                      children: [
                        (0, i.jsx)(s.td, { children: 'Password' }),
                        (0, i.jsx)(s.td, { children: 'Password' }),
                        (0, i.jsx)(s.td, { children: 'Required' }),
                        (0, i.jsx)(s.td, { children: 'Initial password' }),
                      ],
                    }),
                    (0, i.jsxs)(s.tr, {
                      children: [
                        (0, i.jsx)(s.td, { children: 'Role' }),
                        (0, i.jsx)(s.td, { children: 'Select' }),
                        (0, i.jsx)(s.td, { children: 'Required' }),
                        (0, i.jsx)(s.td, { children: 'User role' }),
                      ],
                    }),
                    (0, i.jsxs)(s.tr, {
                      children: [
                        (0, i.jsx)(s.td, { children: 'Enabled' }),
                        (0, i.jsx)(s.td, { children: 'Switch' }),
                        (0, i.jsx)(s.td, { children: '-' }),
                        (0, i.jsx)(s.td, { children: 'Account status' }),
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
                (0, i.jsxs)(s.li, {
                  children: ['Click ', (0, i.jsx)(s.strong, { children: 'Create' })],
                }),
                '\n',
              ],
            }),
            '\n',
            (0, i.jsx)(s.h2, { id: 'password-policy', children: 'Password Policy' }),
            '\n',
            (0, i.jsxs)(s.ul, {
              children: [
                '\n',
                (0, i.jsx)(s.li, { children: 'Minimum 8 characters' }),
                '\n',
                (0, i.jsx)(s.li, { children: 'At least one uppercase letter' }),
                '\n',
                (0, i.jsx)(s.li, { children: 'At least one number' }),
                '\n',
                (0, i.jsx)(s.li, { children: 'At least one special character' }),
                '\n',
              ],
            }),
            '\n',
            (0, i.jsx)(s.h2, {
              id: 'two-factor-authentication',
              children: 'Two-Factor Authentication',
            }),
            '\n',
            (0, i.jsx)(s.p, {
              children: 'Users can enable 2FA in their profile settings for additional security.',
            }),
          ],
        });
      }
      function h(e = {}) {
        const { wrapper: s } = { ...(0, t.R)(), ...e.components };
        return s ? (0, i.jsx)(s, { ...e, children: (0, i.jsx)(o, { ...e }) }) : o(e);
      }
    },
    8453(e, s, n) {
      n.d(s, { R: () => d, x: () => l });
      var r = n(6540);
      const i = {},
        t = r.createContext(i);
      function d(e) {
        const s = r.useContext(t);
        return r.useMemo(
          function () {
            return 'function' == typeof e ? e(s) : { ...s, ...e };
          },
          [s, e]
        );
      }
      function l(e) {
        let s;
        return (
          (s = e.disableParentContext
            ? 'function' == typeof e.components
              ? e.components(i)
              : e.components || i
            : d(e.components)),
          r.createElement(t.Provider, { value: s }, e.children)
        );
      }
    },
  },
]);
