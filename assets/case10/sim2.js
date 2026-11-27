/* Case 10, version 2: model comparison (with SASRec) and real promotion campaigns (The Complete
   Journey). Plain JavaScript + Chart.js, from data_v2.json (python -m b2bretail.export_v2). */
(function () {
  var root = document.getElementById('c10-v2');
  if (!root) return;
  var PT = (document.documentElement.lang || '').toLowerCase().indexOf('pt') === 0;
  var T = PT ? {
    tabs: ['Comparar recomendadores', 'Campanhas reais', 'Tamanho de um teste aleatório'],
    task: 'Tarefa', newT: 'Produtos novos para o cliente', allT: 'Todos os produtos', metric: 'Medida',
    valTitle: 'NDCG@10 na janela de validação, época a época', epoch: 'Época', recNote: 'Teste fora do tempo: 9 de outubro a 9 de dezembro de 2011, intervalos de 95% por reamostragem de clientes. As épocas foram escolhidas na janela de validação, antes do teste.',
    camp: 'Campanha', w: 'Gasto semanal por domicílio, efeito estimado (US$)', naive: 'Comparação direta', aipw: 'Ajustada (AIPW)',
    est: {campaign: 'Nas semanas da campanha', placebo: 'Placebo: semanas antes da campanha', change: 'Na variação do gasto (diferença em diferenças)'},
    curve: 'Valor estimado da política: variação média do gasto por domicílio (US$ por semana)', share: 'Parcela dos domicílios que recebem a campanha',
    rules: {'Model (DR-learner)': 'Modelo (DR-learner)', 'Top spenders': 'Maiores compradores', 'Most lapsed': 'Mais inativos', 'Random': 'Aleatório'},
    blp: 'O modelo capta diferenças reais entre domicílios?', slope: 'inclinação', yes: 'sim, inclinação acima de zero', no: 'não: a inclinação não se distingue de zero, e o ranking do modelo é ruído',
    reached: 'domicílios recebidos', of: 'de', base: 'gasto médio antes', coupon: 'cupom resgatado por domicílio alcançado',
    campNote: 'As campanhas não foram sorteadas. O placebo usa as semanas antes da campanha, que ela não pode ter afetado: se ele sai longe de zero, o ajuste não removeu a seleção.',
    mde: 'Menor efeito detectável neste desenho (5%, poder 80%)',
    planEff: 'Efeito que se quer detectar (US$ por semana por domicílio)', sd: 'Desvio-padrão da variação do gasto (US$ por semana)', share2: 'Parcela no grupo tratado',
    need: 'Domicílios necessários num teste sorteado', alpha: 'nível 5%, poder 80%', planNote: 'Com sorteio, o placebo deixa de ser necessário e a variação do gasto reduz o ruído, como no CUPED. O desvio-padrão inicial vem dos dados da campanha escolhida.',
    loading: 'Carregando...'
  } : {
    tabs: ['Compare recommenders', 'Real campaigns', 'Size of a randomised test'],
    task: 'Task', newT: 'Products new to the customer', allT: 'All products', metric: 'Measure',
    valTitle: 'NDCG@10 on the validation window, epoch by epoch', epoch: 'Epoch', recNote: 'Out-of-time test: 9 October to 9 December 2011, 95% intervals by resampling customers. Epochs were chosen on the validation window, before the test.',
    camp: 'Campaign', w: 'Weekly spend per household, estimated effect (US$)', naive: 'Raw comparison', aipw: 'Adjusted (AIPW)',
    est: {campaign: 'In the campaign weeks', placebo: 'Placebo: weeks before the campaign', change: 'On the change in spend (difference in differences)'},
    curve: 'Estimated policy value: mean change in spend per household (US$ per week)', share: 'Share of households that get the campaign',
    rules: {'Model (DR-learner)': 'Model (DR-learner)', 'Top spenders': 'Top spenders', 'Most lapsed': 'Most lapsed', 'Random': 'Random'},
    blp: 'Does the model capture real differences between households?', slope: 'slope', yes: 'yes, the slope is above zero', no: 'no: the slope cannot be told from zero, and the model’s ranking is noise',
    reached: 'households reached', of: 'of', base: 'mean spend before', coupon: 'coupon redeemed per household reached',
    campNote: 'The campaigns were not randomised. The placebo uses the weeks before the campaign, which it cannot have affected: if it lands far from zero, the adjustment has not removed the selection.',
    mde: 'Minimum detectable effect in this design (5%, 80% power)',
    planEff: 'Effect to detect (US$ per week per household)', sd: 'Standard deviation of the change in spend (US$ per week)', share2: 'Share in the treated group',
    need: 'Households needed in a randomised test', alpha: '5% level, 80% power', planNote: 'With random assignment the placebo is no longer needed, and using the change in spend cuts the noise, as CUPED does. The starting standard deviation comes from the chosen campaign.',
    loading: 'Loading...'
  };
  var NAME = PT ? {'Buy again': 'Recomprar', 'Sequential GRU (PyTorch)': 'GRU sequencial (PyTorch)', 'Implicit ALS': 'ALS implícito',
    'Item-to-item (co-purchase)': 'Item a item (compra conjunta)', 'Popularity (last 90 days)': 'Popularidade (90 dias)',
    'SASRec, product by product': 'SASRec, produto a produto', 'SASRec, basket by basket': 'SASRec, cesta a cesta'} : {};
  var nm = function (s) { return NAME[s] || s; };
  var C = {main: '#0f766e', alt: '#c2410c', grey: '#64748b', blue: '#0369a1', purple: '#7c3aed'};
  var RC = {'Model (DR-learner)': C.main, 'Top spenders': C.blue, 'Most lapsed': C.purple, 'Random': C.grey};
  function fmt(x, d) { return Number(x).toLocaleString(PT ? 'pt-BR' : 'en-US', {minimumFractionDigits: d, maximumFractionDigits: d}); }
  function sg(x, d) { return (x >= 0 ? '+' : '') + fmt(x, d); }
  function el(tag, attrs, html) { var e = document.createElement(tag); for (var k in (attrs || {})) e.setAttribute(k, attrs[k]); if (html != null) e.innerHTML = html; return e; }
  function control(parent, label, input, out) { var w = el('label', {class: 'v2-ctl'}); w.appendChild(el('span', {}, label)); w.appendChild(input); if (out) w.appendChild(out); parent.appendChild(w); return input; }
  function select(opts, val) { var s = el('select'); opts.forEach(function (o) { var op = el('option', {value: o[0]}, o[1]); if (String(o[0]) === String(val)) op.selected = true; s.appendChild(op); }); return s; }
  function range(min, max, step, val) { return el('input', {type: 'range', min: min, max: max, step: step, value: val}); }
  function card(parent, label) { var c = el('div', {class: 'v2-card'}); c.appendChild(el('div', {class: 'v2-card-l'}, label)); var v = el('div', {class: 'v2-card-v'}); c.appendChild(v); var s = el('div', {class: 'v2-card-s'}); c.appendChild(s); parent.appendChild(c); return {v: v, s: s}; }
  function box(p, cls) { var b = el('div', {class: 'v2-chart ' + (cls || '')}); var cv = el('canvas'); b.appendChild(cv); p.appendChild(b); return cv; }
  var tc = function () { return getComputedStyle(root).color; };
  function opts(xTitle, yfmt) {
    var c = tc();
    return {responsive: true, maintainAspectRatio: false, animation: false, plugins: {legend: {labels: {color: c, boxWidth: 14}}},
      scales: {x: {title: {display: !!xTitle, text: xTitle, color: c}, ticks: {color: c}, grid: {display: false}},
        y: {ticks: yfmt ? {color: c, callback: yfmt} : {color: c}, grid: {color: 'rgba(127,127,127,.15)'}}}};
  }

  root.appendChild(el('p', {}, T.loading));
  fetch(root.getAttribute('data-src')).then(function (r) { return r.json(); }).then(build).catch(function (e) { root.innerHTML = '<p>data_v2.json: ' + e + '</p>'; });

  function build(D) {
    root.innerHTML = '';
    var nav = el('div', {class: 'v2-tabs'}); root.appendChild(nav);
    var made = {}, makers = [recs, camps, planner];
    var panes = T.tabs.map(function (t, i) { var b = el('button', {type: 'button'}, t); nav.appendChild(b); var p = el('div', {class: 'v2-pane'}); root.appendChild(p); b.addEventListener('click', function () { show(i); }); return {b: b, p: p}; });
    function show(i) { panes.forEach(function (x, j) { x.p.style.display = i === j ? 'block' : 'none'; x.b.classList.toggle('on', i === j); }); if (!made[i]) { made[i] = 1; makers[i](panes[i].p, D); } }
    show(0);
  }

  function recs(p, D) {
    var ctl = el('div', {class: 'v2-ctls'}); p.appendChild(ctl);
    var sT = control(ctl, T.task, select([['new to the customer', T.newT], ['all products', T.allT]], 'new to the customer'));
    var sM = control(ctl, T.metric, select([['ndcg', 'NDCG@10'], ['recall', 'Recall@10']], 'ndcg'));
    var ch = new Chart(box(p), {type: 'bar', data: {labels: [], datasets: []}, options: Object.assign(opts(null, null), {indexAxis: 'y'})});
    ch.options.plugins.legend.display = false;
    ch.options.scales.x.grid = {color: 'rgba(127,127,127,.15)'}; ch.options.scales.y.grid = {display: false};
    ch.options.scales.x.ticks.callback = function (v) { return fmt(v, 2); };
    ch.options.plugins.tooltip = {callbacks: {label: function (x) { var r = x.chart.$rows[x.dataIndex]; var m = sM.value; return fmt(r[m === 'ndcg' ? 'ndcg@10' : 'recall@10'], 3) + ' (' + fmt(r[m + '_lo'], 3) + '–' + fmt(r[m + '_hi'], 3) + ')'; }}};
    p.appendChild(el('p', {class: 'v2-note'}, T.recNote));
    p.appendChild(el('h4', {}, T.valTitle));
    var vc = new Chart(box(p, 'v2-chart-s'), {type: 'line', data: {datasets: []}, options: opts(T.epoch, function (v) { return fmt(v, 2); })});
    vc.options.scales.x.type = 'linear';
    var cols = {'Sequential GRU (PyTorch)': C.main, 'SASRec, product by product': C.alt, 'SASRec, basket by basket': C.purple};
    vc.data.datasets = Object.keys(D.validation).map(function (k) { return {label: nm(k), data: D.validation[k].map(function (q) { return {x: q[0], y: q[1]}; }), borderColor: cols[k], borderWidth: 2, pointRadius: 2}; });
    Object.keys(D.baselines_validation).forEach(function (k, i) {
      var v = D.baselines_validation[k]; if (v == null) return;
      vc.data.datasets.push({label: nm(k), data: [{x: 1, y: v}, {x: 40, y: v}], borderColor: i ? C.grey : C.blue, borderDash: [5, 3], borderWidth: 1.5, pointRadius: 0});
    });
    vc.update();
    function upd() {
      var m = sM.value, key = m === 'ndcg' ? 'ndcg@10' : 'recall@10';
      var rows = D.recs.filter(function (r) { return r.mode === sT.value; }).sort(function (a, b) { return b[key] - a[key]; });
      ch.$rows = rows;
      ch.data.labels = rows.map(function (r) { return nm(r.model); });
      ch.data.datasets = [{data: rows.map(function (r) { return r[key]; }), backgroundColor: rows.map(function (r) { return r.model.indexOf('SASRec') === 0 ? C.purple : r.model === 'Buy again' ? C.grey : C.main; }), borderRadius: 4, barPercentage: .7},
        {data: rows.map(function (r) { return [r[m + '_lo'], r[m + '_hi']]; }), backgroundColor: 'rgba(127,127,127,.35)', barPercentage: .22, grouped: false}];
      ch.update();
    }
    sT.addEventListener('change', upd); sM.addEventListener('change', upd); upd();
  }

  function camps(p, D) {
    var ctl = el('div', {class: 'v2-ctls'}); p.appendChild(ctl);
    var sC = control(ctl, T.camp, select(D.promos.map(function (c, i) { return [i, '#' + c.campaign_id + ' (' + c.window.start_date + ' – ' + c.window.end_date + ')']; }), 0));
    var meta = el('p', {class: 'v2-meta'}); p.appendChild(meta);
    var ech = new Chart(box(p, 'v2-chart-s'), {type: 'bar', data: {labels: [], datasets: []}, options: Object.assign(opts(null, null), {indexAxis: 'y'})});
    ech.options.scales.x.title = {display: true, text: T.w, color: tc()}; ech.options.scales.x.grid = {color: 'rgba(127,127,127,.15)'}; ech.options.scales.y.grid = {display: false};
    ech.options.scales.x.ticks.callback = function (v) { return fmt(v, 0); };
    var cards = el('div', {class: 'v2-cards'}); p.appendChild(cards);
    var cB = card(cards, T.blp), cM = card(cards, T.mde);
    p.appendChild(el('h4', {}, T.curve));
    var pc = new Chart(box(p), {type: 'line', data: {datasets: []}, options: opts(T.share, function (v) { return fmt(v, 1); })});
    pc.options.scales.x.type = 'linear'; pc.options.scales.x.ticks.callback = function (v) { return fmt(100 * v, 0) + '%'; };
    p.appendChild(el('p', {class: 'v2-note'}, T.campNote));
    function upd() {
      var c = D.promos[+sC.value];
      meta.innerHTML = fmt(c.treated, 0) + ' ' + T.of + ' ' + fmt(c.households, 0) + ' ' + T.reached + ' · ' + T.base + ' US$ ' + fmt(c.baseline_spend_wk, 0) + '/' + (PT ? 'semana' : 'week') + ' · ' + T.coupon + ' US$ ' + fmt(c.coupon_cost_wk_treated, 2) + '/' + (PT ? 'semana' : 'week');
      var keys = ['campaign', 'placebo', 'change'];
      ech.data.labels = keys.map(function (k) { return T.est[k]; });
      ech.data.datasets = [
        {label: T.naive, data: keys.map(function (k) { return c[k].naive; }), backgroundColor: C.grey, borderRadius: 3},
        {label: T.aipw, data: keys.map(function (k) { return c[k].aipw; }), backgroundColor: C.main, borderRadius: 3},
        {label: PT ? 'Intervalo de 95% (ajustada)' : '95% interval (adjusted)', data: keys.map(function (k) { return [c[k].aipw - 1.96 * c[k].se, c[k].aipw + 1.96 * c[k].se]; }), backgroundColor: 'rgba(15,118,110,.25)', barPercentage: .3}];
      ech.update();
      var b = c.blp, sig = b.slope - 1.96 * b.slope_se > 0;
      cB.v.textContent = T.slope + ' ' + fmt(b.slope, 2) + ' ± ' + fmt(1.96 * b.slope_se, 2); cB.s.textContent = sig ? T.yes : T.no;
      cM.v.textContent = 'US$ ' + fmt(c.change.mde, 1); cM.s.textContent = PT ? 'por semana, na variação do gasto' : 'per week, on the change in spend';
      var ds = [];
      Object.keys(T.rules).forEach(function (r) {
        var col = RC[r];
        ds.push({label: T.rules[r], data: c.policy_curve.map(function (q) { return {x: q.share, y: q[r]}; }), borderColor: col, borderWidth: 2, pointRadius: 2});
        if (r === 'Model (DR-learner)') {
          ds.push({label: '', data: c.policy_curve.map(function (q) { return {x: q.share, y: q[r] + 1.96 * q[r + ' se']}; }), borderColor: 'transparent', pointRadius: 0, fill: false});
          ds.push({label: '', data: c.policy_curve.map(function (q) { return {x: q.share, y: q[r] - 1.96 * q[r + ' se']}; }), borderColor: 'transparent', backgroundColor: 'rgba(15,118,110,.15)', pointRadius: 0, fill: '-1'});
        }
      });
      pc.data.datasets = ds; pc.options.plugins.legend.labels.filter = function (i) { return i.text; }; pc.update();
    }
    sC.addEventListener('change', upd); upd();
  }

  function planner(p, D) {
    var ctl = el('div', {class: 'v2-ctls'}); p.appendChild(ctl);
    var c0 = D.promos[0], sd0 = c0.change.se * Math.sqrt(c0.treated * (c0.households - c0.treated) / c0.households);
    var eo = el('output'), sE = control(ctl, T.planEff, range(0.5, 10, 0.5, 2), eo);
    var so = el('output'), sS = control(ctl, T.sd, range(10, 120, 1, Math.round(sd0)), so);
    var po = el('output'), sP = control(ctl, T.share2, range(0.1, 0.9, 0.05, 0.5), po);
    var cards = el('div', {class: 'v2-cards'}); p.appendChild(cards);
    var cN = card(cards, T.need);
    var ch = new Chart(box(p, 'v2-chart-s'), {type: 'line', data: {datasets: []}, options: opts(T.planEff, function (v) { return fmt(v, 0); })});
    ch.options.scales.x.type = 'linear'; ch.options.scales.y.type = 'logarithmic';
    p.appendChild(el('p', {class: 'v2-note'}, T.planNote));
    function n(eff, sd, q) { var z = 1.959964 + 0.841621; return Math.ceil(Math.pow(z * sd / eff, 2) / (q * (1 - q))); }
    function upd() {
      var e = +sE.value, s = +sS.value, q = +sP.value;
      eo.textContent = 'US$ ' + fmt(e, 1); so.textContent = 'US$ ' + fmt(s, 0); po.textContent = fmt(100 * q, 0) + '%';
      cN.v.textContent = fmt(n(e, s, q), 0); cN.s.textContent = T.alpha;
      var pts = []; for (var x = 0.5; x <= 10.001; x += 0.25) pts.push({x: x, y: n(x, s, q)});
      ch.data.datasets = [{label: T.need, data: pts, borderColor: C.main, borderWidth: 2, pointRadius: 0}, {label: '', data: [{x: e, y: n(e, s, q)}], borderColor: C.alt, backgroundColor: C.alt, pointRadius: 6, showLine: false}];
      ch.options.plugins.legend.labels.filter = function (i) { return i.text; };
      ch.update();
    }
    [sE, sS, sP].forEach(function (x) { x.addEventListener('input', upd); }); upd();
  }
})();
