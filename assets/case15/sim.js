/* Interactive part of the clearing-house margin case. Plain JavaScript + Chart.js, from
   data.json (python -m ccp.cli --site). The margin calculator reprices the book in the browser
   on the exported joint scenarios with Black-76, and checks itself against the Python figure. */
(function () {
  var root = document.getElementById('ccp-app');
  if (!root) return;
  var PT = (document.documentElement.lang || '').toLowerCase().indexOf('pt') === 0;
  var T = PT ? {
    tabs: ['Calculadora de margem', 'Backtesting', 'Pró-ciclicidade', 'Estresse e Cover 2', 'Liquidação', 'Opções binárias'],
    btc: 'Futuro de BTC (US$, negativo = vendido)', eth: 'Futuro de ETH (US$)', strad: 'Straddle de BTC no dinheiro, 30 dias (BTC; negativo = vendido)', put: 'Put de BTC 25-delta, 30 dias (BTC)',
    vol: 'Incluir cenários de volatilidade implícita', es: 'Margem: ES 99% em 2 dias', var: 'VaR 99% em 2 dias', pnlTitle: 'Distribuição do resultado em 2 dias nos cenários', check: 'Conferência com o Python no livro de referência',
    port: 'Carteira', model: 'Modelo', margin: 'Margem (ES 99%)', loss: 'Perda realizada em 2 dias', kup: 'Kupiec, p', chr: 'Christoffersen, p', zone: 'Zona nos últimos 250', cov: 'Cobertura da margem',
    zones: {green: 'verde', yellow: 'amarela', red: 'vermelha'}, btNote: 'Margem calculada a cada dois dias só com o passado, e a perda das 48 horas seguintes. Os testes usam o VaR 99%; a margem é o ES 99%, mais alto.',
    tool: 'Ferramenta', p2t: 'Pico sobre vale', inc15: 'Maior alta em 15 dias', mean: 'Margem média', breaches: 'Rompimentos da margem',
    apcNote: 'Carteira comprada em US$ 1 milhão de BTC. Período estressado: a janela de 250 dias de maior volatilidade da amostra.',
    scen: 'Cenário', member: 'Membro', fut: 'Futuros (US$ mi)', mgn: 'Margem (US$ mi)', lossM: 'Perda no cenário (US$ mi)', unc: 'Não coberta (US$ mi)', c2: 'Cover 2 no pior cenário', fund: 'Margem total dos membros',
    stNote: 'Membros sintéticos: o interesse em aberto real de cada instrumento da Deribit foi repartido ao acaso entre dez membros, comprados e vendidos, somando zero.',
    hours: 'Horizonte de liquidação (horas)', impact: 'Impacto no livro', risk: 'Risco de preço no que falta vender', total: 'Custo total', depth: 'Profundidade do livro no lado da venda', exhausted: 'o livro não absorve tudo de uma vez',
    lqNote: 'Supõe que o livro se recompõe entre as fatias, o que é otimista em crise. O risco de preço usa 2,33 desvios da volatilidade atual.',
    dig: 'Preço da binária (paga US$ 1 se o BTC fechar acima do nível)', surf: 'Pela superfície (com o sorriso)', flat: 'Volatilidade única (no dinheiro)', level: 'Nível',
    days: 'Dias até o vencimento', esb: 'Margem por cenário / perda máxima', binNote: 'Binária vendida no dinheiro. Perto do vencimento, a margem por cenário encosta na perda máxima: a regra de cobrar a perda máxima inteira passa a ser a certa.',
    loading: 'Carregando...'
  } : {
    tabs: ['Margin calculator', 'Back-testing', 'Procyclicality', 'Stress and Cover 2', 'Liquidation', 'Binary options'],
    btc: 'BTC future (US$, negative = short)', eth: 'ETH future (US$)', strad: 'BTC at-the-money straddle, 30 days (BTC; negative = short)', put: 'BTC 25-delta put, 30 days (BTC)',
    vol: 'Include implied-volatility scenarios', es: 'Margin: 2-day 99% ES', var: '2-day 99% VaR', pnlTitle: 'Distribution of the 2-day P&L across scenarios', check: 'Check against Python on the reference book',
    port: 'Portfolio', model: 'Model', margin: 'Margin (99% ES)', loss: 'Realised 2-day loss', kup: 'Kupiec, p', chr: 'Christoffersen, p', zone: 'Zone, last 250', cov: 'Margin coverage',
    zones: {green: 'green', yellow: 'yellow', red: 'red'}, btNote: 'Margin set every other day from the past only, against the loss of the next 48 hours. The tests use the 99% VaR; the margin is the higher 99% ES.',
    tool: 'Tool', p2t: 'Peak to trough', inc15: 'Largest 15-day increase', mean: 'Mean margin', breaches: 'Margin breaches',
    apcNote: 'A US$ 1 million long BTC position. Stressed period: the 250-day window with the highest volatility in the sample.',
    scen: 'Scenario', member: 'Member', fut: 'Futures (US$ m)', mgn: 'Margin (US$ m)', lossM: 'Loss in scenario (US$ m)', unc: 'Uncovered (US$ m)', c2: 'Cover 2 in the worst scenario', fund: 'Total member margin',
    stNote: 'Synthetic members: the real open interest of each Deribit instrument was split at random between ten members, long and short, netting to zero.',
    hours: 'Liquidation horizon (hours)', impact: 'Impact on the book', risk: 'Price risk on what is left to sell', total: 'Total cost', depth: 'Book depth on the selling side', exhausted: 'the book cannot absorb it at once',
    lqNote: 'Assumes the book refills between slices, which is optimistic in a crisis. Price risk uses 2.33 standard deviations of current volatility.',
    dig: 'Binary price (pays US$ 1 if BTC ends above the level)', surf: 'From the surface (smile included)', flat: 'One volatility (at the money)', level: 'Level',
    days: 'Days to expiry', esb: 'Scenario margin / maximum loss', binNote: 'Short at-the-money binary. Near expiry the scenario margin reaches the maximum loss: charging the full maximum loss becomes the right rule.',
    loading: 'Loading...'
  };
  var MI = PT ? ' mi' : ' m';
  function sn(x) { return PT ? String(x).replace('hypothetical:', 'hipotético:').replace(/vol \+(\d+) pts/, 'vol. +$1 pontos').replace(/Member /g, 'Membro ') : String(x); }
  var C = {main: '#0f766e', alt: '#c2410c', grey: '#64748b', blue: '#0369a1', red: '#b91c1c', purple: '#7c3aed'};
  function fmt(x, d) { return Number(x).toLocaleString(PT ? 'pt-BR' : 'en-US', {minimumFractionDigits: d || 0, maximumFractionDigits: d || 0}); }
  function usd(x) { return 'US$ ' + fmt(x, 0); }
  function el(tag, attrs, html) { var e = document.createElement(tag); for (var k in (attrs || {})) e.setAttribute(k, attrs[k]); if (html != null) e.innerHTML = html; return e; }
  function control(parent, label, input, out) { var w = el('label', {class: 'ccp-ctl'}); w.appendChild(el('span', {}, label)); w.appendChild(input); if (out) w.appendChild(out); parent.appendChild(w); return input; }
  function select(opts, val) { var s = el('select'); opts.forEach(function (o) { var op = el('option', {value: o[0]}, o[1]); if (String(o[0]) === String(val)) op.selected = true; s.appendChild(op); }); return s; }
  function range(min, max, step, val) { return el('input', {type: 'range', min: min, max: max, step: step, value: val}); }
  function card(parent, label) { var c = el('div', {class: 'ccp-card'}); c.appendChild(el('div', {class: 'ccp-card-l'}, label)); var v = el('div', {class: 'ccp-card-v'}); c.appendChild(v); var s = el('div', {class: 'ccp-card-s'}); c.appendChild(s); parent.appendChild(c); return {v: v, s: s}; }
  function box(p, cls) { var b = el('div', {class: 'ccp-chart ' + (cls || '')}); var cv = el('canvas'); b.appendChild(cv); p.appendChild(b); return cv; }
  var tc = function () { return getComputedStyle(root).color; };
  function opts(yfmt, xTitle) {
    var c = tc();
    return {responsive: true, maintainAspectRatio: false, animation: false, interaction: {mode: 'index', intersect: false},
      plugins: {legend: {labels: {color: c, boxWidth: 14, filter: function (i) { return i.text; }}}},
      scales: {x: {title: {display: !!xTitle, text: xTitle, color: c}, ticks: {color: c, maxTicksLimit: 8, maxRotation: 0}, grid: {display: false}},
        y: {ticks: yfmt ? {color: c, callback: yfmt} : {color: c}, grid: {color: 'rgba(127,127,127,.15)'}}}};
  }
  // ---- Black-76, normal cdf (Cody-style erfc, relative error below 1e-14 for our range) ----
  function ncdf(x) { var z = Math.abs(x) / Math.SQRT2, t = 1 / (1 + 0.5 * z);
    var r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
    return x >= 0 ? 1 - 0.5 * r : 0.5 * r; }
  function b76(F, K, Tm, s, kind) { Tm = Math.max(Tm, 1e-10); s = Math.max(s, 1e-6); var v = s * Math.sqrt(Tm), d1 = (Math.log(F / K) + 0.5 * v * v) / v, d2 = d1 - v;
    return kind === 'C' ? F * ncdf(d1) - K * ncdf(d2) : K * ncdf(-d2) - F * ncdf(-d1); }
  function es99(pnl) { var l = pnl.map(function (x) { return -x; }).sort(function (a, b) { return a - b; }); var q = quantile(l, 0.99), s = 0, n = 0; l.forEach(function (x) { if (x >= q) { s += x; n++; } }); return s / n; }
  function quantile(sorted, q) { var h = (sorted.length - 1) * q, i = Math.floor(h); return sorted[i] + (h - i) * ((sorted[Math.min(i + 1, sorted.length - 1)]) - sorted[i]); }

  root.appendChild(el('p', {}, T.loading));
  fetch(root.getAttribute('data-src')).then(function (r) { return r.json(); }).then(build).catch(function (e) { root.innerHTML = '<p>data.json: ' + e + '</p>'; });

  function build(D) {
    root.innerHTML = '';
    var nav = el('div', {class: 'ccp-tabs'}); root.appendChild(nav);
    var made = {}, makers = [calc, bt, apcTab, stressTab, liq, bin];
    var panes = T.tabs.map(function (t, i) { var b = el('button', {type: 'button'}, t); nav.appendChild(b); var p = el('div', {class: 'ccp-pane'}); root.appendChild(p); b.addEventListener('click', function () { show(i); }); return {b: b, p: p}; });
    function show(i) { panes.forEach(function (x, j) { x.p.style.display = i === j ? 'block' : 'none'; x.b.classList.toggle('on', i === j); }); if (!made[i]) { made[i] = 1; makers[i](panes[i].p, D); } }
    show(0);
  }

  function bookPnl(D, b, withVol) {
    var sc = D.scenarios, cm = D.current_margin, F = cm.F, Tm = cm.T, dt = 2 / 365;
    var leg = cm.options['Short BTC straddle (30 days, 10 BTC)'].legs, put = cm.options['Short BTC 25-delta put (30 days, 10 BTC)'].legs[0];
    var opt = [{k: leg[0].kind, K: leg[0].K, iv: leg[0].iv, q: b.straddle_qty}, {k: leg[1].kind, K: leg[1].K, iv: leg[1].iv, q: b.straddle_qty}, {k: 'P', K: put.K, iv: put.iv, q: b.put_qty}];
    var v0 = opt.map(function (o) { return b76(F, o.K, Tm, o.iv, o.k); });
    return sc.BTC.map(function (r, i) {
      var p = b.btc_usd * Math.expm1(r) + b.eth_usd * Math.expm1(sc.ETH[i]), F1 = F * Math.exp(r), dv = withVol ? sc.dvol_BTC[i] : 0;
      opt.forEach(function (o, j) { if (o.q) p += o.q * (b76(F1, o.K, Math.max(Tm - dt, 1e-6), Math.max(o.iv + dv, 0.05), o.k) - v0[j]); });
      return p;
    });
  }

  function calc(p, D) {
    var ctl = el('div', {class: 'ccp-ctls'}); p.appendChild(ctl);
    var bo = el('output'), sB = control(ctl, T.btc, range(-5e6, 5e6, 1e5, 1e6), bo);
    var eo = el('output'), sE = control(ctl, T.eth, range(-5e6, 5e6, 1e5, -5e5), eo);
    var so = el('output'), sS = control(ctl, T.strad, range(-50, 50, 1, -10), so);
    var po = el('output'), sP = control(ctl, T.put, range(-50, 50, 1, -5), po);
    var vl = el('label', {class: 'ccp-check'}), vc = el('input', {type: 'checkbox'}); vc.checked = true; vl.appendChild(vc); vl.appendChild(document.createTextNode(' ' + T.vol)); ctl.appendChild(vl);
    var cards = el('div', {class: 'ccp-cards'}); p.appendChild(cards);
    var cE = card(cards, T.es), cV = card(cards, T.var), cK = card(cards, T.check);
    var ch = new Chart(box(p), {type: 'bar', data: {labels: [], datasets: []}, options: opts(null, T.pnlTitle)});
    ch.options.plugins.legend.display = false;
    var ref = D.app_reference, js = es99(bookPnl(D, ref.book, true));
    cK.v.textContent = usd(js) + ' / ' + usd(ref.es99); cK.s.textContent = (PT ? 'diferença ' : 'difference ') + fmt(100 * Math.abs(js / ref.es99 - 1), 3) + '%';
    function upd() {
      var b = {btc_usd: +sB.value, eth_usd: +sE.value, straddle_qty: +sS.value, put_qty: +sP.value};
      bo.textContent = usd(b.btc_usd); eo.textContent = usd(b.eth_usd); so.textContent = fmt(b.straddle_qty, 0) + ' BTC'; po.textContent = fmt(b.put_qty, 0) + ' BTC';
      var pnl = bookPnl(D, b, vc.checked), l = pnl.map(function (x) { return -x; }).sort(function (a, c) { return a - c; });
      cE.v.textContent = usd(es99(pnl)); cV.v.textContent = usd(quantile(l, 0.99));
      var lo = Math.min.apply(null, pnl), hi = Math.max.apply(null, pnl), nb = 40, w = (hi - lo) / nb || 1, bins = new Array(nb).fill(0), lab = [];
      pnl.forEach(function (x) { bins[Math.min(nb - 1, Math.floor((x - lo) / w))]++; });
      for (var i = 0; i < nb; i++) lab.push(fmt((lo + (i + 0.5) * w) / 1e3, 0) + 'k');
      var cut = -es99(pnl);
      ch.data.labels = lab; ch.data.datasets = [{data: bins, backgroundColor: bins.map(function (_, i) { return lo + (i + 0.5) * w < cut ? C.red : C.main; }), barPercentage: 1, categoryPercentage: 1}];
      ch.update();
    }
    [sB, sE, sS, sP].forEach(function (x) { x.addEventListener('input', upd); }); vc.addEventListener('change', upd); upd();
  }

  function bt(p, D) {
    var ctl = el('div', {class: 'ccp-ctls'}); p.appendChild(ctl);
    var ports = ['Long BTC', 'Long ETH', 'Long BTC, short ETH'], models = ['FHS (GARCH)', 'Historical simulation'];
    var PN = PT ? {'Long BTC': 'Comprado em BTC', 'Long ETH': 'Comprado em ETH', 'Long BTC, short ETH': 'Comprado em BTC, vendido em ETH', 'FHS (GARCH)': 'FHS (GARCH)', 'Historical simulation': 'Simulação histórica'} : {};
    var nm = function (s) { return PN[s] || s; };
    var sP = control(ctl, T.port, select(ports.map(function (x) { return [x, nm(x)]; }), ports[0]));
    var sM = control(ctl, T.model, select(models.map(function (x) { return [x, nm(x)]; }), models[0]));
    var cards = el('div', {class: 'ccp-cards'}); p.appendChild(cards);
    var cK = card(cards, T.kup), cC = card(cards, T.chr), cZ = card(cards, T.zone), cV = card(cards, T.cov);
    var ch = new Chart(box(p), {type: 'line', data: {labels: [], datasets: []}, options: opts(function (v) { return fmt(v / 1e3, 0) + 'k'; })});
    p.appendChild(el('p', {class: 'ccp-note'}, T.btNote));
    function upd() {
      var k = sP.value + ' | ' + sM.value, s = D.backtest[k], ser = D.backtest_series[k];
      cK.v.textContent = fmt(s.kupiec.p, 3); cK.s.textContent = s.kupiec.breaches + ' / ' + s.kupiec.n + ' VaR';
      cC.v.textContent = fmt(s.christoffersen.p, 3); cC.s.textContent = '';
      cZ.v.textContent = T.zones[s.zone]; cZ.s.textContent = s.breaches_last_250 + ' VaR';
      cV.v.textContent = fmt(100 * s.margin_coverage, 2) + '%'; cV.s.textContent = s.margin_breaches + ' / ' + s.windows;
      ch.data.labels = ser.dates;
      ch.data.datasets = [{label: T.margin, data: ser.margin, borderColor: C.main, borderWidth: 1.5, pointRadius: 0},
        {label: T.loss, data: ser.loss.map(function (x) { return Math.max(x, 0); }), borderColor: 'rgba(100,116,139,.6)', borderWidth: 1, pointRadius: 0},
        {label: PT ? 'Rompimento' : 'Breach', data: ser.loss.map(function (x, i) { return x > ser.margin[i] ? x : null; }), borderColor: C.red, backgroundColor: C.red, pointRadius: 4, showLine: false}];
      ch.update();
    }
    sP.addEventListener('change', upd); sM.addEventListener('change', upd); upd();
  }

  function apcTab(p, D) {
    var A = D.apc, keys = Object.keys(A.tools);
    var TN = PT ? {'Model only': 'Só o modelo', 'Buffer 25%': 'Colchão de 25%', 'Floor at half the stressed margin': 'Piso: metade da margem estressada', '25% weight on stressed': 'Peso de 25% no período estressado'} : {};
    var nm = function (s) { return TN[s] || s; };
    var tb = el('table', {class: 'ccp-table'}); p.appendChild(tb);
    tb.innerHTML = '<thead><tr><th>' + T.tool + '</th><th>' + T.p2t + '</th><th>' + T.inc15 + '</th><th>' + T.mean + '</th><th>' + T.breaches + '</th></tr></thead><tbody>' +
      keys.map(function (k) { var t = A.tools[k]; return '<tr><td>' + nm(k) + '</td><td>' + fmt(t.peak_to_trough, 1) + 'x</td><td>+' + fmt(100 * t.max_15d_increase, 0) + '%</td><td>' + usd(t.mean) + '</td><td>' + t.breaches + '</td></tr>'; }).join('') + '</tbody>';
    var cols = [C.grey, C.main, C.blue, C.purple];
    var ch = new Chart(box(p), {type: 'line', data: {labels: A.dates, datasets: keys.map(function (k, i) { return {label: nm(k), data: A.series[k], borderColor: cols[i], borderWidth: 1.5, pointRadius: 0}; })}, options: opts(function (v) { return fmt(v / 1e3, 0) + 'k'; })});
    p.appendChild(el('p', {class: 'ccp-note'}, T.apcNote + ' ' + A.stressed_window.join(' – ') + '.'));
  }

  function stressTab(p, D) {
    var S = D.stress, names = S.scenarios.map(function (s) { return s.date; });
    var ctl = el('div', {class: 'ccp-ctls'}); p.appendChild(ctl);
    var sS = control(ctl, T.scen, select(names.map(function (n) { var s = S.scenarios[names.indexOf(n)]; return [n, sn(n) + ' (BTC ' + (s.BTC >= 0 ? '+' : '') + fmt(100 * Math.expm1(s.BTC), 0) + '%)']; }), S.worst_scenario));
    var cards = el('div', {class: 'ccp-cards'}); p.appendChild(cards);
    var c2 = card(cards, T.c2), cf = card(cards, T.fund);
    c2.v.textContent = 'US$ ' + fmt(S.cover2 / 1e6, 0) + MI; c2.s.textContent = sn(S.worst_scenario) + ': ' + sn(S.members_in_cover2.join(', '));
    cf.v.textContent = 'US$ ' + fmt(S.total_margin / 1e6, 0) + MI; cf.s.textContent = '';
    var ch = new Chart(box(p, 'ccp-chart-s'), {type: 'bar', data: {labels: S.members.map(function (m) { return m.name.replace('Member', PT ? 'Membro' : 'Member'); }), datasets: []}, options: opts(function (v) { return fmt(v / 1e6, 0); })});
    var tb = el('table', {class: 'ccp-table'}); p.appendChild(tb);
    p.appendChild(el('p', {class: 'ccp-note'}, T.stNote));
    function upd() {
      var sc = sS.value;
      ch.data.datasets = [{label: T.mgn, data: S.members.map(function (m) { return m.margin; }), backgroundColor: C.main},
        {label: T.lossM, data: S.members.map(function (m) { return S.loss[sc][m.name]; }), backgroundColor: C.grey},
        {label: T.unc, data: S.members.map(function (m) { return S.uncovered[sc][m.name]; }), backgroundColor: C.red}];
      ch.update();
      tb.innerHTML = '<thead><tr><th>' + T.member + '</th><th>' + T.fut + ' BTC</th><th>' + T.fut + ' ETH</th><th>' + T.mgn + '</th><th>' + T.lossM + '</th><th>' + T.unc + '</th></tr></thead><tbody>' +
        S.members.map(function (m) { return '<tr><td>' + m.name.replace('Member', PT ? 'Membro' : 'Member') + '</td><td>' + fmt(m.futures.BTC / 1e6, 0) + '</td><td>' + fmt(m.futures.ETH / 1e6, 0) + '</td><td>' + fmt(m.margin / 1e6, 1) + '</td><td>' + fmt(S.loss[sc][m.name] / 1e6, 1) + '</td><td>' + fmt(S.uncovered[sc][m.name] / 1e6, 1) + '</td></tr>'; }).join('') + '</tbody>';
    }
    sS.addEventListener('change', upd); upd();
  }

  function liq(p, D) {
    var L = D.liquidation;
    var cards = el('div', {class: 'ccp-cards'}); p.appendChild(cards);
    var cP = card(cards, L.member.replace('Member', PT ? 'Membro' : 'Member')), cD = card(cards, T.depth), cB = card(cards, T.total);
    cP.v.textContent = 'US$ ' + fmt(L.btc_futures_usd / 1e6, 0) + MI; cP.s.textContent = 'BTC';
    cD.v.textContent = 'US$ ' + fmt(L.book_depth_usd / 1e6, 0) + MI; cD.s.textContent = 'spread ' + fmt(L.spread_bps, 2) + ' bp';
    var ch = new Chart(box(p, 'ccp-chart-s'), {type: 'bar', data: {labels: L.schedules.map(function (s) { return fmt(s.hours, 0) + 'h'; }), datasets: [
      {label: T.impact, data: L.schedules.map(function (s) { return s.impact_usd; }), backgroundColor: C.main},
      {label: T.risk, data: L.schedules.map(function (s) { return s.risk_usd; }), backgroundColor: C.alt}]}, options: opts(function (v) { return fmt(v / 1e6, 1) + 'm'; }, T.hours)});
    ch.options.scales.x.stacked = true; ch.options.scales.y.stacked = true; ch.update();
    var best = L.schedules.reduce(function (a, b) { return b.total_usd < a.total_usd ? b : a; });
    cB.v.textContent = 'US$ ' + fmt(best.total_usd / 1e6, 1) + MI; cB.s.textContent = fmt(best.hours, 0) + 'h; ' + (L.schedules[0].book_exhausted ? T.exhausted : '');
    p.appendChild(el('p', {class: 'ccp-note'}, T.lqNote));
  }

  function bin(p, D) {
    var B = D.binary;
    var ch = new Chart(box(p, 'ccp-chart-s'), {type: 'line', data: {labels: B.digitals.map(function (d) { return fmt(d.K, 0); }), datasets: [
      {label: T.surf, data: B.digitals.map(function (d) { return d.surface; }), borderColor: C.main, borderWidth: 2, pointRadius: 2},
      {label: T.flat, data: B.digitals.map(function (d) { return d.flat_atm; }), borderColor: C.grey, borderDash: [5, 3], borderWidth: 2, pointRadius: 2}]}, options: opts(function (v) { return fmt(v, 2); }, T.level)});
    p.appendChild(el('h4', {}, T.dig));
    var c2 = new Chart(box(p, 'ccp-chart-s'), {type: 'bar', data: {labels: B.margin_by_days.map(function (d) { return d.days; }), datasets: [
      {label: T.esb, data: B.margin_by_days.map(function (d) { return d.es_over_bound; }), backgroundColor: C.main}]}, options: opts(function (v) { return fmt(100 * v, 0) + '%'; }, T.days)});
    c2.options.scales.y.max = 1; c2.update();
    p.appendChild(el('p', {class: 'ccp-note'}, T.binNote));
  }
})();
