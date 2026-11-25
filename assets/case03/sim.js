/* Demonstration app for the portfolio optimisation case: NSGA-II (Deb et al., 2002) running in the
   browser on public weekly futures returns (Yahoo Finance). Not the results of the manuscripts. */
(function (G) {
  // ---- engine -------------------------------------------------------------------------------
  function rng(seed) { var a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function repair(g, cap) {
    var k = g.length, w = g.map(function (x) { return Math.max(x, 1e-9); }), s = w.reduce(function (a, b) { return a + b; }, 0);
    w = w.map(function (x) { return x / s; });
    if (cap >= 1) return w;
    for (var it = 0; it < 50; it++) {
      var over = 0, free = 0;
      w.forEach(function (x) { if (x > cap) over += x - cap; else free += x; });
      if (over < 1e-12) break;
      w = w.map(function (x) { return x > cap ? cap : x + over * x / free; });
    }
    return w;
  }
  function evaluate(w, R, third) {
    var n = R.length, k = w.length, pr = new Float64Array(n), m = 0, i, j;
    for (i = 0; i < n; i++) { var s = 0; for (j = 0; j < k; j++) s += w[j] * R[i][j]; pr[i] = s; m += s; }
    m /= n; var v = 0; for (i = 0; i < n; i++) v += (pr[i] - m) * (pr[i] - m); var sd = Math.sqrt(v / (n - 1));
    var t = 0;
    if (third === 'cvar') { var srt = Array.prototype.slice.call(pr).sort(function (a, b) { return a - b; }), q = Math.max(1, Math.floor(0.05 * n)); for (i = 0; i < q; i++) t -= srt[i]; t /= q; }
    else if (third === 'mdd') { var cum = 0, peak = 0; for (i = 0; i < n; i++) { cum += pr[i]; if (cum > peak) peak = cum; if (peak - cum > t) t = peak - cum; } }
    return {mean: m, sd: sd, third: t, f: third === 'none' ? [-m, sd] : [-m, sd, t]};
  }
  function dominates(a, b) { var better = false; for (var i = 0; i < a.length; i++) { if (a[i] > b[i]) return false; if (a[i] < b[i]) better = true; } return better; }
  function sortFronts(P) {
    var S = P.map(function () { return []; }), n = P.map(function () { return 0; }), F = [[]];
    for (var p = 0; p < P.length; p++) {
      for (var q = 0; q < P.length; q++) { if (p === q) continue; if (dominates(P[p].o.f, P[q].o.f)) S[p].push(q); else if (dominates(P[q].o.f, P[p].o.f)) n[p]++; }
      if (n[p] === 0) { P[p].rank = 0; F[0].push(p); }
    }
    for (var i = 0; F[i].length; i++) { var Q = []; F[i].forEach(function (p) { S[p].forEach(function (q) { if (--n[q] === 0) { P[q].rank = i + 1; Q.push(q); } }); }); F.push(Q); }
    F.pop(); return F;
  }
  function crowding(P, front) {
    front.forEach(function (i) { P[i].cd = 0; });
    var M = P[front[0]].o.f.length;
    for (var m = 0; m < M; m++) {
      var s = front.slice().sort(function (a, b) { return P[a].o.f[m] - P[b].o.f[m]; }), lo = P[s[0]].o.f[m], hi = P[s[s.length - 1]].o.f[m];
      P[s[0]].cd = P[s[s.length - 1]].cd = Infinity;
      if (hi - lo < 1e-15) continue;
      for (var i = 1; i < s.length - 1; i++) P[s[i]].cd += (P[s[i + 1]].o.f[m] - P[s[i - 1]].o.f[m]) / (hi - lo);
    }
  }
  function nsga2(R, opt, onGen) {
    var k = R[0].length, u = rng(opt.seed || 1), N = opt.pop, cap = opt.cap, third = opt.third;
    function mk(g) { var w = repair(g, cap); return {g: g, w: w, o: evaluate(w, R, third)}; }
    var P = []; for (var i = 0; i < N; i++) { var g = []; for (var j = 0; j < k; j++) g.push(u()); P.push(mk(g)); }
    sortFronts(P).forEach(function (f) { crowding(P, f); });
    function tour() { var a = P[Math.floor(u() * N)], b = P[Math.floor(u() * N)]; return a.rank < b.rank || (a.rank === b.rank && a.cd > b.cd) ? a : b; }
    var gen = 0;
    function step() {
      var Q = [];
      while (Q.length < N) {
        var p1 = tour().g, p2 = tour().g, c1 = p1.slice(), c2 = p2.slice();
        if (u() < 0.9) for (var j = 0; j < k; j++) { if (u() < 0.5 && Math.abs(p1[j] - p2[j]) > 1e-12) { var r = u(), b = r <= 0.5 ? Math.pow(2 * r, 1 / 16) : Math.pow(1 / (2 - 2 * r), 1 / 16); c1[j] = 0.5 * ((1 + b) * p1[j] + (1 - b) * p2[j]); c2[j] = 0.5 * ((1 - b) * p1[j] + (1 + b) * p2[j]); } }
        [c1, c2].forEach(function (c) { for (var j = 0; j < k; j++) { if (u() < 1 / k) { var r = u(), d = r < 0.5 ? Math.pow(2 * r, 1 / 21) - 1 : 1 - Math.pow(2 - 2 * r, 1 / 21); c[j] += d; } c[j] = Math.min(1, Math.max(0, c[j])); } Q.push(mk(c)); });
      }
      var U = P.concat(Q.slice(0, N)), F = sortFronts(U), next = [];
      for (var f = 0; f < F.length && next.length < N; f++) {
        crowding(U, F[f]);
        if (next.length + F[f].length <= N) F[f].forEach(function (i) { next.push(U[i]); });
        else F[f].slice().sort(function (a, b) { return U[b].cd - U[a].cd; }).slice(0, N - next.length).forEach(function (i) { next.push(U[i]); });
      }
      P = next; sortFronts(P).forEach(function (fr) { crowding(P, fr); }); gen++;
      return P;
    }
    return {step: step, pop: function () { return P; }, gen: function () { return gen; }};
  }
  var API = {nsga2: nsga2, evaluate: evaluate, repair: repair};
  if (typeof module !== 'undefined' && module.exports) { module.exports = API; return; }

  // ---- page ---------------------------------------------------------------------------------
  var root = document.getElementById('po-app');
  if (!root) return;
  var PT = (document.documentElement.lang || '').toLowerCase().indexOf('pt') === 0;
  var T = PT ? {
    tabs: ['Fronteira com NSGA-II', 'Regimes mudam a fronteira'],
    third: 'Terceiro objetivo', cvar: 'CVaR 95% (perda média nas 5% piores semanas)', mdd: 'Maior queda acumulada', none: 'Nenhum (só retorno e risco)',
    regime: 'Semanas usadas', all: 'Todas', calm: 'Calmas', turb: 'Turbulentas', cap: 'Peso máximo por ativo', pop: 'População', gens: 'Gerações', run: 'Rodar o NSGA-II',
    ret: 'Retorno anualizado', vol: 'Volatilidade anualizada', exact: 'Fronteira exata de média e variância (programação quadrática)', nsga: 'Portfólios não dominados do NSGA-II', gen: 'geração',
    pick: 'Clique num portfólio para ver os pesos.', weights: 'Pesos do portfólio escolhido', cvarL: 'CVaR 95% semanal', mddL: 'Maior queda',
    gap: 'Distância média do NSGA-II à fronteira exata, em volatilidade', note: 'O algoritmo devolve um conjunto de portfólios em que melhorar um objetivo custa outro; a escolha do ponto fica com quem decide. Com o terceiro objetivo desligado e sem teto de peso, a fronteira exata de média e variância serve de gabarito.',
    regNote: 'Fronteira exata de média e variância (só posições compradas) estimada com as semanas calmas, as turbulentas e todas. Turbulenta é a semana em que a volatilidade de 13 semanas de uma carteira com pesos iguais está acima da mediana. O mesmo nível de risco compra retornos diferentes conforme o regime, e a composição muda.',
    assets: {corn: 'Milho', soybeans: 'Soja', wheat: 'Trigo', soy_meal: 'Farelo de soja', soy_oil: 'Óleo de soja', coffee: 'Café', sugar: 'Açúcar', cotton: 'Algodão', live_cattle: 'Boi gordo (CME)'},
    demo: 'Demonstração do método em retornos semanais públicos de futuros. Não são os resultados dos artigos em revisão.', loading: 'Carregando...'
  } : {
    tabs: ['Frontier with NSGA-II', 'Regimes change the frontier'],
    third: 'Third objective', cvar: 'CVaR 95% (mean loss in the worst 5% of weeks)', mdd: 'Maximum drawdown', none: 'None (return and risk only)',
    regime: 'Weeks used', all: 'All', calm: 'Calm', turb: 'Turbulent', cap: 'Maximum weight per asset', pop: 'Population', gens: 'Generations', run: 'Run NSGA-II',
    ret: 'Annualised return', vol: 'Annualised volatility', exact: 'Exact mean-variance frontier (quadratic programming)', nsga: 'Non-dominated portfolios from NSGA-II', gen: 'generation',
    pick: 'Click a portfolio to see its weights.', weights: 'Weights of the chosen portfolio', cvarL: 'Weekly CVaR 95%', mddL: 'Maximum drawdown',
    gap: 'Mean distance from NSGA-II to the exact frontier, in volatility', note: 'The algorithm returns a set of portfolios where improving one objective costs another; choosing the point is left to whoever decides. With the third objective off and no weight cap, the exact mean-variance frontier is the answer key.',
    regNote: 'Exact mean-variance frontier (long only) estimated on the calm weeks, the turbulent weeks and all weeks. A week is turbulent when the 13-week volatility of an equal-weight basket is above its median. The same level of risk buys different returns depending on the regime, and the mix changes.',
    assets: {corn: 'Corn', soybeans: 'Soybeans', wheat: 'Wheat', soy_meal: 'Soybean meal', soy_oil: 'Soybean oil', coffee: 'Coffee', sugar: 'Sugar', cotton: 'Cotton', live_cattle: 'Live cattle'},
    demo: 'A demonstration of the method on public weekly futures returns. These are not the results of the manuscripts under review.', loading: 'Loading...'
  };
  var C = {main: '#0f766e', alt: '#c2410c', grey: '#64748b', calm: '#0369a1', turb: '#b91c1c'};
  function fmt(x, d) { return Number(x).toLocaleString(PT ? 'pt-BR' : 'en-US', {minimumFractionDigits: d, maximumFractionDigits: d}); }
  function pct(x, d) { return fmt(100 * x, d == null ? 1 : d) + '%'; }
  function el(tag, attrs, html) { var e = document.createElement(tag); for (var k in (attrs || {})) e.setAttribute(k, attrs[k]); if (html != null) e.innerHTML = html; return e; }
  function control(parent, label, input, out) { var w = el('label', {class: 'po-ctl'}); w.appendChild(el('span', {}, label)); w.appendChild(input); if (out) w.appendChild(out); parent.appendChild(w); return input; }
  function select(opts, val) { var s = el('select'); opts.forEach(function (o) { var op = el('option', {value: o[0]}, o[1]); if (o[0] === val) op.selected = true; s.appendChild(op); }); return s; }
  function range(min, max, step, val) { return el('input', {type: 'range', min: min, max: max, step: step, value: val}); }
  function card(parent, label) { var c = el('div', {class: 'po-card'}); c.appendChild(el('div', {class: 'po-card-l'}, label)); var v = el('div', {class: 'po-card-v'}); c.appendChild(v); var s = el('div', {class: 'po-card-s'}); c.appendChild(s); parent.appendChild(c); return {v: v, s: s}; }
  function chartBox(p, cls) { var b = el('div', {class: 'po-chart ' + (cls || '')}); var cv = el('canvas'); b.appendChild(cv); p.appendChild(b); return cv; }
  var A = 52, SA = Math.sqrt(52);
  function scatterOpts() {
    var c = getComputedStyle(root).color;
    return {responsive: true, maintainAspectRatio: false, animation: false, parsing: false,
      plugins: {legend: {labels: {color: c, boxWidth: 14}}, tooltip: {callbacks: {label: function (x) { return pct(x.raw.y) + ' / ' + pct(x.raw.x); }}}},
      scales: {x: {type: 'linear', title: {display: true, text: T.vol, color: c}, ticks: {color: c, callback: function (v) { return pct(v, 0); }}, grid: {color: 'rgba(127,127,127,.15)'}},
        y: {title: {display: true, text: T.ret, color: c}, ticks: {color: c, callback: function (v) { return pct(v, 0); }}, grid: {color: 'rgba(127,127,127,.15)'}}}};
  }
  function color(t) { var a = [15, 118, 110], b = [194, 65, 12]; return 'rgb(' + a.map(function (x, i) { return Math.round(x + t * (b[i] - x)); }).join(',') + ')'; }

  root.appendChild(el('p', {}, T.loading));
  fetch(root.getAttribute('data-src')).then(function (r) { return r.json(); }).then(build).catch(function (e) { root.innerHTML = '<p>data.json: ' + e + '</p>'; });

  function build(D) {
    root.innerHTML = '';
    root.appendChild(el('p', {class: 'po-demo'}, T.demo));
    var nav = el('div', {class: 'po-tabs'}); root.appendChild(nav);
    var panes = T.tabs.map(function (t, i) { var b = el('button', {type: 'button'}, t); nav.appendChild(b); var p = el('div', {class: 'po-pane'}); root.appendChild(p); b.addEventListener('click', function () { show(i); }); return {b: b, p: p}; });
    var made = {}, makers = [frontierTab, regimeTab];
    function show(i) { panes.forEach(function (x, j) { x.p.style.display = i === j ? 'block' : 'none'; x.b.classList.toggle('on', i === j); }); if (!made[i]) { made[i] = 1; makers[i](panes[i].p, D); } }
    show(0);
  }

  function frontierTab(p, D) {
    var ctl = el('div', {class: 'po-ctls'}); p.appendChild(ctl);
    var sT = control(ctl, T.third, select([['cvar', T.cvar], ['mdd', T.mdd], ['none', T.none]], 'cvar'));
    var sR = control(ctl, T.regime, select([['all', T.all], ['calm', T.calm], ['turbulent', T.turb]], 'all'));
    var co = el('output'), sCap = control(ctl, T.cap, range(0.15, 1, 0.05, 1), co);
    var po = el('output'), sP = control(ctl, T.pop, range(40, 200, 20, 100), po);
    var go = el('output'), sG = control(ctl, T.gens, range(20, 300, 10, 120), go);
    var bRun = el('button', {type: 'button', class: 'po-btn'}, T.run); ctl.appendChild(bRun);
    var status = el('p', {class: 'po-note'}); p.appendChild(status);
    var chart = new Chart(chartBox(p), {type: 'scatter', data: {datasets: []}, options: scatterOpts()});
    var cards = el('div', {class: 'po-cards'}); p.appendChild(cards);
    var cR = card(cards, T.ret), cV = card(cards, T.vol), c3 = card(cards, T.cvarL), cG = card(cards, T.gap);
    p.appendChild(el('h4', {}, T.weights)); var wc = new Chart(chartBox(p, 'po-chart-s'), {type: 'bar', data: {labels: [], datasets: []}, options: {indexAxis: 'y', responsive: true, maintainAspectRatio: false, animation: false,
      plugins: {legend: {display: false}}, scales: {x: {min: 0, max: 1, ticks: {color: getComputedStyle(root).color, callback: function (v) { return pct(v, 0); }}}, y: {ticks: {color: getComputedStyle(root).color}}}}});
    p.appendChild(el('p', {class: 'po-note'}, T.pick + ' ' + T.note));
    var front = [], job = null;
    function sliders() { co.textContent = pct(+sCap.value, 0); po.textContent = sP.value; go.textContent = sG.value; }
    [sCap, sP, sG].forEach(function (s) { s.addEventListener('input', sliders); }); sliders();
    function showPortfolio(x) {
      cR.v.textContent = pct(x.o.mean * A); cV.v.textContent = pct(x.o.sd * SA);
      c3.v.textContent = sT.value === 'none' ? '–' : pct(x.o.third); c3.s.textContent = sT.value === 'mdd' ? T.mddL : sT.value === 'cvar' ? T.cvarL : '';
      wc.data.labels = D.assets.map(function (a) { return T.assets[a]; }); wc.data.datasets = [{data: x.w, backgroundColor: C.main, borderRadius: 3}]; wc.update();
    }
    function draw(final) {
      var exact = D.frontier[sR.value], showExact = +sCap.value >= 1;
      var t3 = front.map(function (x) { return x.o.third; }), lo = Math.min.apply(null, t3), hi = Math.max.apply(null, t3);
      var ds = [{label: T.nsga, data: front.map(function (x) { return {x: x.o.sd * SA, y: x.o.mean * A}; }), pointRadius: 4,
        backgroundColor: front.map(function (x) { return sT.value === 'none' || hi - lo < 1e-12 ? C.main : color((x.o.third - lo) / (hi - lo)); })}];
      if (showExact) ds.push({type: 'line', label: T.exact, data: exact.map(function (q) { return {x: q.vol * SA, y: q.ret * A}; }), borderColor: C.grey, borderDash: [6, 4], borderWidth: 2, pointRadius: 0});
      chart.data.datasets = ds; chart.update();
      if (final && showExact && sT.value === 'none') {
        var gaps = front.map(function (x) {
          var m = x.o.mean, best = null;
          for (var i = 1; i < exact.length; i++) if ((exact[i - 1].ret - m) * (exact[i].ret - m) <= 0) { var t = (m - exact[i - 1].ret) / (exact[i].ret - exact[i - 1].ret); best = exact[i - 1].vol + t * (exact[i].vol - exact[i - 1].vol); }
          return best == null ? null : x.o.sd - best;
        }).filter(function (g) { return g != null; });
        cG.v.textContent = gaps.length ? pct(SA * gaps.reduce(function (a, b) { return a + b; }, 0) / gaps.length, 2) : '–'; cG.s.textContent = gaps.length + ' / ' + front.length;
      } else { cG.v.textContent = '–'; cG.s.textContent = ''; }
    }
    function run() {
      if (job) clearTimeout(job);
      var R = D.r.filter(function (_, i) { return sR.value === 'all' || D.turbulent[i] === (sR.value === 'turbulent' ? 1 : 0); });
      var E = nsga2(R, {pop: +sP.value, cap: +sCap.value, third: sT.value, seed: 7}), G = +sG.value;
      function chunk() {
        for (var i = 0; i < 5 && E.gen() < G; i++) E.step();
        front = E.pop().filter(function (x) { return x.rank === 0; }).sort(function (a, b) { return a.o.sd - b.o.sd; });
        status.textContent = T.gen + ' ' + E.gen() + ' / ' + G + ' · ' + front.length + ' ' + (PT ? 'portfólios não dominados' : 'non-dominated portfolios');
        draw(E.gen() >= G);
        if (E.gen() < G) job = setTimeout(chunk, 0); else { job = null; showPortfolio(front[Math.floor(front.length / 2)]); }
      }
      chunk();
    }
    chart.options.onClick = function (ev, els) { if (els.length && els[0].datasetIndex === 0) showPortfolio(front[els[0].index]); };
    bRun.addEventListener('click', run);
    run();
  }

  function regimeTab(p, D) {
    var chart = new Chart(chartBox(p), {type: 'scatter', data: {datasets: [['all', T.all, C.grey], ['calm', T.calm, C.calm], ['turbulent', T.turb, C.turb]].map(function (z) {
      return {type: 'line', label: z[1], data: D.frontier[z[0]].map(function (q) { return {x: q.vol * SA, y: q.ret * A}; }), borderColor: z[2], borderWidth: 2, pointRadius: 2, backgroundColor: z[2]};
    })}, options: scatterOpts()});
    var ctl = el('div', {class: 'po-ctls'}); p.appendChild(ctl);
    var vo = el('output'), sV = control(ctl, T.vol, range(0, 1, 0.05, 0.3), vo);
    var wc = new Chart(chartBox(p, 'po-chart-s'), {type: 'bar', data: {labels: D.assets.map(function (a) { return T.assets[a]; }), datasets: []}, options: {indexAxis: 'y', responsive: true, maintainAspectRatio: false, animation: false,
      plugins: {legend: {labels: {color: getComputedStyle(root).color, boxWidth: 14}}}, scales: {x: {min: 0, max: 1, ticks: {color: getComputedStyle(root).color, callback: function (v) { return pct(v, 0); }}}, y: {ticks: {color: getComputedStyle(root).color}}}}});
    p.appendChild(el('p', {class: 'po-note'}, T.regNote));
    function upd() {
      var q = +sV.value; vo.textContent = fmt(100 * q, 0) + (PT ? '% do caminho entre o menor e o maior risco' : '% of the way from lowest to highest risk');
      wc.data.datasets = [['calm', T.calm, C.calm], ['turbulent', T.turb, C.turb]].map(function (z) { var F = D.frontier[z[0]], x = F[Math.round(q * (F.length - 1))]; return {label: z[1] + ' (' + pct(x.vol * SA) + ')', data: x.w, backgroundColor: z[2], borderRadius: 3}; });
      wc.update();
    }
    sV.addEventListener('input', upd); upd();
  }
})(typeof window !== 'undefined' ? window : globalThis);
