/* Interactive part of the ride-hailing pricing case. Plain JavaScript + Chart.js.
   All inputs come from data.json, written by the pipeline (python -m mdp.cli export). */
(function () {
  var root = document.getElementById('mdp-app');
  if (!root) return;
  var PT = (document.documentElement.lang || '').toLowerCase().indexOf('pt') === 0;
  var T = PT ? {
    tabs: ['Simulador de preço', 'Dinâmica de adaptação', 'Planejador de experimento', 'Passageiros e o crédito'],
    area: 'Área', day: 'Dia', weekday: 'Dia útil', weekend: 'Fim de semana', hour: 'Hora', price: 'Mudança de preço',
    elas: 'Elasticidade da demanda', low: 'baixa', central: 'central', high: 'alta',
    trips: 'Viagens por hora', revenue: 'Receita por hora', margin: 'Margem da plataforma por hora', wait: 'Espera média',
    share: 'Fatia da plataforma', pay: 'Repasse aos motoristas', vs: 'vs. preço atual', range: 'faixa',
    idx: 'Índice de preço dinâmico observado nesta área e hora', curve: 'Margem por hora conforme o preço',
    policy: 'Política de preço', fixed: 'Preço fixo', clearing: 'Surge que equilibra o mercado', smoothed: 'Surge suavizado',
    lam: 'Suavização (fração do ajuste por dia)', eta: 'Velocidade de imitação dos motoristas', shockA: 'Choque de demanda em',
    shock: 'Tamanho do choque', days: 'dia', mult: 'Multiplicador de preço', drivers: 'Fatia dos motoristas na área do choque',
    avgMargin: 'Margem média (dias 30 a 90)', avgWait: 'Espera média', pswing: 'Oscilação do preço', sswing: 'Oscilação da oferta',
    phase: 'Onde o preço começa a oscilar (desvio do multiplicador, política suavizada)',
    block: 'Duração de cada bloco', hours: 'horas', weeks: 'Semanas de teste', mde: 'Menor efeito detectável na margem',
    mdeNote: 'Teste switchback: a área inteira alterna entre a política atual e a nova em blocos sorteados. 5% de significância, 80% de poder.',
    gap: 'Fatia da Lyft dentro menos fora da zona de congestionamento', since: 'dias desde 1º de dezembro',
    credit: 'crédito de US$1,50 da Lyft (5/1 a 7/2)', y2025: 'dez/2024 a abr/2025', y2024: 'dez/2023 a abr/2024 (sem crédito)',
    perMin: 'min', loading: 'Carregando dados do modelo...'
  } : {
    tabs: ['Price simulator', 'Adaptation dynamics', 'Experiment planner', 'Riders and the credit'],
    area: 'Area', day: 'Day', weekday: 'Weekday', weekend: 'Weekend', hour: 'Hour', price: 'Price change',
    elas: 'Demand elasticity', low: 'low', central: 'central', high: 'high',
    trips: 'Trips per hour', revenue: 'Revenue per hour', margin: 'Platform margin per hour', wait: 'Mean wait',
    share: 'Platform share', pay: 'Driver pay', vs: 'vs. current price', range: 'range',
    idx: 'Observed dynamic price index in this area and hour', curve: 'Margin per hour as the price changes',
    policy: 'Pricing policy', fixed: 'Fixed price', clearing: 'Market-clearing surge', smoothed: 'Smoothed surge',
    lam: 'Smoothing (share of the gap closed per day)', eta: 'Driver imitation speed', shockA: 'Demand shock in',
    shock: 'Shock size', days: 'day', mult: 'Price multiplier', drivers: 'Drivers’ share in the shocked area',
    avgMargin: 'Mean margin (days 30 to 90)', avgWait: 'Mean wait', pswing: 'Price swing', sswing: 'Supply swing',
    phase: 'Where prices start to cycle (multiplier spread, smoothed policy)',
    block: 'Block length', hours: 'hours', weeks: 'Weeks of testing', mde: 'Minimum detectable effect on margin',
    mdeNote: 'Switchback test: the whole area alternates between the current and the new policy in randomly assigned blocks. 5% significance, 80% power.',
    gap: 'Lyft share inside minus outside the congestion zone', since: 'days since 1 December',
    credit: 'Lyft $1.50 credit (5 Jan to 7 Feb)', y2025: 'Dec 2024 to Apr 2025', y2024: 'Dec 2023 to Apr 2024 (no credit)',
    perMin: 'min', loading: 'Loading model data...'
  };
  var AREA_PT = {'Congestion zone': 'Zona de congestionamento', 'Manhattan north': 'Manhattan norte', 'Brooklyn': 'Brooklyn',
    'Queens': 'Queens', 'Bronx and Staten Island': 'Bronx e Staten Island', 'Airports': 'Aeroportos'};
  function an(a) { return PT ? (AREA_PT[a] || a) : a; }
  function fmt(x, d) { return Number(x).toLocaleString(PT ? 'pt-BR' : 'en-US', {minimumFractionDigits: d || 0, maximumFractionDigits: d || 0}); }
  function pct(x) { return (x >= 0 ? '+' : '') + fmt(100 * x, 1) + '%'; }
  function money(x) { return 'US$ ' + fmt(x, 0); }
  function el(tag, attrs, html) { var e = document.createElement(tag); for (var k in (attrs || {})) e.setAttribute(k, attrs[k]); if (html != null) e.innerHTML = html; return e; }
  function logit(s) { return Math.log(s / (1 - s)); }
  function expit(x) { return 1 / (1 + Math.exp(-x)); }
  var INK = getComputedStyle(document.body).color || '#222';
  var C1 = '#0f766e', C2 = '#c2410c', C3 = '#6b7280';

  root.appendChild(el('p', {class: 'mdp-loading'}, T.loading));
  fetch(root.getAttribute('data-src')).then(function (r) { return r.json(); }).then(build).catch(function (e) {
    root.innerHTML = '<p>Could not load data.json: ' + e + '</p>';
  });

  function control(parent, label, input, out) {
    var w = el('label', {class: 'mdp-ctl'}); w.appendChild(el('span', {}, label)); w.appendChild(input);
    if (out) w.appendChild(out); parent.appendChild(w); return input;
  }
  function select(opts, val) { var s = el('select'); opts.forEach(function (o) { var op = el('option', {value: o[0]}, o[1]); if (String(o[0]) === String(val)) op.selected = true; s.appendChild(op); }); return s; }
  function range(min, max, step, val) { return el('input', {type: 'range', min: min, max: max, step: step, value: val}); }
  function card(parent, label) { var c = el('div', {class: 'mdp-card'}); c.appendChild(el('div', {class: 'mdp-card-l'}, label)); var v = el('div', {class: 'mdp-card-v'}); c.appendChild(v); var s = el('div', {class: 'mdp-card-s'}); c.appendChild(s); parent.appendChild(c); return {v: v, s: s}; }
  function chart(parent, cfg) { var box = el('div', {class: 'mdp-chart'}); var cv = el('canvas'); box.appendChild(cv); parent.appendChild(box); cfg.options = cfg.options || {}; cfg.options.responsive = true; cfg.options.maintainAspectRatio = false; cfg.options.animation = false; return new Chart(cv, cfg); }

  function build(D) {
    root.innerHTML = '';
    var P = D.params, areas = D.areas;
    var nav = el('div', {class: 'mdp-tabs', role: 'tablist'}); root.appendChild(nav);
    var panes = T.tabs.map(function (t, i) {
      var b = el('button', {type: 'button', role: 'tab'}, t); nav.appendChild(b);
      var p = el('div', {class: 'mdp-pane'}); root.appendChild(p);
      b.addEventListener('click', function () { show(i); }); return {b: b, p: p};
    });
    function show(i) { panes.forEach(function (x, j) { x.p.style.display = i === j ? 'block' : 'none'; x.b.classList.toggle('on', i === j); }); }
    priceTab(panes[0].p, D, P, areas); dynTab(panes[1].p, D, P, areas); expTab(panes[2].p, D); creditTab(panes[3].p, D);
    show(0);
  }

  // ---------- 1. price simulator ----------
  function priceTab(p, D, P, areas) {
    var ctl = el('div', {class: 'mdp-ctls'}); p.appendChild(ctl);
    var sa = control(ctl, T.area, select(areas.map(function (a) { return [a, an(a)]; }), areas[0]));
    var sd = control(ctl, T.day, select([[0, T.weekday], [1, T.weekend]], 0));
    var ho = el('output'); var sh = control(ctl, T.hour, range(0, 23, 1, 18), ho);
    var po = el('output'); var sp = control(ctl, T.price, range(-20, 30, 1, 10), po);
    var se = control(ctl, T.elas, select([['lo', T.low + ' (-0.2)'], ['c', T.central + ' (-0.4)'], ['hi', T.high + ' (-0.6)']], 'c'));
    var idx = el('p', {class: 'mdp-note'}); p.appendChild(idx);
    var cards = el('div', {class: 'mdp-cards'}); p.appendChild(cards);
    var cT = card(cards, T.trips), cR = card(cards, T.revenue), cM = card(cards, T.margin), cW = card(cards, T.wait), cS = card(cards, T.share);
    var ch = chart(p, {type: 'line', data: {labels: [], datasets: [
      {label: T.margin, data: [], borderColor: C1, pointRadius: 0, borderWidth: 2},
      {label: T.range + ' (-0.2)', data: [], borderColor: C3, borderDash: [4, 4], pointRadius: 0, borderWidth: 1},
      {label: T.range + ' (-0.6)', data: [], borderColor: C3, borderDash: [4, 4], pointRadius: 0, borderWidth: 1}]},
      options: {plugins: {title: {display: true, text: T.curve}}, scales: {x: {title: {display: true, text: T.price + ' (%)'}}}}});
    function base(a, wk, h) {
      var f = function (pl) { return D.profiles.find(function (r) { return r.area === a && r.weekend === wk && r.hour === h && r.platform === pl; }); };
      var l = f('lyft'), u = f('uber'); return {Q: l.trips, p0: l.fare, th: l.theta, w0: l.wait, s0: l.trips / (l.trips + u.trips)};
    }
    function outcome(b, d, eps) {
      var m = 1 + d, L0 = logit(b.s0), s = b.s0, w = b.w0, q = b.Q;
      for (var i = 0; i < 30; i++) { q = b.Q * Math.pow(m, eps) * s / b.s0; w = b.w0 * Math.pow(q / b.Q, P.alpha); s = expit(L0 - P.beta_p * Math.log(m) - P.beta_w * (w - b.w0)); }
      var rev = m * b.p0 * q; return {q: q, rev: rev, margin: (1 - b.th) * rev, w: w, s: s};
    }
    function upd() {
      var a = sa.value, wk = +sd.value, h = +sh.value, d = +sp.value / 100;
      var eps = {lo: P.eps_hi, c: P.eps, hi: P.eps_lo}[se.value];
      ho.textContent = h + ':00'; po.textContent = pct(d);
      var b = base(a, wk, h), o = outcome(b, d, eps), z = outcome(b, 0, eps);
      var lo = outcome(b, d, P.eps_hi), hi = outcome(b, d, P.eps_lo);
      cT.v.textContent = fmt(o.q, 0); cT.s.textContent = pct(o.q / z.q - 1) + ' ' + T.vs;
      cR.v.textContent = money(o.rev); cR.s.textContent = pct(o.rev / z.rev - 1);
      cM.v.textContent = money(o.margin); cM.s.textContent = pct(o.margin / z.margin - 1) + ' (' + T.range + ' ' + pct(hi.margin / z.margin - 1) + ' ' + (PT ? 'a' : 'to') + ' ' + pct(lo.margin / z.margin - 1) + ')';
      cW.v.textContent = fmt(o.w, 1) + ' ' + T.perMin; cW.s.textContent = (o.w - z.w >= 0 ? '+' : '') + fmt(o.w - z.w, 2) + ' ' + T.perMin;
      cS.v.textContent = fmt(100 * o.s, 1) + '%'; cS.s.textContent = (PT ? 'era ' : 'was ') + fmt(100 * z.s, 1) + '%';
      var pi = D.price_index.find(function (r) { return r.area === a && r.weekend === wk && r.hour === h; });
      idx.textContent = T.idx + ': ' + (pi ? fmt(pi.index, 2) : 'n/a');
      var xs = [], y0 = [], y1 = [], y2 = [];
      for (var k = -20; k <= 30; k += 2) { xs.push(k); y0.push(outcome(b, k / 100, eps).margin); y1.push(outcome(b, k / 100, P.eps_hi).margin); y2.push(outcome(b, k / 100, P.eps_lo).margin); }
      ch.data.labels = xs; ch.data.datasets[0].data = y0; ch.data.datasets[1].data = y1; ch.data.datasets[2].data = y2; ch.update();
    }
    [sa, sd, sh, sp, se].forEach(function (x) { x.addEventListener('input', upd); }); upd();
  }

  // ---------- 2. evolutionary dynamics (same equations as mdp/simulate.py) ----------
  function simulate(cal, P, policy, eta, lam, shockArea, shock, days) {
    var K = cal.length, Qb = cal.map(function (c) { return c.Q; }), sumQ = Qb.reduce(function (a, b) { return a + b; }, 0);
    var x0 = Qb.map(function (q) { return q / sumQ; }), Q = Qb.slice(); Q[shockArea] *= 1 + shock;
    var x = x0.slice(), L0 = cal.map(function (c) { return logit(c.s0); }), L = L0.slice(), mPrev = Qb.map(function () { return 1; });
    var e0 = cal.map(function (c, k) { return c.theta * c.p0 * Qb[k] / x0[k]; });
    var out = {m: [], x: [], w: [], q: [], margin: []};
    for (var t = 0; t < days; t++) {
      var s = L.map(expit), m = [];
      for (var k = 0; k < K; k++) {
        var clear = Math.pow((x[k] / x0[k]) / (s[k] / cal[k].s0) * (Qb[k] / Q[k]), 1 / P.eps);
        clear = Math.min(P.m_max, Math.max(P.m_min, clear));
        m.push(policy === 'fixed' ? 1 : policy === 'clearing' ? clear : mPrev[k] + lam * (clear - mPrev[k]));
      }
      var q = [], w = [], pi = [], marg = 0;
      for (k = 0; k < K; k++) {
        q[k] = Q[k] * Math.pow(m[k], P.eps) * s[k] / cal[k].s0;
        w[k] = cal[k].w0 * Math.pow((q[k] / Qb[k]) * (x0[k] / x[k]), P.alpha);
        var rev = m[k] * cal[k].p0 * q[k], pay = cal[k].theta * rev; marg += rev - pay; pi[k] = (pay / x[k]) / e0[k];
      }
      out.m.push(m.slice()); out.x.push(x.slice()); out.w.push(w.slice()); out.q.push(q.slice()); out.margin.push(marg);
      var avg = 0; for (k = 0; k < K; k++) avg += x[k] * pi[k];
      var g = [], tot = 0;
      for (k = 0; k < K; k++) {
        L[k] = P.rho * L[k] + (1 - P.rho) * (L0[k] - P.beta_p * Math.log(m[k]) - P.beta_w * (w[k] - cal[k].w0));
        g[k] = x[k] * Math.exp(Math.max(-5, Math.min(5, eta * (pi[k] - avg)))); tot += g[k];
      }
      var t2 = 0; for (k = 0; k < K; k++) { x[k] = Math.max(g[k] / tot, 1e-4); t2 += x[k]; }
      for (k = 0; k < K; k++) x[k] /= t2;
      mPrev = m;
    }
    return out;
  }
  function std(a) { var m = a.reduce(function (s, v) { return s + v; }, 0) / a.length; return Math.sqrt(a.reduce(function (s, v) { return s + (v - m) * (v - m); }, 0) / a.length); }

  function dynTab(p, D, P, areas) {
    var cal = areas.map(function (a) { return D.calibration.find(function (c) { return c.area === a; }); });
    var ctl = el('div', {class: 'mdp-ctls'}); p.appendChild(ctl);
    var sp = control(ctl, T.policy, select([['fixed', T.fixed], ['clearing', T.clearing], ['smoothed', T.smoothed]], 'clearing'));
    var lo = el('output'); var sl = control(ctl, T.lam, range(0.1, 1, 0.05, 0.3), lo);
    var eo = el('output'); var se = control(ctl, T.eta, range(0.25, 4, 0.25, 1), eo);
    var sa = control(ctl, T.shockA, select(areas.map(function (a, i) { return [i, an(a)]; }), 0));
    var so = el('output'); var ss = control(ctl, T.shock, range(-30, 50, 5, 25), so);
    var cards = el('div', {class: 'mdp-cards'}); p.appendChild(cards);
    var cM = card(cards, T.avgMargin), cW = card(cards, T.avgWait), cP = card(cards, T.pswing), cS = card(cards, T.sswing);
    var days = 90, lab = []; for (var i = 0; i < days; i++) lab.push(i);
    var c1 = chart(p, {type: 'line', data: {labels: lab, datasets: areas.map(function (a, i) { return {label: an(a), data: [], borderWidth: i === 0 ? 2.5 : 1, pointRadius: 0}; })},
      options: {plugins: {title: {display: true, text: T.mult}}, scales: {x: {title: {display: true, text: T.days}}}}});
    var c2 = chart(p, {type: 'line', data: {labels: lab, datasets: [{label: T.drivers, data: [], borderColor: C2, pointRadius: 0, borderWidth: 2}]},
      options: {plugins: {title: {display: true, text: T.drivers}}, scales: {x: {title: {display: true, text: T.days}}}}});
    p.appendChild(el('p', {class: 'mdp-note'}, T.phase));
    var heat = el('div', {class: 'mdp-heat'}); p.appendChild(heat); drawPhase(heat, D.phase);
    function upd() {
      var pol = sp.value, lam = +sl.value, eta = +se.value, k0 = +sa.value, sh = +ss.value / 100;
      lo.textContent = fmt(lam, 2); eo.textContent = fmt(eta, 2); so.textContent = pct(sh);
      sl.disabled = pol !== 'smoothed';
      var r = simulate(cal, P, pol, eta, lam, k0, sh, days), tail = function (a) { return a.slice(30); };
      var mm = tail(r.margin).reduce(function (s, v) { return s + v; }, 0) / 60;
      var wq = 0, qq = 0; tail(r.w).forEach(function (w, t) { w.forEach(function (v, k) { wq += v * r.q[t + 30][k]; qq += r.q[t + 30][k]; }); });
      var pswing = 0, sswing = 0;
      for (var k = 0; k < areas.length; k++) {
        pswing = Math.max(pswing, std(tail(r.m).map(function (v) { return v[k]; })));
        var xs = tail(r.x).map(function (v) { return v[k]; }), mu = xs.reduce(function (s, v) { return s + v; }, 0) / xs.length;
        sswing = Math.max(sswing, std(xs) / mu);
      }
      cM.v.textContent = money(mm); cW.v.textContent = fmt(wq / qq, 2) + ' ' + T.perMin;
      cP.v.textContent = fmt(pswing, 2); cS.v.textContent = fmt(100 * sswing, 0) + '%';
      areas.forEach(function (a, i) { c1.data.datasets[i].data = r.m.map(function (v) { return v[i]; }); });
      c1.update(); c2.data.datasets[0].data = r.x.map(function (v) { return v[k0]; }); c2.update();
    }
    [sp, sl, se, sa, ss].forEach(function (x) { x.addEventListener('input', upd); }); upd();
  }
  function drawPhase(box, rows) {
    var etas = Array.from(new Set(rows.map(function (r) { return r.eta; }))).sort(function (a, b) { return a - b; });
    var lams = Array.from(new Set(rows.map(function (r) { return r.lam; }))).sort(function (a, b) { return b - a; });
    var cv = el('canvas', {width: 640, height: 320}); box.appendChild(cv); var g = cv.getContext('2d');
    var L = 56, B = 40, W = 640 - L - 10, H = 320 - B - 10, cw = W / etas.length, chh = H / lams.length;
    var vmax = Math.max.apply(null, rows.map(function (r) { return r.price_swing; })) || 1;
    rows.forEach(function (r) {
      var i = etas.indexOf(r.eta), j = lams.indexOf(r.lam), v = Math.min(1, r.price_swing / vmax);
      g.fillStyle = 'rgba(194,65,12,' + (0.06 + 0.9 * v) + ')'; g.fillRect(L + i * cw, 10 + j * chh, cw - 1, chh - 1);
    });
    g.fillStyle = INK; g.font = '12px sans-serif'; g.textAlign = 'center';
    etas.forEach(function (e, i) { if (i % 3 === 0) g.fillText(fmt(e, 2), L + i * cw + cw / 2, 320 - B + 14); });
    g.fillText(T.eta, L + W / 2, 320 - 6);
    g.textAlign = 'right'; lams.forEach(function (l, j) { if (j % 2 === 0) g.fillText(fmt(l, 1), L - 6, 10 + j * chh + chh / 2 + 4); });
    g.save(); g.translate(14, 10 + H / 2); g.rotate(-Math.PI / 2); g.textAlign = 'center'; g.fillText(PT ? 'suavização' : 'smoothing', 0, 0); g.restore();
  }

  // ---------- 3. switchback planner ----------
  function expTab(p, D) {
    var ctl = el('div', {class: 'mdp-ctls'}); p.appendChild(ctl);
    var sb = control(ctl, T.block, select(D.switchback.map(function (r) { return [r.block_hours, r.block_hours + ' ' + T.hours]; }), 4));
    var wo = el('output'); var sw = control(ctl, T.weeks, range(1, 8, 1, 2), wo);
    var cards = el('div', {class: 'mdp-cards'}); p.appendChild(cards); var cm = card(cards, T.mde);
    p.appendChild(el('p', {class: 'mdp-note'}, T.mdeNote));
    var Z = 1.959964 + 0.841621;
    var ch = chart(p, {type: 'line', data: {labels: [1, 2, 3, 4, 5, 6, 7, 8], datasets: [{label: T.mde, data: [], borderColor: C1, borderWidth: 2}]},
      options: {plugins: {title: {display: true, text: T.mde + ' (%)'}}, scales: {x: {title: {display: true, text: T.weeks}}}}});
    function mde(sd, wk, b) { return Math.expm1(Z * sd * Math.sqrt(4 / (wk * 7 * 24 / b))); }
    function upd() {
      var b = +sb.value, wk = +sw.value, r = D.switchback.find(function (x) { return x.block_hours === b; });
      wo.textContent = wk; cm.v.textContent = fmt(100 * mde(r.sd_log, wk, b), 1) + '%';
      cm.s.textContent = 'sd = ' + fmt(r.sd_log, 3);
      ch.data.datasets[0].data = [1, 2, 3, 4, 5, 6, 7, 8].map(function (w) { return 100 * mde(r.sd_log, w, b); }); ch.update();
    }
    [sb, sw].forEach(function (x) { x.addEventListener('input', upd); }); upd();
  }

  // ---------- 4. riders and the Lyft credit ----------
  function creditTab(p, D) {
    var a = D.event.filter(function (r) { return r.year === '2024-25'; }), b = D.event.filter(function (r) { return r.year === '2023-24'; });
    var n = Math.max(a.length ? a[a.length - 1].day : 0, b.length ? b[b.length - 1].day : 0), lab = [];
    for (var i = 0; i <= n; i++) lab.push(i);
    var ser = function (rows) { var m = {}; rows.forEach(function (r) { m[r.day] = 100 * r.gap; }); return lab.map(function (d) { return d in m ? m[d] : null; }); };
    chart(p, {type: 'line', data: {labels: lab, datasets: [
      {label: T.y2025, data: ser(a), borderColor: C2, pointRadius: 0, borderWidth: 2, spanGaps: true},
      {label: T.y2024, data: ser(b), borderColor: C3, pointRadius: 0, borderWidth: 1.5, spanGaps: true}]},
      options: {plugins: {title: {display: true, text: T.gap + ' (p.p.)'}, subtitle: {display: true, text: T.credit + (PT ? ': dias 35 a 68' : ': days 35 to 68')}},
        scales: {x: {title: {display: true, text: T.since}}}}});
  }
})();
