/* Interactive part of the corporate credit early-warning case. Plain JavaScript + Chart.js, from
   data.json (written by python -m distress.cli site). Aggregate test results and four memos on
   companies that already went through a recovery; no other company is scored here. */
(function () {
  var root = document.getElementById('cew-app');
  if (!root) return;
  var PT = (document.documentElement.lang || '').toLowerCase().indexOf('pt') === 0;
  var T = PT ? {
    tabs: ['Comparar modelos', 'Calibração', 'O que move o risco', 'Quatro casos passados'],
    metric: 'Medida', vsLabel: 'Diferença de AUC contra', pDiff: 'p (Holm)', pClust: 'p reamostrando empresas (Holm)', diff: 'Diferença', ci: 'intervalo de 95%',
    testNote: 'Teste fora do tempo, de 2020 em diante: 13.121 trimestres de empresas e 133 eventos. Maior é melhor, exceto no Brier.',
    delongNote: 'O teste de DeLong compara as AUCs no mesmo conjunto; o p reamostrando empresas trata cada empresa como um bloco, o que é mais exigente.',
    horizon: 'Horizonte', months: 'meses', observed: 'Taxa observada', meanPd: 'PD média prevista', hideDH: 'Deixar o DeepHit fora do gráfico',
    calNote: 'Um modelo calibrado prevê, em média, a taxa que de fato ocorreu. Acima da linha, o modelo superestima o risco; abaixo, subestima.',
    view: 'Mostrar', hr: 'Cox: razão de risco por desvio-padrão', shap: 'XGBoost: peso médio na previsão (SHAP)',
    hrNote: 'Acima de 1, o fator aumenta o risco; abaixo de 1, reduz. As barras mostram o intervalo de 95%; as que cruzam 1 não são significativas.',
    shapNote: 'Média do valor absoluto de SHAP no teste: quanto cada fator move a previsão, em qualquer direção.',
    company: 'Empresa', analysis: 'Data da análise', event: 'Evento', RJ: 'Recuperação judicial', RE: 'Recuperação extrajudicial',
    xObs: 'vezes a taxa observada', ind: 'Indicadores na data da análise', memo: 'Parecer gerado pelos agentes',
    passed: 'Conferência: todos os números e datas do parecer batem com o que as ferramentas retornaram.', blocked: 'Conferência: o parecer foi bloqueado.',
    caseNote: 'Cada parecer usa só o que era público doze meses antes do pedido. A PD vem do logit de risco.',
    loading: 'Carregando...'
  } : {
    tabs: ['Compare models', 'Calibration', 'What drives risk', 'Four past cases'],
    metric: 'Measure', vsLabel: 'AUC difference against', pDiff: 'p (Holm)', pClust: 'p resampling companies (Holm)', diff: 'Difference', ci: '95% interval',
    testNote: 'Out-of-time test, from 2020 on: 13,121 company-quarters and 133 events. Higher is better, except for the Brier score.',
    delongNote: 'The DeLong test compares the AUCs on the same set; the p-value resampling companies treats each company as a block, which is stricter.',
    horizon: 'Horizon', months: 'months', observed: 'Observed rate', meanPd: 'Mean predicted PD', hideDH: 'Leave DeepHit out of the chart',
    calNote: 'A calibrated model predicts, on average, the rate that actually occurred. Above the line the model overstates the risk; below, it understates it.',
    view: 'Show', hr: 'Cox: hazard ratio per standard deviation', shap: 'XGBoost: mean weight in the prediction (SHAP)',
    hrNote: 'Above 1 the factor raises the risk; below 1 it lowers it. Bars show the 95% interval; those that cross 1 are not significant.',
    shapNote: 'Mean absolute SHAP value on the test: how much each factor moves the prediction, in either direction.',
    company: 'Company', analysis: 'Analysis date', event: 'Event', RJ: 'Judicial recovery', RE: 'Out-of-court recovery',
    xObs: 'times the observed rate', ind: 'Indicators at the analysis date', memo: 'Memo written by the agents (as generated, in Portuguese)',
    passed: 'Check: every number and date in the memo matches what the tools returned.', blocked: 'Check: the memo was blocked.',
    caseNote: 'Each memo uses only what was public twelve months before the filing. The PD comes from the hazard logit.',
    loading: 'Loading...'
  };
  var MODEL = {altman: "Altman Z''", logit_hazard: PT ? 'Logit de risco' : 'Hazard logit', cox: 'Cox', xgb_pd12: PT ? 'XGBoost classificador' : 'XGBoost classifier',
    xgb_cox: PT ? 'XGBoost sobrevivência' : 'XGBoost survival', rsf: PT ? 'Floresta de sobrevivência' : 'Random survival forest', deepsurv: 'DeepSurv', deephit: 'DeepHit'};
  var TREE = {xgb_pd12: 1, xgb_cox: 1, rsf: 1};
  var FEAT = PT ? {int_cov: 'Cobertura de juros', wc_ta: 'Capital de giro / ativo', loss_q4: 'Trimestres com prejuízo em 12 meses, dos últimos 4', cash_ta: 'Caixa / ativo',
    lev: 'Alavancagem (passivo / ativo)', log_size_real: 'Tamanho (ativo real, em log)', sales_g: 'Crescimento das vendas', re_ta: 'Lucros retidos / ativo', margin: 'Margem líquida',
    curr: 'Liquidez corrente', eq_tl: 'Patrimônio / passivo', filing_delay_days: 'Atraso na entrega das demonstrações', pj_default: 'Inadimplência PJ', info_age_days: 'Idade da última demonstração',
    ebit_ta: 'EBIT / ativo', ibc_yoy: 'Atividade (IBC-Br), variação anual', n_restatements_4q: 'Reapresentações, últimos 4 trimestres', selic: 'Selic', unemp: 'Desemprego',
    spread: 'Spread médio', ipca12: 'IPCA 12 meses', gc_flag: 'Parágrafo de continuidade do auditor', neg_eq: 'Patrimônio negativo', prior_event: 'Recuperação anterior'}
    : {int_cov: 'Interest coverage', wc_ta: 'Working capital / assets', loss_q4: 'Quarters with a 12-month loss, of the last 4', cash_ta: 'Cash / assets',
    lev: 'Leverage (liabilities / assets)', log_size_real: 'Size (real assets, log)', sales_g: 'Sales growth', re_ta: 'Retained earnings / assets', margin: 'Net margin',
    curr: 'Current ratio', eq_tl: 'Equity / liabilities', filing_delay_days: 'Late filing of statements', pj_default: 'Corporate default rate', info_age_days: 'Age of the latest statement',
    ebit_ta: 'EBIT / assets', ibc_yoy: 'Activity (IBC-Br), annual change', n_restatements_4q: 'Restatements, last 4 quarters', selic: 'Selic rate', unemp: 'Unemployment',
    spread: 'Average lending spread', ipca12: 'Inflation, 12 months', gc_flag: 'Auditor’s going-concern paragraph', neg_eq: 'Negative equity', prior_event: 'Previous recovery'};
  var IND_EN = {'data_base': 'Statement date', 'alavancagem (passivo/ativo)': 'Leverage (liabilities/assets)', 'liquidez corrente': 'Current ratio', 'cobertura de juros': 'Interest coverage',
    'caixa/ativo': 'Cash/assets', 'margem líquida': 'Net margin', "escore Z'' de Altman": "Altman Z'' score",
    'trimestres, entre os 4 últimos, com resultado de 12 meses negativo': 'Quarters with a 12-month loss, of the last 4',
    'incerteza sobre continuidade operacional no relatório do auditor': 'Going-concern paragraph in the audit report'};
  var METRICS = [['auc', 'AUC, PD 12 ' + (PT ? 'meses' : 'months')], ['auc_t24', 'AUC, 24 ' + (PT ? 'meses' : 'months')], ['auc_t36', 'AUC, 36 ' + (PT ? 'meses' : 'months')],
    ['c_uno', PT ? 'Índice C (Uno)' : 'C-index (Uno)'], ['pr_auc', 'PR-AUC'], ['ks', 'KS'], ['brier', 'Brier']];
  var C = {main: '#0f766e', tree: '#b91c1c', base: '#64748b', obs: '#334155', up: '#b91c1c', down: '#0369a1', ns: '#94a3b8'};

  function fmt(x, d) { return Number(x).toLocaleString(PT ? 'pt-BR' : 'en-US', {minimumFractionDigits: d || 0, maximumFractionDigits: d || 0}); }
  function pct(x, d) { return fmt(100 * x, d == null ? 1 : d) + '%'; }
  function pv(p) { return p < 0.001 ? '< 0' + (PT ? ',' : '.') + '001' : fmt(p, 3); }
  function el(tag, attrs, html) { var e = document.createElement(tag); for (var k in (attrs || {})) e.setAttribute(k, attrs[k]); if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s).replace(/[&<>]/g, function (c) { return {'&': '&amp;', '<': '&lt;', '>': '&gt;'}[c]; }); }
  function control(parent, label, input) { var w = el('label', {class: 'cew-ctl'}); w.appendChild(el('span', {}, label)); w.appendChild(input); parent.appendChild(w); return input; }
  function select(opts, val) { var s = el('select'); opts.forEach(function (o) { var op = el('option', {value: o[0]}, o[1]); if (String(o[0]) === String(val)) op.selected = true; s.appendChild(op); }); return s; }
  function card(parent, label) { var c = el('div', {class: 'cew-card'}); c.appendChild(el('div', {class: 'cew-card-l'}, label)); var v = el('div', {class: 'cew-card-v'}); c.appendChild(v); var s = el('div', {class: 'cew-card-s'}); c.appendChild(s); parent.appendChild(c); return {v: v, s: s}; }
  function date(s) { var p = s.split('-'); return PT ? p[2] + '/' + p[1] + '/' + p[0] : new Date(s + 'T12:00:00').toLocaleDateString('en-GB', {day: 'numeric', month: 'short', year: 'numeric'}); }
  function tc() { return getComputedStyle(root).color; }
  function hbar(cv, fmtV) {
    var c = tc();
    return new Chart(cv, {type: 'bar', data: {labels: [], datasets: []}, options: {indexAxis: 'y', responsive: true, maintainAspectRatio: false, animation: false,
      plugins: {legend: {display: false}, tooltip: {callbacks: {label: function (x) { return fmtV(x.raw); }}}},
      scales: {x: {ticks: {color: c, callback: function (v) { return fmtV(v); }}, grid: {color: 'rgba(127,127,127,.15)'}}, y: {ticks: {color: c}, grid: {display: false}}}}});
  }

  root.appendChild(el('p', {}, T.loading));
  fetch(root.getAttribute('data-src')).then(function (r) { return r.json(); }).then(build).catch(function (e) { root.innerHTML = '<p>data.json: ' + e + '</p>'; });

  function build(D) {
    root.innerHTML = '';
    var nav = el('div', {class: 'cew-tabs'}); root.appendChild(nav);
    var made = {}, makers = [compare, calibration, drivers, cases];
    var panes = T.tabs.map(function (t, i) { var b = el('button', {type: 'button'}, t); nav.appendChild(b); var p = el('div', {class: 'cew-pane'}); root.appendChild(p); b.addEventListener('click', function () { show(i); }); return {b: b, p: p}; });
    function show(i) { panes.forEach(function (x, j) { x.p.style.display = i === j ? 'block' : 'none'; x.b.classList.toggle('on', i === j); }); if (!made[i]) { made[i] = 1; makers[i](panes[i].p, D); } }
    show(0);
  }

  function compare(p, D) {
    var ctl = el('div', {class: 'cew-ctls'}); p.appendChild(ctl);
    var sM = control(ctl, T.metric, select(METRICS, 'auc'));
    var box = el('div', {class: 'cew-chart'}); var cv = el('canvas'); box.appendChild(cv); p.appendChild(box);
    p.appendChild(el('p', {class: 'cew-note'}, T.testNote));
    var chart = hbar(cv, function (v) { return Array.isArray(v) ? fmt(v[0], 3) + '–' + fmt(v[1], 3) : fmt(v, 3); });
    function upd() {
      var m = sM.value, rows = D.models.slice().sort(function (a, b) { return m === 'brier' ? a[m] - b[m] : b[m] - a[m]; });
      chart.data.labels = rows.map(function (r) { return MODEL[r.model]; });
      var col = rows.map(function (r) { return r.model === 'altman' ? C.base : TREE[r.model] ? C.tree : C.main; });
      chart.data.datasets = [{data: rows.map(function (r) { return r[m]; }), backgroundColor: col, borderRadius: 4, barPercentage: .7}];
      if (m === 'auc') chart.data.datasets.push({data: rows.map(function (r) { return [r.auc_lo, r.auc_hi]; }), backgroundColor: 'rgba(127,127,127,.25)', borderRadius: 2, barPercentage: .25, grouped: false});
      var vals = rows.map(function (r) { return m === 'auc' ? r.auc_lo : r[m]; }).filter(function (v) { return v != null; });
      chart.options.scales.x.min = m.indexOf('auc') === 0 || m === 'c_uno' ? Math.max(0.5, Math.floor(Math.min.apply(null, vals) * 20) / 20) : 0;
      chart.update();
    }
    sM.addEventListener('change', upd); upd();
    var ctl2 = el('div', {class: 'cew-ctls'}); p.appendChild(ctl2);
    var sV = control(ctl2, T.vsLabel, select([['altman', MODEL.altman], ['logit_hazard', MODEL.logit_hazard]], 'altman'));
    var tb = el('table', {class: 'cew-table'}); p.appendChild(tb);
    p.appendChild(el('p', {class: 'cew-note'}, T.delongNote));
    function upd2() {
      var v = sV.value, rows = D.delong.filter(function (r) { return r.versus === v; }).sort(function (a, b) { return b.auc_diff - a.auc_diff; });
      tb.innerHTML = '<thead><tr><th></th><th>' + T.diff + '</th><th>' + T.ci + '</th><th>' + T.pDiff + '</th><th>' + T.pClust + '</th></tr></thead>';
      var body = el('tbody'); tb.appendChild(body);
      rows.forEach(function (r) {
        body.appendChild(el('tr', {}, '<td>' + MODEL[r.model] + '</td><td>' + (r.auc_diff >= 0 ? '+' : '') + fmt(r.auc_diff, 3) + '</td><td>' + fmt(r.diff_lo, 3) + (PT ? ' a ' : ' to ') + fmt(r.diff_hi, 3) +
          '</td><td' + (r.p_holm < 0.05 ? ' class="sig"' : '') + '>' + pv(r.p_holm) + '</td><td' + (r.p_cluster_holm < 0.05 ? ' class="sig"' : '') + '>' + pv(r.p_cluster_holm) + '</td>'));
      });
    }
    sV.addEventListener('change', upd2); upd2();
  }

  function calibration(p, D) {
    var ctl = el('div', {class: 'cew-ctls'}); p.appendChild(ctl);
    var sH = control(ctl, T.horizon, select([[12, '12 ' + T.months], [24, '24 ' + T.months], [36, '36 ' + T.months]], 36));
    var chk = el('input', {type: 'checkbox'}); var lab = el('label', {class: 'cew-check'}); lab.appendChild(chk); lab.appendChild(document.createTextNode(' ' + T.hideDH)); ctl.appendChild(lab);
    var box = el('div', {class: 'cew-chart'}); var cv = el('canvas'); box.appendChild(cv); p.appendChild(box);
    p.appendChild(el('p', {class: 'cew-note'}, T.calNote));
    var c = tc();
    var chart = new Chart(cv, {type: 'bar', data: {labels: [], datasets: []}, options: {responsive: true, maintainAspectRatio: false, animation: false,
      plugins: {legend: {labels: {color: c, boxWidth: 14}}, tooltip: {callbacks: {label: function (x) { return x.dataset.label + ': ' + pct(x.raw, 2); }}}},
      scales: {x: {ticks: {color: c, maxRotation: 45, minRotation: 0}, grid: {display: false}}, y: {beginAtZero: true, ticks: {color: c, callback: function (v) { return pct(v, 0); }}, grid: {color: 'rgba(127,127,127,.15)'}}}}});
    function upd() {
      var h = +sH.value, rows = D.calibration.filter(function (r) { return r.horizon === h && !(chk.checked && r.model === 'deephit'); });
      chart.data.labels = rows.map(function (r) { return MODEL[r.model]; });
      chart.data.datasets = [
        {type: 'line', label: T.observed, data: rows.map(function () { return D.observed[h]; }), borderColor: C.obs, borderDash: [6, 4], borderWidth: 2, pointRadius: 0},
        {label: T.meanPd, data: rows.map(function (r) { return r.mean_pd; }), backgroundColor: rows.map(function (r) { return r.mean_pd > D.observed[h] ? C.up : C.down; }), borderRadius: 4, barPercentage: .7}];
      chart.update();
    }
    sH.addEventListener('change', upd); chk.addEventListener('change', upd); upd();
  }

  function drivers(p, D) {
    var ctl = el('div', {class: 'cew-ctls'}); p.appendChild(ctl);
    var sV = control(ctl, T.view, select([['hr', T.hr], ['shap', T.shap]], 'hr'));
    var box = el('div', {class: 'cew-chart cew-chart-t'}); var cv = el('canvas'); box.appendChild(cv); p.appendChild(box);
    var note = el('p', {class: 'cew-note'}); p.appendChild(note);
    var chart = null;
    function upd() {
      if (chart) chart.destroy();
      var c = tc(), hr = sV.value === 'hr';
      var rows = D.drivers.slice().sort(function (a, b) { return hr ? b.cox_hr - a.cox_hr : b.shap_mean_abs - a.shap_mean_abs; });
      var labels = rows.map(function (r) { return FEAT[r.feature] || r.feature; });
      var ds = hr ? [
        {data: rows.map(function (r) { return [r.cox_hr_lo, r.cox_hr_hi]; }), backgroundColor: rows.map(function (r) { return r.cox_hr_lo > 1 ? C.up : r.cox_hr_hi < 1 ? C.down : C.ns; }), borderRadius: 3, barPercentage: .5},
        {type: 'scatter', data: rows.map(function (r, i) { return {x: r.cox_hr, y: labels[i]}; }), backgroundColor: c, pointRadius: 3}
      ] : [{data: rows.map(function (r) { return r.shap_mean_abs; }), backgroundColor: C.main, borderRadius: 4, barPercentage: .7}];
      chart = new Chart(cv, {type: 'bar', data: {labels: labels, datasets: ds}, options: {indexAxis: 'y', responsive: true, maintainAspectRatio: false, animation: false,
        plugins: {legend: {display: false}, tooltip: {callbacks: {label: function (x) {
          var r = rows[x.dataIndex]; return hr ? 'HR ' + fmt(r.cox_hr, 2) + ' (' + fmt(r.cox_hr_lo, 2) + '–' + fmt(r.cox_hr_hi, 2) + ')' : fmt(r.shap_mean_abs, 3); }}}},
        scales: {x: {min: hr ? 0.85 : 0, max: hr ? 1.3 : undefined, ticks: {color: c, callback: function (v) { return fmt(v, 2); }}, grid: {color: function (x) { return hr && Math.abs(x.tick.value - 1) < 1e-9 ? c : 'rgba(127,127,127,.15)'; }}},
          y: {ticks: {color: c, autoSkip: false, font: {size: 11}}, grid: {display: false}}}}});
      note.textContent = hr ? T.hrNote : T.shapNote;
    }
    sV.addEventListener('change', upd); upd();
  }

  function cases(p, D) {
    var ctl = el('div', {class: 'cew-ctls'}); p.appendChild(ctl);
    var sC = control(ctl, T.company, select(D.cases.map(function (c, i) { return [i, c.company]; }), 0));
    var meta = el('p', {class: 'cew-meta'}); p.appendChild(meta);
    var cards = el('div', {class: 'cew-cards'}); p.appendChild(cards);
    var cs = [12, 24, 36].map(function (h) { return card(cards, 'PD ' + h + ' ' + T.months); });
    var grid = el('div', {class: 'cew-split'}); p.appendChild(grid);
    var left = el('div'), right = el('div'); grid.appendChild(left); grid.appendChild(right);
    left.appendChild(el('h4', {}, T.ind)); var ind = el('table', {class: 'cew-table'}); left.appendChild(ind);
    right.appendChild(el('h4', {}, T.memo)); var memo = el('div', {class: 'cew-memo'}); right.appendChild(memo);
    var guard = el('p', {class: 'cew-guard'}); right.appendChild(guard);
    p.appendChild(el('p', {class: 'cew-note'}, T.caseNote));
    function num(v, k) {
      if (k.indexOf('continuidade') >= 0) return v ? (PT ? 'sim' : 'yes') : (PT ? 'não' : 'no');
      if (k.indexOf('trimestres') === 0) return fmt(v, 0);
      if (k === 'data_base' && !PT) { var q = String(v).split('/'); return date(q[2] + '-' + q[1] + '-' + q[0]); }
      return typeof v === 'number' ? fmt(v, 2) : esc(v);
    }
    function upd() {
      var c = D.cases[+sC.value];
      meta.innerHTML = '<strong>' + T.analysis + ':</strong> ' + date(c.analysis_date) + ' &nbsp; <strong>' + T.event + ':</strong> ' + T[c.event] + ', ' + date(c.event_date);
      [12, 24, 36].forEach(function (h, i) { var v = c['pd' + h]; cs[i].v.textContent = pct(v); cs[i].s.textContent = fmt(v / D.observed[h], 1) + ' ' + T.xObs + ' (' + pct(D.observed[h]) + ')'; });
      ind.innerHTML = '';
      Object.keys(c.indicators).forEach(function (k) {
        var lab = PT ? k.charAt(0).toUpperCase() + k.slice(1) : (IND_EN[k] || k);
        if (k === 'data_base' && PT) lab = 'Data-base';
        ind.appendChild(el('tr', {}, '<td>' + esc(lab) + '</td><td>' + num(c.indicators[k], k) + '</td>'));
      });
      memo.innerHTML = c.memo.split(/\n\s*\n/).map(function (para) { return '<p>' + esc(para).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') + '</p>'; }).join('');
      guard.textContent = c.blocked || c.unsupported ? T.blocked : T.passed;
      guard.classList.toggle('bad', !!(c.blocked || c.unsupported));
    }
    sC.addEventListener('change', upd); upd();
  }
})();
