/* Interactive part of the dynamic electricity pricing case. Plain JavaScript + Chart.js, from
   data.json (written by python -m dtr.cli export). Every number comes from the results/ tables. */
(function () {
  var root = document.getElementById('dtr-app');
  if (!root) return;
  var PT = (document.documentElement.lang || '').toLowerCase().indexOf('pt') === 0;
  var T = PT ? {
    tabs: ['Perfis do dia', 'Estudo de evento', 'Quem responde', 'Desenhe a tarifa'],
    pattern: 'Dia com o padrão de preço', season: 'Estação', band: 'Consumo antes do teste',
    winter: 'Inverno (jan a mar, out a dez)', summer: 'Verão (abr a set)', all: 'Todos', low: 'Terço mais baixo', mid: 'Terço do meio', high: 'Terço mais alto',
    tou: 'Tarifa dinâmica', std: 'Tarifa fixa', kwh: 'kWh por hora, média por domicílio', hour: 'Hora do dia (GMT)', days: 'dias',
    priceHigh: 'Preço Alto', priceLow: 'Preço Baixo', noEvent: 'Sem evento',
    type: 'Evento', quarter: 'Trimestre', allYear: 'Ano todo', rel: 'Horas desde o início do evento',
    eff: 'Variação de consumo, watts por domicílio', trial: '2013 (tarifa dinâmica)', ci: 'intervalo de 95%', pre: 'Placebo jul a dez/2012',
    H3: 'Alto de 3 horas', H6: 'Alto de 6 horas', L3: 'Baixo de 3 horas (isolado)', L6: 'Baixo de 6 horas (isolado)',
    hiEff: 'Hora de preço Alto', loEff: 'Hora de preço Baixo', elas: 'elasticidade implícita', placebo: 'placebo antes / depois',
    month: 'Resposta média por mês de 2013 (watts por domicílio)', mHigh: 'Horas de preço Alto', mLow: 'Horas de preço Baixo',
    months: ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'],
    byUse: 'Resposta à hora de preço Alto por quinto de consumo antes do teste (watts, média e intervalo de 95%)',
    byPeak: 'Por quinto da parcela do consumo entre 16h e 20h', q: 'Quinto', saving: 'Economia na conta em 2013 vs. tarifa fixa',
    share: 'Domicílios que pagaram menos', meanSave: 'Economia média no ano', calib: 'Floresta causal: calibração',
    calibS: 'coeficiente da diferença prevista (1 = ranqueia bem)', tbl: ['Quinto de consumo', 'kWh por dia (2012)', 'Resposta (W)', 'Pagaram menos', 'Economia mediana'],
    perMonth: 'Eventos Alto por mês', dur: 'Duração do preço Alto', target: 'Quem recebe o aviso', uptake: 'Domicílios da rede na tarifa',
    tAll: 'Todos na tarifa', tTop: 'Só o quinto que mais consome', h3: '3 horas', h6: '6 horas',
    peak: 'Pico do inverno, rede de 200 casas', peakS: 'sem eventos:', cut: 'Corte médio do pico mensal', inside: 'Energia cortada nas horas de preço Alto',
    outside: 'Energia a mais fora delas (deslocada)', real: 'Calendário real do teste, mesmas escolhas', notified: 'domicílios avisados',
    curve: 'Corte médio do pico mensal (kW) por número de eventos', opt: 'Calendário otimizado', loading: 'Carregando...',
    kwhSeason: 'kWh no inverno', note4: 'Só os três preços observados no teste entram; o simulador não extrapola para outros preços.'
  } : {
    tabs: ['Daily profiles', 'Event study', 'Who responds', 'Design the tariff'],
    pattern: 'Day with price pattern', season: 'Season', band: 'Consumption before the trial',
    winter: 'Winter (Jan to Mar, Oct to Dec)', summer: 'Summer (Apr to Sep)', all: 'All', low: 'Lowest third', mid: 'Middle third', high: 'Highest third',
    tou: 'Dynamic tariff', std: 'Flat tariff', kwh: 'kWh per hour, mean per household', hour: 'Hour of day (GMT)', days: 'days',
    priceHigh: 'High price', priceLow: 'Low price', noEvent: 'No event',
    type: 'Event', quarter: 'Quarter', allYear: 'Whole year', rel: 'Hours since the event started',
    eff: 'Change in consumption, watts per household', trial: '2013 (dynamic tariff)', ci: '95% interval', pre: 'Placebo Jul to Dec 2012',
    H3: '3-hour High', H6: '6-hour High', L3: '3-hour Low (standalone)', L6: '6-hour Low (standalone)',
    hiEff: 'High-price hour', loEff: 'Low-price hour', elas: 'implied elasticity', placebo: 'placebo before / after',
    month: 'Mean response by month of 2013 (watts per household)', mHigh: 'High-price hours', mLow: 'Low-price hours',
    months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    byUse: 'Response to a High-price hour by fifth of consumption before the trial (watts, mean and 95% interval)',
    byPeak: 'By fifth of the share of use between 16:00 and 20:00', q: 'Fifth', saving: '2013 bill saving vs. the flat tariff',
    share: 'Households that paid less', meanSave: 'Mean saving over the year', calib: 'Causal forest: calibration',
    calibS: 'coefficient on the predicted difference (1 = ranks well)', tbl: ['Consumption fifth', 'kWh per day (2012)', 'Response (W)', 'Paid less', 'Median saving'],
    perMonth: 'High events per month', dur: 'Length of the High price', target: 'Who gets the signal', uptake: 'Feeder households on the tariff',
    tAll: 'Everyone on the tariff', tTop: 'Only the fifth that uses most', h3: '3 hours', h6: '6 hours',
    peak: 'Winter peak, feeder of 200 homes', peakS: 'with no events:', cut: 'Mean cut in the monthly peak', inside: 'Energy cut in High-price hours',
    outside: 'Extra energy outside them (shifted)', real: 'The trial’s own calendar, same choices', notified: 'households notified',
    curve: 'Mean monthly peak cut (kW) by number of events', opt: 'Optimised calendar', loading: 'Loading...',
    kwhSeason: 'kWh over the winter', note4: 'Only the three prices seen in the trial are used; the simulator does not extrapolate to other prices.'
  };
  var C = {tou: '#0f766e', std: '#64748b', high: 'rgba(194,65,12,.18)', low: 'rgba(37,99,235,.14)', hi: '#c2410c', lo: '#2563eb', pl: '#94a3b8'};
  function fmt(x, d) { return Number(x).toLocaleString(PT ? 'pt-BR' : 'en-US', {minimumFractionDigits: d || 0, maximumFractionDigits: d || 0}); }
  function sgn(x, d) { return (x > 0 ? '+' : '') + fmt(x, d); }
  function el(tag, attrs, html) { var e = document.createElement(tag); for (var k in (attrs || {})) e.setAttribute(k, attrs[k]); if (html != null) e.innerHTML = html; return e; }
  function control(parent, label, input, out) { var w = el('label', {class: 'dtr-ctl'}); w.appendChild(el('span', {}, label)); w.appendChild(input); if (out) w.appendChild(out); parent.appendChild(w); return input; }
  function select(opts, val) { var s = el('select'); opts.forEach(function (o) { var op = el('option', {value: o[0]}, o[1]); if (String(o[0]) === String(val)) op.selected = true; s.appendChild(op); }); return s; }
  function card(parent, label) { var c = el('div', {class: 'dtr-card'}); c.appendChild(el('div', {class: 'dtr-card-l'}, label)); var v = el('div', {class: 'dtr-card-v'}); c.appendChild(v); var s = el('div', {class: 'dtr-card-s'}); c.appendChild(s); parent.appendChild(c); return {v: v, s: s}; }
  function canvas(p) { var b = el('div', {class: 'dtr-chart'}); var c = el('canvas'); b.appendChild(c); p.appendChild(b); return c; }
  function hh(h) { return (h < 10 ? '0' : '') + h + (PT ? 'h' : ':00'); }
  function runs(pat, ch) { var r = [], s = -1; for (var i = 0; i <= 24; i++) { var on = i < 24 && pat[i] === ch; if (on && s < 0) s = i; if (!on && s >= 0) { r.push([s, i]); s = -1; } } return r; }
  function label(pat) {
    if (pat.indexOf('H') < 0 && pat.indexOf('L') < 0) return T.noEvent;
    var f = function (rr) { return rr.map(function (x) { return hh(x[0]) + (PT ? ' a ' : ' to ') + hh(x[1] % 24); }).join(', '); };
    var out = [], H = runs(pat, 'H'), L = runs(pat, 'L');
    if (H.length) out.push((PT ? 'Alto ' : 'High ') + f(H));
    if (L.length) out.push((PT ? 'Baixo ' : 'Low ') + f(L));
    return out.join('; ');
  }
  var charts = {};
  function draw(key, cv, cfg) { if (charts[key]) charts[key].destroy(); charts[key] = new Chart(cv, cfg); }

  root.appendChild(el('p', {}, T.loading));
  fetch(root.getAttribute('data-src')).then(function (r) { return r.json(); }).then(build).catch(function (e) { root.innerHTML = '<p>data.json: ' + e + '</p>'; });

  function build(D) {
    root.innerHTML = '';
    var nav = el('div', {class: 'dtr-tabs'}); root.appendChild(nav);
    var fns = [profiles, eventStudy, who, design];
    var panes = T.tabs.map(function (t, i) { var b = el('button', {type: 'button'}, t); nav.appendChild(b); var p = el('div', {class: 'dtr-pane'}); root.appendChild(p); b.addEventListener('click', function () { show(i); }); return {b: b, p: p, done: false}; });
    function show(i) { panes.forEach(function (x, j) { x.p.style.display = i === j ? 'block' : 'none'; x.b.classList.toggle('on', i === j); }); if (!panes[i].done) { fns[i](panes[i].p, D); panes[i].done = true; } }
    show(0);
  }

  function profiles(p, D) {
    var P = D.profiles;
    var pats = {}; P.forEach(function (r) { if (r.band === 'all') pats[r.pattern] = (pats[r.pattern] || 0) + r.days; });
    var keys = Object.keys(pats).sort(function (a, b) { return pats[b] - pats[a]; });
    var ctl = el('div', {class: 'dtr-ctls'}); p.appendChild(ctl);
    var sP = control(ctl, T.pattern, select(keys.map(function (k) { return [k, label(k)]; }), keys.filter(function (k) { return k.indexOf('H') >= 0; })[0]));
    var sS = control(ctl, T.season, select([['winter', T.winter], ['summer', T.summer]], 'winter'));
    var sB = control(ctl, T.band, select([['all', T.all], ['low', T.low], ['mid', T.mid], ['high', T.high]], 'all'));
    var leg = el('div', {class: 'dtr-legend'}, '<span><i style="background:' + C.high + '"></i>' + T.priceHigh + '</span><span><i style="background:' + C.low + '"></i>' + T.priceLow + '</span>'); p.appendChild(leg);
    var cv = canvas(p); var note = el('p', {class: 'dtr-note'}); p.appendChild(note);
    function upd() {
      var r = P.filter(function (x) { return x.pattern === sP.value && x.season === sS.value && x.band === sB.value; })[0];
      if (!r) { var other = sS.value === 'winter' ? 'summer' : 'winter'; sS.value = other; r = P.filter(function (x) { return x.pattern === sP.value && x.season === other && x.band === sB.value; })[0]; }
      if (!r) return;
      var mx = Math.max.apply(null, r.tou.concat(r.std)) * 1.1;
      var bg = r.pattern.split('').map(function (c) { return c === 'H' ? C.high : c === 'L' ? C.low : 'rgba(0,0,0,0)'; });
      draw('prof', cv, {data: {labels: r.tou.map(function (_, i) { return hh(i); }), datasets: [
        {type: 'bar', data: r.tou.map(function () { return mx; }), backgroundColor: bg, barPercentage: 1, categoryPercentage: 1, order: 3, label: '_band'},
        {type: 'line', label: T.tou, data: r.tou, borderColor: C.tou, backgroundColor: C.tou, pointRadius: 0, borderWidth: 2, order: 1},
        {type: 'line', label: T.std, data: r.std, borderColor: C.std, backgroundColor: C.std, pointRadius: 0, borderWidth: 2, borderDash: [5, 4], order: 2}]},
        options: {responsive: true, maintainAspectRatio: false, animation: false,
          plugins: {legend: {labels: {filter: function (i) { return i.text !== '_band'; }}}, tooltip: {filter: function (i) { return i.dataset.label !== '_band'; }}},
          scales: {y: {min: 0, max: mx, title: {display: true, text: T.kwh}}, x: {title: {display: true, text: T.hour}, ticks: {maxTicksLimit: 12}}}}});
      note.textContent = label(r.pattern) + ' · ' + r.days + ' ' + T.days;
    }
    [sP, sS, sB].forEach(function (c) { c.addEventListener('input', upd); }); upd();
  }

  function eventStudy(p, D) {
    var d = D.did.kwh, l = D.did.lkwh, e = D.elasticity;
    var cards = el('div', {class: 'dtr-cards'}); p.appendChild(cards);
    var c1 = card(cards, T.hiEff), c2 = card(cards, T.loEff);
    c1.v.textContent = sgn(1000 * d.high_trial.coef, 1) + ' W (' + sgn(100 * (Math.exp(l.high_trial.coef) - 1), 1) + '%)';
    c1.s.textContent = T.elas + ' ' + fmt(e.high, 3) + ' · ' + T.placebo + ': ' + sgn(1000 * d.high_pre.coef, 1) + ' / ' + sgn(1000 * d.high_post.coef, 1) + ' W';
    c2.v.textContent = sgn(1000 * d.low_trial.coef, 1) + ' W (' + sgn(100 * (Math.exp(l.low_trial.coef) - 1), 1) + '%)';
    c2.s.textContent = T.elas + ' ' + fmt(e.low, 3) + ' · ' + T.placebo + ': ' + sgn(1000 * d.low_pre.coef, 1) + ' / ' + sgn(1000 * d.low_post.coef, 1) + ' W';
    var ctl = el('div', {class: 'dtr-ctls'}); p.appendChild(ctl);
    var sT = control(ctl, T.type, select([['H6', T.H6], ['H3', T.H3], ['L3', T.L3], ['L6', T.L6]], 'H6'));
    var sQ = control(ctl, T.quarter, select([['all', T.allYear], ['1', 'Q1'], ['2', 'Q2'], ['3', 'Q3'], ['4', 'Q4']], 'all'));
    var cv = canvas(p);
    function rows(kind, est, prefix) {
      return D.series[kind].filter(function (r) { return r.estimate === est && r.term.indexOf(prefix + '_k') === 0; })
        .map(function (r) { return {k: +r.term.split('_k')[1], c: 1000 * r.coef, lo: 1000 * r.lo, hi: 1000 * r.hi}; }).sort(function (a, b) { return a.k - b.k; });
    }
    function upd() {
      var kind = sQ.value === 'all' ? 'es' : 'es_q', pre = sQ.value === 'all' ? sT.value : sT.value + '_Q' + sQ.value;
      var r = rows(kind, 'trial', pre), pl = rows(kind, 'pre', pre);
      var dur = +sT.value.slice(1), col = sT.value[0] === 'H' ? C.hi : C.lo;
      var ks = r.map(function (x) { return x.k; });
      var plm = {}; pl.forEach(function (x) { plm[x.k] = x.c; });
      draw('es', cv, {type: 'line', data: {labels: ks, datasets: [
        {label: T.ci, data: r.map(function (x) { return x.hi; }), borderWidth: 0, pointRadius: 0, backgroundColor: 'rgba(15,118,110,.15)', fill: '+1'},
        {label: '_lo', data: r.map(function (x) { return x.lo; }), borderWidth: 0, pointRadius: 0, fill: false},
        {label: T.trial, data: r.map(function (x) { return x.c; }), borderColor: C.tou, backgroundColor: C.tou, pointRadius: ks.map(function (k) { return k >= 0 && k < dur ? 4 : 2; }), pointBackgroundColor: ks.map(function (k) { return k >= 0 && k < dur ? col : C.tou; }), borderWidth: 2},
        {label: T.pre, data: ks.map(function (k) { return plm[k] === undefined ? null : plm[k]; }), borderColor: C.pl, borderDash: [4, 4], pointRadius: 0, borderWidth: 1.5}]},
        options: {responsive: true, maintainAspectRatio: false, animation: false,
          plugins: {legend: {labels: {filter: function (i) { return i.text !== '_lo'; }}}},
          scales: {y: {title: {display: true, text: T.eff}}, x: {title: {display: true, text: T.rel}}}}});
    }
    [sT, sQ].forEach(function (c) { c.addEventListener('input', upd); }); upd();
    p.appendChild(el('h4', {style: 'font-size:.9rem;margin:.6rem 0 .2rem'}, T.month));
    var cv2 = canvas(p);
    var M = D.series.month.filter(function (r) { return r.estimate === 'trial'; });
    function mser(k) { return T.months.map(function (_, i) { var x = M.filter(function (r) { return r.term === k + '_m' + (i + 1); })[0]; return x ? 1000 * x.coef : null; }); }
    new Chart(cv2, {type: 'bar', data: {labels: T.months, datasets: [{label: T.mHigh, data: mser('High'), backgroundColor: C.hi}, {label: T.mLow, data: mser('Low'), backgroundColor: C.lo}]},
      options: {responsive: true, maintainAspectRatio: false, animation: false, scales: {y: {title: {display: true, text: 'W'}}}}});
  }

  function who(p, D) {
    var b = D.bills, f = D.forest;
    var cards = el('div', {class: 'dtr-cards'}); p.appendChild(cards);
    var c1 = card(cards, T.share), c2 = card(cards, T.meanSave), c3 = card(cards, T.calib);
    c1.v.textContent = fmt(100 * b.share_saving, 0) + '%'; c1.s.textContent = T.saving;
    c2.v.textContent = '£' + fmt(b.saving_mean, 2); c2.s.textContent = (PT ? 'mediana £' : 'median £') + fmt(b.saving_median, 2) + (PT ? ', de uma conta média de £' : ', on a mean bill of £') + fmt(b.bill_flat_mean, 0);
    c3.v.textContent = fmt(f.calib_diff, 2) + ' (± ' + fmt(1.96 * f.calib_diff_se, 2) + ')'; c3.s.textContent = T.calibS;
    p.appendChild(el('h4', {style: 'font-size:.9rem;margin:.6rem 0 .2rem'}, T.byUse));
    var cv = canvas(p);
    var W = D.who;
    function bars(by) { return W.filter(function (r) { return r.by === by; }).sort(function (a, b) { return a.quintile - b.quintile; }); }
    var u = bars('use_q'), k = bars('peak_q');
    function ds(rr, col, lab) { return {label: lab, data: rr.map(function (r) { return 1000 * r.response_dr; }), backgroundColor: col,
      errs: rr.map(function (r) { return 1000 * 1.96 * r.response_dr_se; })}; }
    var errPlugin = {id: 'err', afterDatasetsDraw: function (ch) { var ctx = ch.ctx; ch.data.datasets.forEach(function (d, di) { var m = ch.getDatasetMeta(di); m.data.forEach(function (bar, i) { var y = ch.scales.y, v = d.data[i], e = d.errs[i]; ctx.save(); ctx.strokeStyle = '#334155'; ctx.beginPath(); ctx.moveTo(bar.x, y.getPixelForValue(v - e)); ctx.lineTo(bar.x, y.getPixelForValue(v + e)); ctx.stroke(); ctx.restore(); }); }); }};
    new Chart(cv, {type: 'bar', data: {labels: u.map(function (r) { return T.q + ' ' + r.quintile; }), datasets: [ds(u, C.tou, PT ? 'Consumo diário' : 'Daily use'), ds(k, C.hi, PT ? 'Parcela 16h a 20h' : 'Share 16:00 to 20:00')]},
      options: {responsive: true, maintainAspectRatio: false, animation: false, scales: {y: {title: {display: true, text: 'W'}}}}, plugins: [errPlugin]});
    var t = el('table', {class: 'dtr-table'}); p.appendChild(t);
    t.innerHTML = '<thead><tr>' + T.tbl.map(function (h) { return '<th>' + h + '</th>'; }).join('') + '</tr></thead><tbody>' +
      u.map(function (r) { return '<tr><td>' + T.q + ' ' + r.quintile + '</td><td>' + fmt(r.pre_daily_kwh, 1) + '</td><td>' + sgn(1000 * r.response_dr, 0) + '</td><td>' + fmt(100 * r.share_saving, 0) + '%</td><td>£' + fmt(r.saving_median, 2) + '</td></tr>'; }).join('') +
      '</tbody>';
    p.appendChild(el('p', {class: 'dtr-note'}, T.byPeak + ': ' + k.map(function (r) { return T.q + ' ' + r.quintile + ' ' + fmt(100 * r.share_saving, 0) + '%'; }).join(' · ') + (PT ? ' pagaram menos.' : ' paid less.')));
  }

  function design(p, D) {
    var P = D.policy;
    var ctl = el('div', {class: 'dtr-ctls'}); p.appendChild(ctl);
    var ko = el('output'), sK = control(ctl, T.perMonth, el('input', {type: 'range', min: 0, max: 8, step: 1, value: 4}), ko);
    var sL = control(ctl, T.dur, select([[6, T.h6], [3, T.h3]], 6));
    var sG = control(ctl, T.target, select([['all', T.tAll], ['top20', T.tTop]], 'all'));
    var sU = control(ctl, T.uptake, select([[1, '100%'], [0.5, '50%'], [0.25, '25%']], 1));
    var cards = el('div', {class: 'dtr-cards'}); p.appendChild(cards);
    var cP = card(cards, T.peak), cC = card(cards, T.cut), cI = card(cards, T.inside), cO = card(cards, T.outside), cR = card(cards, T.real);
    var cv = canvas(p);
    p.appendChild(el('p', {class: 'dtr-note'}, T.note4));
    function pick(pol, K) { return P.filter(function (r) { return r.policy === pol && r.hours === +sL.value && r.target === sG.value && Math.abs(r.uptake - +sU.value) < 1e-9 && (K === undefined || r.per_month === K); }); }
    function upd() {
      var K = +sK.value; ko.textContent = K;
      var r = pick('optimised', K)[0], tr = pick('trial calendar')[0];
      if (!r) return;
      cP.v.textContent = fmt(r.season_peak_after, 1) + ' kW'; cP.s.textContent = T.peakS + ' ' + fmt(r.season_peak_before, 1) + ' kW · ' + fmt(100 * r.notified_share, 0) + '% ' + T.notified;
      cC.v.textContent = fmt(r.monthly_peak_cut_mean, 2) + ' kW'; cC.s.textContent = fmt(100 * r.monthly_peak_cut_mean / r.season_peak_before, 1) + '%';
      cI.v.textContent = fmt(r.energy_cut_in_high, 0) + ' kWh'; cI.s.textContent = r.events + (PT ? ' eventos no inverno' : ' events over the winter');
      cO.v.textContent = fmt(r.energy_added_outside, 0) + ' kWh'; cO.s.textContent = (PT ? 'e ' : 'and ') + fmt(r.energy_cut_outside, 0) + (PT ? ' kWh a menos fora delas' : ' kWh less outside them');
      if (tr) { cR.v.textContent = fmt(tr.monthly_peak_cut_mean, 2) + ' kW'; cR.s.textContent = tr.events + (PT ? ' eventos de ' : ' events of ') + sL.value + 'h'; }
      var all = pick('optimised').sort(function (a, b) { return a.per_month - b.per_month; });
      draw('pol', cv, {type: 'line', data: {labels: all.map(function (x) { return x.per_month; }), datasets: [
        {label: T.opt, data: all.map(function (x) { return x.monthly_peak_cut_mean; }), borderColor: C.tou, backgroundColor: C.tou,
         pointRadius: all.map(function (x) { return x.per_month === K ? 6 : 3; })},
        {label: T.real, data: all.map(function () { return tr ? tr.monthly_peak_cut_mean : null; }), borderColor: C.pl, borderDash: [4, 4], pointRadius: 0}]},
        options: {responsive: true, maintainAspectRatio: false, animation: false, plugins: {title: {display: true, text: T.curve}},
          scales: {x: {title: {display: true, text: T.perMonth}}, y: {min: 0, title: {display: true, text: 'kW'}}}}});
    }
    [sK, sL, sG, sU].forEach(function (c) { c.addEventListener('input', upd); }); upd();
  }
})();
