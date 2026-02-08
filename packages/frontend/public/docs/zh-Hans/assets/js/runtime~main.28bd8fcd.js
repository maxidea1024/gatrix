(() => {
  'use strict';
  var e,
    a,
    f,
    c,
    b,
    d = {},
    r = {};
  function t(e) {
    var a = r[e];
    if (void 0 !== a) return a.exports;
    var f = (r[e] = { id: e, loaded: !1, exports: {} });
    return (d[e].call(f.exports, f, f.exports, t), (f.loaded = !0), f.exports);
  }
  ((t.m = d),
    (t.c = r),
    (e = []),
    (t.O = (a, f, c, b) => {
      if (!f) {
        var d = 1 / 0;
        for (i = 0; i < e.length; i++) {
          for (var [f, c, b] = e[i], r = !0, o = 0; o < f.length; o++)
            (!1 & b || d >= b) && Object.keys(t.O).every((e) => t.O[e](f[o]))
              ? f.splice(o--, 1)
              : ((r = !1), b < d && (d = b));
          if (r) {
            e.splice(i--, 1);
            var n = c();
            void 0 !== n && (a = n);
          }
        }
        return a;
      }
      b = b || 0;
      for (var i = e.length; i > 0 && e[i - 1][2] > b; i--) e[i] = e[i - 1];
      e[i] = [f, c, b];
    }),
    (t.n = (e) => {
      var a = e && e.__esModule ? () => e.default : () => e;
      return (t.d(a, { a: a }), a);
    }),
    (f = Object.getPrototypeOf ? (e) => Object.getPrototypeOf(e) : (e) => e.__proto__),
    (t.t = function (e, c) {
      if ((1 & c && (e = this(e)), 8 & c)) return e;
      if ('object' == typeof e && e) {
        if (4 & c && e.__esModule) return e;
        if (16 & c && 'function' == typeof e.then) return e;
      }
      var b = Object.create(null);
      t.r(b);
      var d = {};
      a = a || [null, f({}), f([]), f(f)];
      for (
        var r = 2 & c && e;
        ('object' == typeof r || 'function' == typeof r) && !~a.indexOf(r);
        r = f(r)
      )
        Object.getOwnPropertyNames(r).forEach((a) => (d[a] = () => e[a]));
      return ((d.default = () => e), t.d(b, d), b);
    }),
    (t.d = (e, a) => {
      for (var f in a)
        t.o(a, f) && !t.o(e, f) && Object.defineProperty(e, f, { enumerable: !0, get: a[f] });
    }),
    (t.f = {}),
    (t.e = (e) => Promise.all(Object.keys(t.f).reduce((a, f) => (t.f[f](e, a), a), []))),
    (t.u = (e) =>
      'assets/js/' +
      ({
        0: '27b5587c',
        168: 'f77c9094',
        279: 'fbb106eb',
        360: 'd051a7c4',
        369: 'a6f19d9d',
        405: '2f0bb3bc',
        614: 'de04d02f',
        789: '9e1169e2',
        816: '7da3d90c',
        867: '33fc5bb8',
        1126: 'b3765a0e',
        1229: 'f4f4250e',
        1235: 'a7456010',
        1543: '27d4f2bc',
        1552: '9e88f858',
        1581: '25f93ae5',
        1903: 'acecf23e',
        1972: '73664a40',
        2020: '8cf9041d',
        2057: '2a2c6a18',
        2184: 'e3cbe9d6',
        2711: '9e4087bc',
        3249: 'ccc49370',
        3252: 'e06c5bb2',
        3357: 'ea8f0c6c',
        3518: '3e6482c4',
        3587: 'ce435b68',
        3637: 'f4f34a3a',
        3694: '8717b14a',
        3753: '3c83faec',
        3880: 'c16354e2',
        4029: 'e92b10e8',
        4134: '393be207',
        4202: '41da7453',
        4212: '621db11d',
        4217: 'd8a901a2',
        4462: '489d66e1',
        4583: '1df93b7f',
        4755: 'f827ee9b',
        4813: '6875c492',
        5009: 'c8f8d5ec',
        5163: '6924d0b3',
        5522: 'e9830dac',
        5557: 'd9f32620',
        5611: 'b122249f',
        5742: 'aba21aa0',
        5744: '5b2a233e',
        5769: 'bc1e63c5',
        6061: '1f391b9e',
        6355: '0afb47aa',
        6366: '751a3bff',
        6406: '49024b2f',
        6596: '3355ad79',
        6674: 'ad0b1a86',
        6681: '1434367b',
        6774: 'ff8b1e34',
        6918: 'd465ea6f',
        6998: '2636949b',
        7098: 'a7bd4aaa',
        7442: '3a56b529',
        7472: '814f3328',
        7632: '2eab1c41',
        7643: 'a6aa9e1f',
        7747: 'bc4d0067',
        7915: '582e77b4',
        8065: '5a924f76',
        8083: '0973a1e6',
        8127: 'daef146e',
        8209: '01a85c17',
        8401: '17896441',
        8411: '0c8b0ff1',
        8506: '117e7c8a',
        8609: '925b3f96',
        8613: '07e03362',
        8633: '58010f9e',
        8737: '7661071f',
        8866: 'b2faa355',
        9006: '8949a3d1',
        9048: 'a94703ab',
        9325: '59362658',
        9328: 'e273c56f',
        9340: '74c97d4c',
        9647: '5e95c892',
        9858: '36994c47',
        9985: '542d5422',
      }[e] || e) +
      '.' +
      {
        0: '3543ee44',
        168: 'b5de916d',
        279: 'fffe7f04',
        360: '36a1a34a',
        369: '5e5a49cf',
        405: 'ae88b27d',
        614: 'd73e7172',
        789: '85cff456',
        816: '5b604ad5',
        867: 'b3ff11b3',
        1126: '21cf5e4c',
        1229: '8b1f69bf',
        1235: '5eb8c595',
        1543: '1ae78ec6',
        1552: 'da60c542',
        1581: '51dc295b',
        1903: 'c1fe2169',
        1972: '883103cc',
        2020: '6f756bde',
        2057: '3a945537',
        2184: 'f839189f',
        2237: '3f9f32b8',
        2711: '5cd5f93e',
        3249: '2a09edaf',
        3252: '53f8bd35',
        3357: 'aea58878',
        3518: '4cad002c',
        3587: '1d82c24d',
        3637: 'c5f26ed8',
        3694: 'a671e751',
        3753: 'd9c2ccd0',
        3880: '0ef3d720',
        4029: 'bdf1caaf',
        4134: 'c49e24dd',
        4202: '0143378e',
        4212: '0e947ff5',
        4217: '095cab65',
        4462: '2dbde969',
        4583: '07e72a65',
        4755: '4289bff3',
        4813: '2efdc0c4',
        5009: 'ac032f1d',
        5163: 'c932c221',
        5522: '15aebe39',
        5557: '214e356b',
        5611: '25f0a08f',
        5742: 'ecbe5ded',
        5744: '3c90610c',
        5769: '56b9231a',
        6061: 'c2b120c2',
        6355: '18790fd8',
        6366: '5f3c5f1d',
        6406: '10d055ef',
        6596: '0324f39c',
        6674: 'ea919d81',
        6681: '713b7561',
        6774: 'a2ada481',
        6918: 'c5b0c554',
        6932: '9af2817a',
        6998: '981c09ec',
        7098: '14975c16',
        7442: 'c8fd3482',
        7472: 'a82447ff',
        7527: '4359ce7a',
        7632: '1c25f8f6',
        7643: 'b50ba344',
        7714: '544e4984',
        7747: 'e0c9fa63',
        7915: '7407742f',
        8065: 'fbbf39f1',
        8083: '78447d94',
        8127: '5b5b7d0b',
        8209: '62497cf1',
        8401: 'bbf50123',
        8411: 'c2cd5fa3',
        8506: 'a7227186',
        8609: '8ff20157',
        8613: '30eb32e6',
        8633: '0ff4ce0b',
        8737: 'c93a9a48',
        8866: '499e009d',
        9006: '5fcdb9f8',
        9048: 'ddf3b444',
        9325: '6cc68220',
        9328: 'f7d6b638',
        9340: '442420f1',
        9647: 'de3701d0',
        9858: '38f08b34',
        9985: 'ce915a1c',
      }[e] +
      '.js'),
    (t.miniCssF = (e) => {}),
    (t.o = (e, a) => Object.prototype.hasOwnProperty.call(e, a)),
    (c = {}),
    (b = 'docs:'),
    (t.l = (e, a, f, d) => {
      if (c[e]) c[e].push(a);
      else {
        var r, o;
        if (void 0 !== f)
          for (var n = document.getElementsByTagName('script'), i = 0; i < n.length; i++) {
            var l = n[i];
            if (l.getAttribute('src') == e || l.getAttribute('data-webpack') == b + f) {
              r = l;
              break;
            }
          }
        (r ||
          ((o = !0),
          ((r = document.createElement('script')).charset = 'utf-8'),
          t.nc && r.setAttribute('nonce', t.nc),
          r.setAttribute('data-webpack', b + f),
          (r.src = e)),
          (c[e] = [a]));
        var u = (a, f) => {
            ((r.onerror = r.onload = null), clearTimeout(s));
            var b = c[e];
            if (
              (delete c[e],
              r.parentNode && r.parentNode.removeChild(r),
              b && b.forEach((e) => e(f)),
              a)
            )
              return a(f);
          },
          s = setTimeout(u.bind(null, void 0, { type: 'timeout', target: r }), 12e4);
        ((r.onerror = u.bind(null, r.onerror)),
          (r.onload = u.bind(null, r.onload)),
          o && document.head.appendChild(r));
      }
    }),
    (t.r = (e) => {
      ('undefined' != typeof Symbol &&
        Symbol.toStringTag &&
        Object.defineProperty(e, Symbol.toStringTag, { value: 'Module' }),
        Object.defineProperty(e, '__esModule', { value: !0 }));
    }),
    (t.p = '/docs/zh-Hans/'),
    (t.gca = function (e) {
      return (
        (e =
          {
            17896441: '8401',
            59362658: '9325',
            '27b5587c': '0',
            f77c9094: '168',
            fbb106eb: '279',
            d051a7c4: '360',
            a6f19d9d: '369',
            '2f0bb3bc': '405',
            de04d02f: '614',
            '9e1169e2': '789',
            '7da3d90c': '816',
            '33fc5bb8': '867',
            b3765a0e: '1126',
            f4f4250e: '1229',
            a7456010: '1235',
            '27d4f2bc': '1543',
            '9e88f858': '1552',
            '25f93ae5': '1581',
            acecf23e: '1903',
            '73664a40': '1972',
            '8cf9041d': '2020',
            '2a2c6a18': '2057',
            e3cbe9d6: '2184',
            '9e4087bc': '2711',
            ccc49370: '3249',
            e06c5bb2: '3252',
            ea8f0c6c: '3357',
            '3e6482c4': '3518',
            ce435b68: '3587',
            f4f34a3a: '3637',
            '8717b14a': '3694',
            '3c83faec': '3753',
            c16354e2: '3880',
            e92b10e8: '4029',
            '393be207': '4134',
            '41da7453': '4202',
            '621db11d': '4212',
            d8a901a2: '4217',
            '489d66e1': '4462',
            '1df93b7f': '4583',
            f827ee9b: '4755',
            '6875c492': '4813',
            c8f8d5ec: '5009',
            '6924d0b3': '5163',
            e9830dac: '5522',
            d9f32620: '5557',
            b122249f: '5611',
            aba21aa0: '5742',
            '5b2a233e': '5744',
            bc1e63c5: '5769',
            '1f391b9e': '6061',
            '0afb47aa': '6355',
            '751a3bff': '6366',
            '49024b2f': '6406',
            '3355ad79': '6596',
            ad0b1a86: '6674',
            '1434367b': '6681',
            ff8b1e34: '6774',
            d465ea6f: '6918',
            '2636949b': '6998',
            a7bd4aaa: '7098',
            '3a56b529': '7442',
            '814f3328': '7472',
            '2eab1c41': '7632',
            a6aa9e1f: '7643',
            bc4d0067: '7747',
            '582e77b4': '7915',
            '5a924f76': '8065',
            '0973a1e6': '8083',
            daef146e: '8127',
            '01a85c17': '8209',
            '0c8b0ff1': '8411',
            '117e7c8a': '8506',
            '925b3f96': '8609',
            '07e03362': '8613',
            '58010f9e': '8633',
            '7661071f': '8737',
            b2faa355: '8866',
            '8949a3d1': '9006',
            a94703ab: '9048',
            e273c56f: '9328',
            '74c97d4c': '9340',
            '5e95c892': '9647',
            '36994c47': '9858',
            '542d5422': '9985',
          }[e] || e),
        t.p + t.u(e)
      );
    }),
    (() => {
      var e = { 5354: 0, 1869: 0 };
      ((t.f.j = (a, f) => {
        var c = t.o(e, a) ? e[a] : void 0;
        if (0 !== c)
          if (c) f.push(c[2]);
          else if (/^(1869|5354)$/.test(a)) e[a] = 0;
          else {
            var b = new Promise((f, b) => (c = e[a] = [f, b]));
            f.push((c[2] = b));
            var d = t.p + t.u(a),
              r = new Error();
            t.l(
              d,
              (f) => {
                if (t.o(e, a) && (0 !== (c = e[a]) && (e[a] = void 0), c)) {
                  var b = f && ('load' === f.type ? 'missing' : f.type),
                    d = f && f.target && f.target.src;
                  ((r.message = 'Loading chunk ' + a + ' failed.\n(' + b + ': ' + d + ')'),
                    (r.name = 'ChunkLoadError'),
                    (r.type = b),
                    (r.request = d),
                    c[1](r));
                }
              },
              'chunk-' + a,
              a
            );
          }
      }),
        (t.O.j = (a) => 0 === e[a]));
      var a = (a, f) => {
          var c,
            b,
            [d, r, o] = f,
            n = 0;
          if (d.some((a) => 0 !== e[a])) {
            for (c in r) t.o(r, c) && (t.m[c] = r[c]);
            if (o) var i = o(t);
          }
          for (a && a(f); n < d.length; n++)
            ((b = d[n]), t.o(e, b) && e[b] && e[b][0](), (e[b] = 0));
          return t.O(i);
        },
        f = (globalThis.webpackChunkdocs = globalThis.webpackChunkdocs || []);
      (f.forEach(a.bind(null, 0)), (f.push = a.bind(null, f.push.bind(f))));
    })());
})();
