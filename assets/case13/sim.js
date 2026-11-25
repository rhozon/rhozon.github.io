/* Interactive part of the Rio short-term rental case. Plain JavaScript + Chart.js, from data.json
   (written by python -m strp.cli export). */
(function () {
  var root = document.getElementById('strp-app');
  if (!root) return;
  var PT = (document.documentElement.lang || '').toLowerCase().indexOf('pt') === 0;
  var T = PT ? {
    tabs: ['Precificar um imóvel', 'Calendário', 'Bairros'],
    nb: 'Bairro', room: 'Tipo', guests: 'Hóspedes', bedrooms: 'Quartos', baths: 'Banheiros', rating: 'Nota média',
    reviews: 'Avaliações', amen: 'Itens de comodidade', superhost: 'Superhost', instant: 'Reserva instantânea', minN: 'Mínimo de noites',
    market: 'Preço de mercado estimado por noite', range: 'metade dos anúncios parecidos fica entre',
    yours: 'Seu preço em relação ao mercado', stays: 'Estadias no trimestre', revenue: 'Receita no trimestre',
    vsMarket: 'vs. cobrar o preço de mercado', elasNote: 'Com a elasticidade estimada de', elasNote2: '(faixa do instrumento:',
    elasNote3: '). Vale para mudanças moderadas de preço; muito longe do mercado, a resposta pode ser outra.',
    calTitle: 'Noites já indisponíveis por data (raspagem de 22/09/2026)', share: 'Indisponíveis', ny: 'Réveillon', carn: 'Carnaval 2027',
    nbHead: ['Bairro', 'Anúncios', 'Preço mediano', 'Ocupado nos próximos 90 dias', 'Imóvel inteiro'],
    yes: 'sim', no: 'não', entire: 'Imóvel inteiro', priv: 'Quarto privativo', shared: 'Quarto compartilhado', hotel: 'Quarto de hotel',
    other: 'Outro bairro', loading: 'Carregando...'
  } : {
    tabs: ['Price a place', 'Calendar', 'Neighbourhoods'],
    nb: 'Neighbourhood', room: 'Type', guests: 'Guests', bedrooms: 'Bedrooms', baths: 'Bathrooms', rating: 'Average rating',
    reviews: 'Reviews', amen: 'Amenities listed', superhost: 'Superhost', instant: 'Instant book', minN: 'Minimum nights',
    market: 'Estimated market price per night', range: 'half of similar listings fall between',
    yours: 'Your price relative to the market', stays: 'Stays in the quarter', revenue: 'Revenue in the quarter',
    vsMarket: 'vs. charging the market price', elasNote: 'With the estimated elasticity of', elasNote2: '(instrument range:',
    elasNote3: '). It holds for moderate price changes; far from the market the response may differ.',
    calTitle: 'Nights already unavailable by date (scrape of 22 September 2026)', share: 'Unavailable', ny: 'New Year’s Eve', carn: 'Carnival 2027',
    nbHead: ['Neighbourhood', 'Listings', 'Median price', 'Booked next 90 days', 'Entire home'],
    yes: 'yes', no: 'no', entire: 'Entire home/apt', priv: 'Private room', shared: 'Shared room', hotel: 'Hotel room',
    other: 'Other neighbourhood', loading: 'Loading...'
  };
  function fmt(x, d) { return Number(x).toLocaleString(PT ? 'pt-BR' : 'en-US', {minimumFractionDigits: d || 0, maximumFractionDigits: d || 0}); }
  function pct(x) { return (x >= 0 ? '+' : '') + fmt(100 * x, 1) + '%'; }
  function el(tag, attrs, html) { var e = document.createElement(tag); for (var k in (attrs || {})) e.setAttribute(k, attrs[k]); if (html != null) e.innerHTML = html; return e; }
  function control(parent, label, input, out) { var w = el('label', {class: 'strp-ctl'}); w.appendChild(el('span', {}, label)); w.appendChild(input); if (out) w.appendChild(out); parent.appendChild(w); return input; }
  function select(opts, val) { var s = el('select'); opts.forEach(function (o) { var op = el('option', {value: o[0]}, o[1]); if (String(o[0]) === String(val)) op.selected = true; s.appendChild(op); }); return s; }
  function range(min, max, step, val) { return el('input', {type: 'range', min: min, max: max, step: step, value: val}); }
  function card(parent, label) { var c = el('div', {class: 'strp-card'}); c.appendChild(el('div', {class: 'strp-card-l'}, label)); var v = el('div', {class: 'strp-card-v'}); c.appendChild(v); var s = el('div', {class: 'strp-card-s'}); c.appendChild(s); parent.appendChild(c); return {v: v, s: s}; }

  root.appendChild(el('p', {}, T.loading));
  fetch(root.getAttribute('data-src')).then(function (r) { return r.json(); }).then(build).catch(function (e) { root.innerHTML = '<p>data.json: ' + e + '</p>'; });

  function build(D) {
    root.innerHTML = '';
    var nav = el('div', {class: 'strp-tabs'}); root.appendChild(nav);
    var panes = T.tabs.map(function (t, i) { var b = el('button', {type: 'button'}, t); nav.appendChild(b); var p = el('div', {class: 'strp-pane'}); root.appendChild(p); b.addEventListener('click', function () { show(i); }); return {b: b, p: p}; });
    function show(i) { panes.forEach(function (x, j) { x.p.style.display = i === j ? 'block' : 'none'; x.b.classList.toggle('on', i === j); }); }
    pricer(panes[0].p, D); calendar(panes[1].p, D); hoods(panes[2].p, D); show(0);
  }

  function pricer(p, D) {
    var H = {}; D.hedonic.forEach(function (h) { H[h.term] = h.coef; });
    var nbs = Object.keys(H).filter(function (k) { return k.indexOf('C(nb)[T.') === 0; }).map(function (k) { return k.slice(8, -1); });
    var base = D.neighbourhoods.map(function (n) { return n.neighbourhood_cleansed; });
    var all = nbs.filter(function (n) { return n !== 'Other'; }).sort();
    var ctl = el('div', {class: 'strp-ctls'}); p.appendChild(ctl);
    var sNb = control(ctl, T.nb, select(all.map(function (n) { return [n, n]; }).concat([['Other', T.other]]), all.indexOf('Copacabana') >= 0 ? 'Copacabana' : all[0]));
    var sRoom = control(ctl, T.room, select([['Entire home/apt', T.entire], ['Private room', T.priv], ['Shared room', T.shared], ['Hotel room', T.hotel]], 'Entire home/apt'));
    var go = el('output'), sG = control(ctl, T.guests, range(1, 10, 1, 4), go);
    var bo = el('output'), sB = control(ctl, T.bedrooms, range(0, 5, 1, 1), bo);
    var ba = el('output'), sBa = control(ctl, T.baths, range(0, 4, 1, 1), ba);
    var ro = el('output'), sR = control(ctl, T.rating, range(3.5, 5, 0.05, 4.8), ro);
    var rvo = el('output'), sRv = control(ctl, T.reviews, range(0, 300, 5, 30), rvo);
    var ao = el('output'), sA = control(ctl, T.amen, range(5, 100, 1, 35), ao);
    var mo = el('output'), sM = control(ctl, T.minN, range(1, 30, 1, 2), mo);
    var sS = control(ctl, T.superhost, select([[0, T.no], [1, T.yes]], 0));
    var sI = control(ctl, T.instant, select([[0, T.no], [1, T.yes]], 1));
    var cards = el('div', {class: 'strp-cards'}); p.appendChild(cards);
    var cM = card(cards, T.market);
    var ctl2 = el('div', {class: 'strp-ctls'}); p.appendChild(ctl2);
    var yo = el('output'), sY = control(ctl2, T.yours, range(-40, 60, 5, 0), yo);
    var cards2 = el('div', {class: 'strp-cards'}); p.appendChild(cards2);
    var cS = card(cards2, T.stays), cR = card(cards2, T.revenue);
    var e = D.elasticity, fe = e.find(function (r) { return r.spec === 'fixed effects'; }), iv = e.find(function (r) { return r.spec.indexOf('instrumented') === 0; });
    p.appendChild(el('p', {class: 'strp-note'}, T.elasNote + ' ' + fmt(fe.coef, 2) + ' ' + T.elasNote2 + ' ' + fmt(iv.lo, 2) + (PT ? ' a ' : ' to ') + fmt(iv.hi, 2) + T.elasNote3));
    function upd() {
      var x = {log_acc: Math.log(+sG.value), bedrooms: +sB.value, bathrooms: +sBa.value, rating: +sR.value, log_reviews: Math.log(1 + +sRv.value),
               n_amenities: +sA.value, superhost: +sS.value, instant: +sI.value, log_min_nights: Math.log(+sM.value)};
      go.textContent = sG.value; bo.textContent = sB.value; ba.textContent = sBa.value; ro.textContent = fmt(+sR.value, 2); rvo.textContent = sRv.value; ao.textContent = sA.value; mo.textContent = sM.value;
      var lp = H['Intercept'] + (H['C(nb)[T.' + sNb.value + ']'] || 0) + (H['C(room_type)[T.' + sRoom.value + ']'] || 0);
      Object.keys(x).forEach(function (k) { lp += (H[k] || 0) * x[k]; });
      var med = Math.exp(lp), mdape = D.summary.hedonic_random_mdape_ols;
      cM.v.textContent = 'R$ ' + fmt(med, 0);
      cM.s.textContent = T.range + ' R$ ' + fmt(med * (1 - mdape), 0) + (PT ? ' e ' : ' and ') + 'R$ ' + fmt(med * (1 + mdape), 0);
      var d = +sY.value / 100; yo.textContent = pct(d) + ' (R$ ' + fmt(med * (1 + d), 0) + ')';
      var dl = Math.log(1 + d), sc = Math.exp(fe.coef * dl) - 1, lo = Math.exp(iv.hi * dl) - 1, hi = Math.exp(iv.lo * dl) - 1;
      cS.v.textContent = pct(sc); cS.s.textContent = T.vsMarket + ' (' + pct(Math.min(lo, hi)) + (PT ? ' a ' : ' to ') + pct(Math.max(lo, hi)) + ')';
      var rv = (1 + d) * (1 + sc) - 1; cR.v.textContent = pct(rv); cR.s.textContent = T.vsMarket;
    }
    [sNb, sRoom, sG, sB, sBa, sR, sRv, sA, sM, sS, sI, sY].forEach(function (c) { c.addEventListener('input', upd); }); upd();
  }

  function calendar(p, D) {
    var box = el('div', {class: 'strp-chart'}); var cv = el('canvas'); box.appendChild(cv); p.appendChild(box);
    var lab = D.calendar.map(function (r) { return r.date.slice(0, 10); });
    var ny = lab.indexOf('2026-12-31'), cn = lab.indexOf('2027-02-08');
    new Chart(cv, {type: 'line', data: {labels: lab, datasets: [{label: T.share, data: D.calendar.map(function (r) { return 100 * r.share_unavailable; }), borderColor: '#0f766e', pointRadius: lab.map(function (d, i) { return i === ny || i === cn ? 5 : 0; }), pointBackgroundColor: '#c2410c', borderWidth: 1.5}]},
      options: {responsive: true, maintainAspectRatio: false, animation: false, plugins: {title: {display: true, text: T.calTitle + ' (%)'},
        subtitle: {display: true, text: T.ny + ': ' + fmt(100 * D.summary.events_unavailable["New Year's Eve"], 0) + '% (' + (PT ? '1 a 20/12: ' : '1 to 20 Dec: ') + fmt(100 * D.summary.baseline_unavailable['1 to 20 December 2026'], 0) + '%) · ' + T.carn + ': ' + fmt(100 * D.summary.events_unavailable['Carnival 2027'], 0) + '% (' + (PT ? '15/2 a 5/3: ' : '15 Feb to 5 Mar: ') + fmt(100 * D.summary.baseline_unavailable['15 February to 5 March 2027'], 0) + '%)'}},
        scales: {x: {ticks: {maxTicksLimit: 12}}}}});
  }

  function hoods(p, D) {
    var t = el('table', {class: 'strp-table'}); p.appendChild(t);
    t.innerHTML = '<thead><tr>' + T.nbHead.map(function (h) { return '<th>' + h + '</th>'; }).join('') + '</tr></thead><tbody>' +
      D.neighbourhoods.slice(0, 30).map(function (n) { return '<tr><td>' + n.neighbourhood_cleansed + '</td><td>' + fmt(n.listings, 0) + '</td><td>R$ ' + fmt(n.median_price, 0) + '</td><td>' + fmt(100 * n.booked_next_90, 0) + '%</td><td>' + fmt(100 * n.entire_home_share, 0) + '%</td></tr>'; }).join('') + '</tbody>';
  }
})();
