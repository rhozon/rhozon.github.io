/* Interactive part of the airline competition case. Plain JavaScript + Chart.js.
   Logit demand and Bertrand-Nash pricing, solved in the browser from data.json
   (written by python -m bac.cli export). Prices inside the model are in hundreds of 2025 reais. */
(function () {
  var root = document.getElementById('bac-app');
  if (!root) return;
  var PT = (document.documentElement.lang || '').toLowerCase().indexOf('pt') === 0;
  var T = PT ? {
    tabs: ['Rota', 'Guerra de preços', 'Fusão', 'Entrada', 'Eventos'],
    route: 'Rota', alpha: 'Sensibilidade ao preço', low: 'menor', central: 'central', high: 'maior',
    carrier: 'Companhia', fare: 'Tarifa média', pax: 'Passageiros/mês', share: 'Fatia na rota', mc: 'Custo marginal implícito',
    margin: 'Margem', elas: 'Elasticidade', outside: 'Fatia de quem não voa nesta rota (bem externo)',
    who: 'Companhia que muda o preço', change: 'Mudança de tarifa', rivals: 'As rivais reagem até o novo equilíbrio. Com demanda logit, a melhor resposta de cada rival depende só da própria fatia, então ela se mexe pouco.',
    before: 'Antes', after: 'Depois', profit: 'Lucro/mês', pair: 'Companhias que se fundem',
    csTxt: 'Variação do excedente do consumidor nesta rota', perMonth: 'por mês',
    natTitle: 'Todas as rotas com as duas companhias (12 meses até mai/2026)',
    merging: 'Tarifa das que se fundem', rivalsF: 'Tarifa das rivais', paxCh: 'Passageiros', cs: 'Excedente do consumidor/mês', markets: 'Rotas',
    entCost: 'Custo da entrante vs. a de menor custo', entQual: 'Atratividade da entrante vs. a menos atrativa',
    entrant: 'Entrante de baixo custo', avTitle: 'Tarifas das rivais nas rotas que a Avianca Brasil deixou (vs. rotas de controle)',
    itaTitle: 'Tarifas das rivais nas rotas em que a ITA voou (vs. rotas de controle)', ref: 'mês de referência',
    check: 'Validação: o modelo prevê', observed: 'o observado foi', interval: 'intervalo de 95%',
    noRoute: 'Esta rota não tem as duas companhias.', loading: 'Carregando o modelo...'
  } : {
    tabs: ['Route', 'Price war', 'Merger', 'Entry', 'Events'],
    route: 'Route', alpha: 'Price sensitivity', low: 'lower', central: 'central', high: 'higher',
    carrier: 'Carrier', fare: 'Mean fare', pax: 'Passengers/month', share: 'Share of the route', mc: 'Implied marginal cost',
    margin: 'Margin', elas: 'Elasticity', outside: 'Share of those who do not fly this route (outside good)',
    who: 'Carrier that changes its fare', change: 'Fare change', rivals: 'Rivals respond until a new equilibrium. With logit demand a rival’s best response depends only on its own share, so it moves little.',
    before: 'Before', after: 'After', profit: 'Profit/month', pair: 'Carriers that merge',
    csTxt: 'Change in consumer surplus on this route', perMonth: 'per month',
    natTitle: 'All routes served by both carriers (12 months to May 2026)',
    merging: 'Fare of the merging carriers', rivalsF: 'Fare of the rivals', paxCh: 'Passengers', cs: 'Consumer surplus/month', markets: 'Routes',
    entCost: 'Entrant cost vs. the lowest-cost carrier', entQual: 'Entrant appeal vs. the least attractive carrier',
    entrant: 'Low-cost entrant', avTitle: 'Rivals’ fares on routes Avianca Brasil left (vs. control routes)',
    itaTitle: 'Rivals’ fares on routes ITA flew (vs. control routes)', ref: 'reference month',
    check: 'Check: the model predicts', observed: 'the observed change was', interval: '95% interval',
    noRoute: 'This route does not have both carriers.', loading: 'Loading the model...'
  };
  var C = {'TAM': '#b91c1c', 'GLO': '#ea580c', 'AZU': '#1d4ed8', 'ENT': '#0f766e'};
  function col(c) { return C[c] || '#6b7280'; }
  function fmt(x, d) { return Number(x).toLocaleString(PT ? 'pt-BR' : 'en-US', {minimumFractionDigits: d || 0, maximumFractionDigits: d || 0}); }
  function pct(x) { return (x >= 0 ? '+' : '') + fmt(100 * x, 1) + '%'; }
  function brl(x) { return 'R$ ' + fmt(x, 0); }
  function el(tag, attrs, html) { var e = document.createElement(tag); for (var k in (attrs || {})) e.setAttribute(k, attrs[k]); if (html != null) e.innerHTML = html; return e; }
  function control(parent, label, input, out) { var w = el('label', {class: 'bac-ctl'}); w.appendChild(el('span', {}, label)); w.appendChild(input); if (out) w.appendChild(out); parent.appendChild(w); return input; }
  function select(opts, val) { var s = el('select'); opts.forEach(function (o) { var op = el('option', {value: o[0]}, o[1]); if (String(o[0]) === String(val)) op.selected = true; s.appendChild(op); }); return s; }
  function range(min, max, step, val) { return el('input', {type: 'range', min: min, max: max, step: step, value: val}); }
  function chart(parent, cfg) { var box = el('div', {class: 'bac-chart'}); var cv = el('canvas'); box.appendChild(cv); parent.appendChild(box); cfg.options = cfg.options || {}; cfg.options.responsive = true; cfg.options.maintainAspectRatio = false; cfg.options.animation = false; return new Chart(cv, cfg); }

  // ---------- logit + Bertrand-Nash ----------
  function solveLin(A, b) {
    var n = b.length, M = A.map(function (r, i) { return r.concat([b[i]]); });
    for (var i = 0; i < n; i++) {
      var piv = i; for (var r = i + 1; r < n; r++) if (Math.abs(M[r][i]) > Math.abs(M[piv][i])) piv = r;
      var t = M[i]; M[i] = M[piv]; M[piv] = t;
      for (r = 0; r < n; r++) if (r !== i) { var f = M[r][i] / M[i][i]; for (var c = i; c <= n; c++) M[r][c] -= f * M[i][c]; }
    }
    return M.map(function (r, i) { return r[n] / r[i]; });
  }
  function shares(u) { var e = u.map(Math.exp), D = e.reduce(function (a, b) { return a + b; }, 0); return {s: e.map(function (x) { return x / (1 + D); }), s0: 1 / (1 + D), D: D}; }
  function markups(s, owner, a) {
    var n = s.length, A = [];
    for (var j = 0; j < n; j++) { A.push([]); for (var k = 0; k < n; k++) {
      var same = owner[j] === owner[k] ? 1 : 0;
      var dskdpj = j === k ? -a * s[j] * (1 - s[j]) : a * s[j] * s[k];   // d s_k / d p_j
      A[j].push(same * dskdpj);
    } }
    return solveLin(A, s.map(function (x) { return -x; }));
  }
  function recover(mk, a) {
    var s = mk.carriers.map(function (c) { return c.pax / mk.M; }), s0 = 1 - s.reduce(function (x, y) { return x + y; }, 0);
    var p = mk.carriers.map(function (c) { return c.price / 100; });
    var own = mk.carriers.map(function (c) { return c.code; });
    var mu = markups(s, own, a);
    return {p: p, s: s, s0: s0, owner: own, base: s.map(function (x, j) { return Math.log(x) - Math.log(s0) + a * p[j]; }),
            mc: p.map(function (x, j) { return x - mu[j]; })};
  }
  function equilibrium(base, mc, owner, a, p0, fixed) {
    var p = p0.slice();
    for (var it = 0; it < 3000; it++) {
      var sh = shares(base.map(function (b, j) { return b - a * p[j]; })).s;
      var mu = markups(sh, owner, a), mx = 0;
      for (var j = 0; j < p.length; j++) {
        if (fixed && fixed[j] != null) { p[j] = fixed[j]; continue; }
        var step = mc[j] + mu[j] - p[j]; mx = Math.max(mx, Math.abs(step)); p[j] += 0.5 * step;
      }
      if (mx < 1e-9) break;
    }
    var r = shares(base.map(function (b, j) { return b - a * p[j]; }));
    return {p: p, s: r.s, s0: r.s0, D: r.D};
  }
  function cs(D, a, M) { return M / a * Math.log(1 + D) * 100; }

  root.appendChild(el('p', {}, T.loading));
  fetch(root.getAttribute('data-src')).then(function (r) { return r.json(); }).then(build).catch(function (e) { root.innerHTML = '<p>data.json: ' + e + '</p>'; });

  function build(D) {
    root.innerHTML = '';
    var S = D.summary, alphas = {lo: S.alpha_low, c: S.alpha, hi: S.alpha_high};
    var top = el('div', {class: 'bac-ctls'}); root.appendChild(top);
    var sr = control(top, T.route, select(D.markets.map(function (m, i) { return [i, m.label]; }), 0));
    var sa = control(top, T.alpha, select([['lo', T.low + ' (' + fmt(S.alpha_low, 2) + ')'], ['c', T.central + ' (' + fmt(S.alpha, 2) + ')'], ['hi', T.high + ' (' + fmt(S.alpha_high, 2) + ')']], 'c'));
    var nav = el('div', {class: 'bac-tabs'}); root.appendChild(nav);
    var panes = T.tabs.map(function (t, i) { var b = el('button', {type: 'button'}, t); nav.appendChild(b); var p = el('div', {class: 'bac-pane'}); root.appendChild(p); b.addEventListener('click', function () { show(i); }); return {b: b, p: p}; });
    function show(i) { panes.forEach(function (x, j) { x.p.style.display = i === j ? 'block' : 'none'; x.b.classList.toggle('on', i === j); }); }
    var views = [routeTab(panes[0].p), warTab(panes[1].p), mergerTab(panes[2].p, D), entryTab(panes[3].p)];
    eventsTab(panes[4].p, D);
    function upd() { var mk = D.markets[+sr.value], a = alphas[sa.value]; views.forEach(function (v) { v(mk, a); }); }
    sr.addEventListener('input', upd); sa.addEventListener('input', upd); upd(); show(0);
  }

  function table(parent) { var t = el('table', {class: 'bac-table'}); parent.appendChild(t); return t; }
  function fill(t, head, rows) { t.innerHTML = '<thead><tr>' + head.map(function (h) { return '<th>' + h + '</th>'; }).join('') + '</tr></thead><tbody>' + rows.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + c + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody>'; }
  function dot(code, name) { return '<span class="bac-dot" style="background:' + col(code) + '"></span>' + name; }

  function routeTab(p) {
    var t = table(p), note = el('p', {class: 'bac-note'}); p.appendChild(note);
    return function (mk, a) {
      var r = recover(mk, a), tot = r.s.reduce(function (x, y) { return x + y; }, 0);
      fill(t, [T.carrier, T.fare, T.pax, T.share, T.mc, T.margin, T.elas], mk.carriers.map(function (c, j) {
        return [dot(c.code, c.name), brl(c.price), fmt(c.pax, 0), fmt(100 * r.s[j] / tot, 1) + '%', brl(100 * r.mc[j]),
                fmt(100 * (r.p[j] - r.mc[j]) / r.p[j], 0) + '%', fmt(-a * r.p[j] * (1 - r.s[j]), 2)];
      }));
      note.textContent = T.outside + ': ' + fmt(100 * r.s0, 1) + '%. ' + (PT ? 'Distância de cerca de ' : 'About ') + fmt(mk.km, 0) + ' km.';
    };
  }

  function warTab(p) {
    var ctl = el('div', {class: 'bac-ctls'}); p.appendChild(ctl);
    var sw = control(ctl, T.who, select([], null)), so = el('output'), sc = control(ctl, T.change, range(-30, 30, 1, -15), so);
    p.appendChild(el('p', {class: 'bac-note'}, T.rivals));
    var t = table(p), last = null;
    function draw() {
      if (!last) return; var mk = last[0], a = last[1], r = recover(mk, a), j0 = +sw.value, d = +sc.value / 100;
      so.textContent = pct(d);
      var fixed = r.p.map(function (x, j) { return j === j0 ? x * (1 + d) : null; });
      var e = equilibrium(r.base, r.mc, r.owner, a, r.p, fixed);
      fill(t, [T.carrier, T.fare + ' ' + T.before, T.after, T.pax + ' ' + T.after, T.profit + ' ' + T.before, T.after], mk.carriers.map(function (c, j) {
        var prof0 = (r.p[j] - r.mc[j]) * r.s[j] * mk.M * 100, prof1 = (e.p[j] - r.mc[j]) * e.s[j] * mk.M * 100;
        return [dot(c.code, c.name), brl(c.price), brl(100 * e.p[j]) + ' (' + pct(e.p[j] / r.p[j] - 1) + ')', fmt(e.s[j] * mk.M, 0) + ' (' + pct(e.s[j] / r.s[j] - 1) + ')', brl(prof0), brl(prof1)];
      }));
    }
    sw.addEventListener('input', draw); sc.addEventListener('input', draw);
    return function (mk, a) {
      var v = sw.value; sw.innerHTML = ''; mk.carriers.forEach(function (c, j) { var o = el('option', {value: j}, c.name); sw.appendChild(o); });
      if (v && +v < mk.carriers.length) sw.value = v; last = [mk, a]; draw();
    };
  }

  function mergerTab(p, D) {
    var ctl = el('div', {class: 'bac-ctls'}); p.appendChild(ctl);
    var pairs = [['AZU+GLO', 'Azul + Gol'], ['AZU+TAM', 'Azul + LATAM'], ['GLO+TAM', 'Gol + LATAM']];
    var sp = control(ctl, T.pair, select(pairs, 'AZU+GLO'));
    var t = table(p), csn = el('p', {class: 'bac-note'}); p.appendChild(csn);
    p.appendChild(el('h4', {}, T.natTitle)); var tn = table(p), last = null;
    function draw() {
      if (!last) return; var mk = last[0], a = last[1], ac = last[2], pair = sp.value.split('+');
      var r = recover(mk, a), codes = mk.carriers.map(function (c) { return c.code; });
      if (codes.indexOf(pair[0]) < 0 || codes.indexOf(pair[1]) < 0) { fill(t, [T.carrier], []); csn.textContent = T.noRoute; }
      else {
        var own = r.owner.map(function (o) { return pair.indexOf(o) >= 0 ? sp.value : o; });
        var e = equilibrium(r.base, r.mc, own, a, r.p), D0 = shares(r.base.map(function (b, j) { return b - a * r.p[j]; })).D;
        fill(t, [T.carrier, T.fare + ' ' + T.before, T.after, T.pax + ' ' + T.before, T.after], mk.carriers.map(function (c, j) {
          return [dot(c.code, c.name), brl(c.price), brl(100 * e.p[j]) + ' (' + pct(e.p[j] / r.p[j] - 1) + ')', fmt(c.pax, 0), fmt(e.s[j] * mk.M, 0) + ' (' + pct(e.s[j] / r.s[j] - 1) + ')'];
        }));
        csn.textContent = T.csTxt + ': ' + brl(cs(e.D, a, mk.M) - cs(D0, a, mk.M)) + ' ' + T.perMonth + '.';
      }
      var rows = D.mergers.filter(function (x) { return x.alpha_case === ac; }).map(function (x) {
        return [x.pair.replace('AZU', 'Azul').replace('GLO', 'Gol').replace('TAM', 'LATAM'), x.markets, pct(x.fare_change_merging), pct(x.fare_change_rivals), pct(x.pax_change), 'R$ ' + fmt(x.cs_change_month_brl / 1e6, 0) + (PT ? ' mi' : ' M')];
      });
      fill(tn, ['', T.markets, T.merging, T.rivalsF, T.paxCh, T.cs], rows);
    }
    sp.addEventListener('input', draw);
    return function (mk, a) { var ac = {}; ac[D.summary.alpha_low] = 'low'; ac[D.summary.alpha] = 'central'; ac[D.summary.alpha_high] = 'high'; last = [mk, a, ac[a]]; draw(); };
  }

  function entryTab(p) {
    var ctl = el('div', {class: 'bac-ctls'}); p.appendChild(ctl);
    var co = el('output'), sc = control(ctl, T.entCost, range(-40, 20, 5, -20), co);
    var qo = el('output'), sq = control(ctl, T.entQual, range(-1, 1, 0.1, 0), qo);
    var t = table(p), last = null;
    function draw() {
      if (!last) return; var mk = last[0], a = last[1], r = recover(mk, a), dc = +sc.value / 100, dq = +sq.value;
      co.textContent = pct(dc); qo.textContent = (dq >= 0 ? '+' : '') + fmt(dq, 1);
      var minMc = Math.min.apply(null, r.mc.filter(function (x) { return x > 0; }).concat([Math.min.apply(null, r.p) * 0.5]));
      var minDelta = Math.min.apply(null, r.base.map(function (b, j) { return b - a * r.p[j]; }));
      var base = r.base.concat([minDelta + dq + a * Math.min.apply(null, r.p)]), mc = r.mc.concat([minMc * (1 + dc)]);
      var own = r.owner.concat(['ENT']), p0 = r.p.concat([Math.min.apply(null, r.p)]);
      var e = equilibrium(base, mc, own, a, p0);
      var names = mk.carriers.map(function (c) { return [c.code, c.name]; }).concat([['ENT', T.entrant]]);
      fill(t, [T.carrier, T.fare + ' ' + T.after, T.pax + ' ' + T.after], names.map(function (n, j) {
        var ch = j < r.p.length ? ' (' + pct(e.p[j] / r.p[j] - 1) + ')' : '';
        var ch2 = j < r.p.length ? ' (' + pct(e.s[j] / r.s[j] - 1) + ')' : '';
        return [dot(n[0], n[1]), brl(100 * e.p[j]) + ch, fmt(e.s[j] * mk.M, 0) + ch2];
      }));
    }
    sc.addEventListener('input', draw); sq.addEventListener('input', draw);
    return function (mk, a) { last = [mk, a]; draw(); };
  }

  function eventsTab(p, D) {
    function series(code, title) {
      var rows = D.event_study.filter(function (r) { return r.carrier === code; });
      var lab = rows.map(function (r) { return r.year + '-' + String(r.month).padStart(2, '0'); });
      chart(p, {type: 'line', data: {labels: lab, datasets: [
        {label: title, data: rows.map(function (r) { return 100 * Math.expm1(r.coef); }), borderColor: '#0f766e', borderWidth: 2, pointRadius: 2},
        {label: T.interval, data: rows.map(function (r) { return 100 * Math.expm1(r.lo); }), borderColor: '#9ca3af', borderDash: [4, 4], pointRadius: 0, borderWidth: 1},
        {label: '', data: rows.map(function (r) { return 100 * Math.expm1(r.hi); }), borderColor: '#9ca3af', borderDash: [4, 4], pointRadius: 0, borderWidth: 1}]},
        options: {plugins: {title: {display: true, text: title + ' (%)'}, legend: {labels: {filter: function (i) { return i.text; }}}}}});
    }
    series('ONE', T.avTitle);
    var c = D.avianca_check.find(function (x) { return x.alpha_case === 'central'; });
    p.appendChild(el('p', {class: 'bac-note'}, T.check + ' ' + pct(c.predicted_fare_change) + '; ' + T.observed + ' ' + pct(c.observed_fare_change) + ' (' + T.interval + ' ' + pct(c.observed_lo) + (PT ? ' a ' : ' to ') + pct(c.observed_hi) + ').'));
    series('IPM', T.itaTitle);
  }
})();
