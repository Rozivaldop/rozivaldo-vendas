const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const $ = s => document.querySelector(s);
const R = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const D = d => new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const CATS = ['Masculino', 'Feminino', 'Lingerie', 'Sexshop'];
const FORMAS = ['Dinheiro', 'Pix', 'Cartão', 'Outro'];
const opts = a => a.map(x => `<option>${x}</option>`).join('');
const sum = (a, f) => a.reduce((t, x) => t + Number(f(x) || 0), 0);
const mes = d => { const x = new Date(d); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0'); };
let F = { de: mes(new Date()) + '-01', ate: '', cli: '' };
let S = { c: [], v: [], p: [], pr: [], pa: [], ct: [], pd: [], sg: [] }, cur = 'inicio', curId = null;

function toast(m) { const t = $('#toast'); t.textContent = m; t.style.display = 'block'; setTimeout(() => t.style.display = 'none', 2800); }

async function load() {
  const [c, v, p, pr, pa, ct, pd, sg] = await Promise.all([
    db.from('clientes').select('*').order('nome'),
    db.from('vendas').select('*, itens_venda(*)').order('data', { ascending: false }),
    db.from('pagamentos').select('*').order('criado_em', { ascending: false }),
    db.from('produtos').select('*').order('nome'),
    db.from('parcelas').select('*'),
    db.from('contas').select('*'),
    db.from('pedidos').select('*').eq('status', 'novo').order('criado_em', { ascending: false }),
    db.from('sugestoes').select('*').order('criado_em', { ascending: false })
  ]);
  S = { c: c.data || [], v: v.data || [], p: p.data || [], pr: pr.data || [], pa: pa.data || [], ct: ct.data || [], pd: pd.data || [], sg: sg.data || [] };
}
function info(id) {
  const vs = S.v.filter(v => v.cliente_id == id), ps = S.p.filter(p => p.cliente_id == id);
  const t = sum(vs, v => v.total), p = sum(ps, x => x.valor);
  return { vs, ps, t, p, s: t - p };
}
function go(v, id, ed) { $('#side').classList.remove('open'); cur = v; curId = id || null; EDIT = ed || null; render(); window.scrollTo(0, 0); }
function render() {
  document.querySelectorAll('[data-nav]').forEach(b => b.classList.toggle('on', b.dataset.nav == cur || (cur == 'ficha' && b.dataset.nav == 'clientes')));
  $('#view').innerHTML = { inicio, vitrine, procuras, cobranca, fluxo, dash, clientes, venda, ficha, catalogo, relatorio, financeiro, historico, recebimentos, contas, ajustes, pedidos }[cur]();
  if (cur == 'inicio') vitInit();
  if (cur == 'vitrine') vtxt();
  if (cur == 'venda') iniciaVenda();
  const nn = sgNovas().length, tt = S.pd.length + nn, pb = $('#pbadge'), sb = $('#sbadge'); pb.textContent = tt || ''; pb.hidden = !tt; if (sb) { sb.textContent = nn || ''; sb.hidden = !nn; }
}
function modal(h) { $('#modal').innerHTML = `<div class="bk" onclick="if(event.target==this)fecha()"><div class="sheet">${h}</div></div>`; }
function fecha() { PREPROD = null; $('#modal').innerHTML = ''; }

/* ===== INÍCIO: vitrine, recentes, voz e vitrine WhatsApp ===== */
let AUTO = null;
/* ===== PROCURAS DOS CLIENTES (produtos que não achou no catálogo) ===== */
let PR = { f: 'abertas' }, PREPROD = null;
const sgKey = t => nz(String(t || '')).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim().split(' ').map(w => w.length > 3 ? w.replace(/s$/, '') : w).join(' ');
const sgChave = x => sgKey(x.produto) || x.id;
const sgVisto = () => { try { return new Date(localStorage.getItem('rs_sg_visto') || 0); } catch (e) { return new Date(0); } };
const sgMarcaVisto = () => { try { localStorage.setItem('rs_sg_visto', new Date().toISOString()); } catch (e) {} };
const sgNovas = () => (S.sg || []).filter(x => x.status == 'nova' && new Date(x.criado_em) > sgVisto());
function sgResumo() {
  const o = {};
  sgNovas().forEach(x => { const k = sgChave(x); o[k] = o[k] || { n: 0, nome: x.produto.trim() }; o[k].n++; });
  return Object.values(o).sort((a, b) => b.n - a.n).slice(0, 3).map(x => `${x.nome} (${x.n})`).join(', ');
}
function sgGrupos(f) {
  const ok = { abertas: x => x.status == 'nova', atendidas: x => x.status == 'atendida' || x.status == 'avisada', descartadas: x => x.status == 'descartada' }[f], g = {};
  (S.sg || []).filter(ok).forEach(x => { const k = sgChave(x); (g[k] = g[k] || { k, l: [] }).l.push(x); });
  const top = o => Object.entries(o).sort((a, b) => b[1] - a[1]).map(e => e[0])[0] || '';
  return Object.values(g).map(o => {
    const nomes = {}, cats = {};
    o.l.forEach(x => { const n = x.produto.trim(); nomes[n] = (nomes[n] || 0) + 1; if (x.categoria) cats[x.categoria] = (cats[x.categoria] || 0) + 1; });
    return { ...o, nome: top(nomes), cat: top(cats), n: o.l.length, ult: o.l[0].criado_em };
  }).sort((a, b) => b.n - a.n || new Date(b.ult) - new Date(a.ult));
}
function sgCard(x, i, max, antes) {
  const f = PR.f, det = [...new Set(x.l.map(p => (p.detalhes || '').trim()).filter(Boolean))].slice(0, 3);
  const acao = p => !p.telefone ? '' : f == 'abertas' ? `<button class="lnk" onclick="sgZap('${p.id}')">Responder</button>` : f == 'atendidas' ? (p.status == 'avisada' ? '<small class="grn">✓ avisada</small>' : `<button class="btn" onclick="sgAvisar('${p.id}')">Avisar que chegou</button>`) : '';
  return `<div class="card"><div class="row"><b>${i + 1}º · ${esc(x.nome)}</b><em class="tag ${x.n >= 3 ? 'bad' : 'wait'}">${x.n} ${x.n == 1 ? 'pedido' : 'pedidos'}</em></div>
  <div class="barra"><i style="width:${Math.max(6, x.n / max * 100)}%"></i></div>
  <small class="blk">${x.cat ? IC[x.cat] + ' ' + x.cat + ' · ' : ''}último pedido em ${new Date(x.ult).toLocaleDateString('pt-BR')}</small>
  ${det.map(d => `<small class="blk">💬 “${esc(d)}”</small>`).join('')}
  <details><summary class="lnk">Quem pediu (${x.l.length})</summary>${x.l.map(p => `<div class="row" style="margin-top:6px"><small>${esc(p.nome || 'Sem nome')}${p.telefone ? ' · ' + esc(p.telefone) : ''}${p.status == 'nova' && new Date(p.criado_em) > antes ? ' <em class="tag wait">novo</em>' : ''}</small>${acao(p)}</div>`).join('')}</details>
  <div class="row" style="margin-top:8px">${f == 'abertas' ? `<button class="btn" onclick="sgCadastrar('${x.k}')">Cadastrar produto</button><button class="btn alt" onclick="sgStatus('${x.k}','descartada')">Descartar</button>` : `<button class="btn alt" onclick="sgStatus('${x.k}','nova')">Reabrir</button>`}</div></div>`;
}
function procuras() {
  const antes = sgVisto(); sgMarcaVisto();
  const g = sgGrupos(PR.f), max = g[0] ? g[0].n : 1, ab = sgGrupos('abertas');
  return `<h1>Procuras dos clientes</h1><p class="mut">O que seus clientes pediram no catálogo e você ainda não tem. Os mais pedidos aparecem primeiro.</p>
  <div class="grid"><div class="card"><small>Pedidos em aberto</small><b class="blk">${sum(ab, x => x.n)}</b></div><div class="card"><small>Produto mais pedido</small><b class="blk" style="font-size:1rem">${ab[0] ? esc(ab[0].nome) + ' (' + ab[0].n + ')' : '—'}</b></div></div>
  <div class="row" style="justify-content:flex-start">${[['abertas', 'Em aberto'], ['atendidas', 'Atendidas'], ['descartadas', 'Descartadas']].map(([k, l]) => `<button class="btn ${PR.f == k ? '' : 'alt'}" onclick="PR.f='${k}';render()">${l}</button>`).join('')}</div>
  ${g.map((x, i) => sgCard(x, i, max, antes)).join('') || `<p class="mut">${PR.f == 'abertas' ? 'Nenhuma procura em aberto. Quando um cliente pedir algo no catálogo, aparece aqui.' : 'Nada por aqui ainda.'}</p>`}`;
}
async function sgStatus(k, para) {
  const de = { abertas: ['nova'], atendidas: ['atendida', 'avisada'], descartadas: ['descartada'] }[PR.f];
  const ids = S.sg.filter(x => sgChave(x) == k && de.includes(x.status)).map(x => x.id);
  const { error } = await db.from('sugestoes').update({ status: para }).in('id', ids);
  if (error) return toast('Erro: ' + error.message);
  await load(); render(); toast(para == 'descartada' ? 'Descartado' : 'Reaberto');
}
function sgCadastrar(k) {
  const g = sgGrupos('abertas').find(x => x.k == k); if (!g) return;
  go('catalogo'); PREPROD = { nome: g.nome, categoria: g.cat, sg: k }; formProd();
}
function sgZap(id) {
  const p = S.sg.find(x => x.id == id); if (!p) return;
  window.open(zapLink(p, `Olá${p.nome ? ', ' + p.nome : ''}! Aqui é da Rozivaldo Store 💜\n\nRecebi seu pedido de “${p.produto}” pelo catálogo. Vou ver como conseguir e te aviso assim que chegar!`), '_blank');
}
async function sgAvisar(id) {
  const p = S.sg.find(x => x.id == id); if (!p) return;
  window.open(zapLink(p, `Olá${p.nome ? ', ' + p.nome : ''}! Boa notícia 🎉\n\nO produto que você pediu (${p.produto}) já chegou na Rozivaldo Store! Dá uma olhada no nosso catálogo: ${LINK()}\n\nSe quiser reservar é só me chamar! 💜`), '_blank');
  await db.from('sugestoes').update({ status: 'avisada' }).eq('id', id);
  await load(); render();
}
function avisos() {
  const it = hojeItens();
  modal(`<h2>🔔 Notificações</h2>${it.length ? it.map(([i, t, v, a, c]) => `<button class="hj ${c}" style="width:100%;margin-top:8px" onclick="fecha();${a}"><span class="em">${i}</span><span><small>${t}</small><b>${v}</b></span></button>`).join('') : '<p class="mut">Sem novidades por agora. ✅</p>'}`);
}
/* ===== INÍCIO: mais vendidos, últimas vendas, clientes para reativar ===== */
const diasDesde = d => Math.floor((Date.now() - new Date(d)) / 864e5);
function maisVendidos() {
  const m = mes(new Date());
  let vs = S.v.filter(v => mes(v.data) == m), tit = 'Mais vendidos do mês';
  if (!vs.length) { vs = S.v; tit = 'Mais vendidos'; }
  const o = {};
  vs.flatMap(v => v.itens_venda || []).forEach(t => { const k = nz(t.produto); o[k] = o[k] || { nome: t.produto, q: 0 }; o[k].q += t.quantidade; });
  const l = Object.values(o).sort((a, b) => b.q - a.q).slice(0, 6).map(x => ({ ...x, p: S.pr.find(p => nz(p.nome) == nz(x.nome)) }));
  return `<div class="card"><h2 class="up">🔥 ${tit}</h2>${l.length ? `<div class="rgrid">${l.map(x => `<div class="mini">${imgProd(x.p || {})}<div class="grow"><b class="pn">${esc(x.nome)}</b><small class="blk">${x.q} ${x.q == 1 ? 'unidade vendida' : 'unidades vendidas'}</small>${x.p ? `<button class="vend" onclick="vender('${x.p.id}')">VENDER <span>+</span></button>` : ''}</div></div>`).join('')}</div>` : '<p class="mut">Os produtos mais vendidos aparecem aqui depois das primeiras vendas.</p>'}</div>`;
}
function ultimasVendas() {
  const l = [...S.v].sort((a, b) => new Date(b.data) - new Date(a.data)).slice(0, 6);
  return `<div class="card"><h2 class="up">🧾 Últimas vendas</h2>${l.map(v => { const c = S.c.find(x => x.id == v.cliente_id) || {}, n = (v.itens_venda || []).reduce((a, t) => a + t.quantidade, 0);
    return `<div class="item" onclick="go('ficha','${v.cliente_id}')"><span><b>${esc(c.nome || '—')}</b><small class="blk">${new Date(v.data).toLocaleDateString('pt-BR')} · ${n} ${n == 1 ? 'item' : 'itens'}</small></span><span style="text-align:right"><b>${R(v.total)}</b><br>${tag(stVenda(v))}</span></div>`; }).join('') || '<p class="mut">Nenhuma venda registrada ainda.</p>'}
  ${l.length ? `<button class="lnk" onclick="go('historico')">Ver histórico completo</button>` : ''}</div>`;
}
const reaLer = () => { try { return JSON.parse(localStorage.getItem('rs_rea') || '{}'); } catch (e) { return {}; } };
function clientesReativar() {
  const rea = reaLer(), devedores = new Set(todasParc().filter(x => x.st == 'Atrasada').map(x => x.c.id));
  const l = S.c.map(c => { const vs = S.v.filter(v => v.cliente_id == c.id); return { c, n: vs.length, ult: vs.length ? vs.map(v => v.data).sort().pop() : null, tot: sum(vs, v => v.total) }; })
    .filter(x => x.ult && diasDesde(x.ult) >= 60 && !devedores.has(x.c.id) && !(rea[x.c.id] && diasDesde(rea[x.c.id]) < 30))
    .sort((a, b) => b.tot - a.tot).slice(0, 5);
  return `<div class="card"><h2 class="up">💜 Clientes para reativar</h2><small>Sem comprar há 60 dias ou mais (sem parcelas atrasadas)</small>
  ${l.map(x => `<div class="item" style="cursor:default"><span><b>${esc(x.c.nome)}</b><small class="blk">última compra há ${diasDesde(x.ult)} dias · ${R(x.tot)} em compras</small></span><button class="btn" onclick="reativar('${x.c.id}')">WhatsApp</button></div>`).join('') || '<p class="mut">Ninguém para reativar agora. 🎉</p>'}</div>`;
}
function reativar(id) {
  const c = S.c.find(x => x.id == id); if (!c) return;
  if (!c.telefone) return toast('Cadastre o WhatsApp deste cliente primeiro');
  const txt = `Olá, ${c.nome}! Tudo bem? 😊\n\nFaz um tempinho que não nos vemos aqui na Rozivaldo Store e senti sua falta! Chegaram novidades que combinam com você. Quer dar uma olhada?\n\nConfira nosso catálogo: ${LINK()}\n\nQualquer coisa é só chamar! 💜`;
  window.open(zapLink(c, txt), '_blank');
  const r = reaLer(); r[id] = new Date().toISOString();
  try { localStorage.setItem('rs_rea', JSON.stringify(r)); } catch (e) {}
  render(); toast('Mensagem aberta no WhatsApp');
}
/* ===== VENDA COM FOTO DO PRODUTO ===== */
let VP = { q: '', cat: 'Todos' };
const vitrineVenda = () => S.pr.length ? `<div class="card"><small>📸 Toque na foto para adicionar (toque de novo para somar mais um)</small>
  <input class="inp" id="vpq" placeholder="Buscar produto ou código SKU" oninput="VP.q=this.value;vpDesenha()" onkeydown="if(event.key=='Enter')event.preventDefault()">
  <div class="fchips" id="vpc"></div><div class="vpg" id="vpg"></div></div>` : '';
function vpBadges() {
  const g = $('#vpg'); if (!g) return;
  const m = {};
  document.querySelectorAll('#its .it').forEach(r => { const id = r.querySelector('select').value; if (id) m[id] = (m[id] || 0) + (+r.querySelector('[name=quantidade]').value || 0); });
  g.querySelectorAll('.vpt').forEach(t => { const q = m[t.dataset.pid] || 0, b = t.querySelector('.vpb'), n = t.querySelector('.vpm'); t.classList.toggle('on', q > 0); b.textContent = '×' + q; b.hidden = !q; n.hidden = !q; });
}
function vpDesenha() {
  const c = $('#vpc'), g = $('#vpg'); if (!c || !g) return;
  const cats = ['Todos', ...CATS.filter(k => S.pr.some(p => p.categoria == k))], q = nz(VP.q);
  c.innerHTML = cats.map(k => `<button type="button" class="vpcat ${VP.cat == k ? 'on' : ''}" onclick="VP.cat='${k}';vpDesenha()">${k}</button>`).join('');
  const l = S.pr.filter(p => (VP.cat == 'Todos' || p.categoria == VP.cat) && (!q || nz(p.nome + ' ' + skuDe(p)).includes(q)));
  g.innerHTML = l.map(p => `<div class="vpt" data-pid="${p.id}" onclick="vpAdd('${p.id}')">${imgProd(p)}<b class="pn">${esc(p.nome)}</b><b class="pp">${R(p.preco)}</b><span class="vpb" hidden></span><button type="button" class="vpm" hidden onclick="event.stopPropagation();vpMenos('${p.id}')">−</button></div>`).join('') || '<small>Nenhum produto encontrado.</small>';
  vpBadges();
}
let vpUlt = { id: '', t: 0 };
function vpAdd(pid) {
  const p = S.pr.find(x => x.id == pid); if (!p) return;
  if (vpUlt.id == pid && Date.now() - vpUlt.t < 150) return;
  vpUlt = { id: pid, t: Date.now() };
  const rows = [...document.querySelectorAll('#its .it')], ex = rows.find(r => r.querySelector('select').value == pid);
  if (ex) { const q = ex.querySelector('[name=quantidade]'); q.value = (+q.value || 0) + 1; }
  else {
    let r = rows.length == 1 && !rows[0].querySelector('[name=produto]').value && !rows[0].querySelector('[name=preco]').value ? rows[0] : null;
    if (!r) { addItem(); r = $('#its').lastElementChild; }
    const sel = r.querySelector('select'); sel.value = pid; pick(sel);
  }
  calc();
}
function vpMenos(pid) {
  const r = [...document.querySelectorAll('#its .it')].find(x => x.querySelector('select').value == pid); if (!r) return;
  const q = r.querySelector('[name=quantidade]'), n = (+q.value || 1) - 1;
  if (n > 0) q.value = n; else { r.remove(); if (!document.querySelector('#its .it')) addItem(); }
  calc();
}
/* ===== LUCRO REAL ===== */
const custoDe = t => {
  if (t.custo_unit != null) return Number(t.custo_unit);
  const p = S.pr.find(x => nz(x.nome) == nz(t.produto));
  return p && p.custo != null ? Number(p.custo) : null;
};
const lucroItem = t => { const c = custoDe(t); return c == null ? null : t.quantidade * (Number(t.preco_unit) - c); };
function lucroDe(itens) {
  let lucro = 0, base = 0, total = 0;
  (itens || []).forEach(t => { const v = t.quantidade * t.preco_unit; total += v; const x = lucroItem(t); if (x != null) { lucro += x; base += v; } });
  return { lucro, base, total, custo: base - lucro, cobertura: total ? base / total : 1, margem: base ? lucro / base : 0 };
}
const pct = v => (v * 100).toFixed(0).replace('.', ',') + '%';
function lucroPorCat(its) { return CATS.map(k => [k, lucroDe(its.filter(t => t.categoria == k))]).filter(([, l]) => l.total > 0).sort((a, b) => b[1].lucro - a[1].lucro); }
function lucroPorProd(its, n) {
  const o = {};
  its.forEach(t => { const x = lucroItem(t); if (x != null) { o[t.produto] = o[t.produto] || { l: 0, q: 0 }; o[t.produto].l += x; o[t.produto].q += t.quantidade; } });
  return Object.entries(o).sort((a, b) => b[1].l - a[1].l).slice(0, n);
}
const avisoCusto = L => L.total > 0 && L.cobertura < 0.999 ? `<small class="blk">Lucro calculado sobre ${pct(L.cobertura)} das vendas (as demais não têm custo). <button class="lnk" onclick="go('catalogo')">Informar custo dos produtos</button></small>` : '';
function lucroPainel(its) {
  const L = lucroDe(its), pc = lucroPorCat(its), tp = lucroPorProd(its, 5);
  return `<div class="two"><div class="card"><h2>Lucro por categoria</h2><small>Todas as vendas · margem = lucro ÷ vendido</small>
  ${pc.map(([k, l]) => `<div class="row" style="margin-top:8px"><span>${IC[k]} ${k}<small class="blk">margem ${pct(l.margem)}</small></span><b class="${l.lucro >= 0 ? 'grn' : 'red'}">${l.base ? R(l.lucro) : '—'}</b></div>`).join('') || '<small class="blk">Sem vendas ainda.</small>'}
  ${avisoCusto(L)}</div>
  <div class="card"><h2>Produtos mais lucrativos</h2>${tp.map(([n, o]) => `<div class="row"><small>${esc(n)}</small><b class="grn">${R(o.l)}</b></div>`).join('') || '<small>Informe o preço de custo nos produtos para ver o lucro.</small>'}</div></div>`;
}
function lucroRel(vs) {
  const its = vs.flatMap(v => v.itens_venda || []), L = lucroDe(its), pc = lucroPorCat(its), tp = lucroPorProd(its, 8);
  const cts = F.cli ? [] : S.ct.filter(x => (!F.de || x.vencimento >= F.de) && (!F.ate || x.vencimento <= F.ate));
  const cc = sum(cts.filter(x => x.tipo == 'cartao'), x => x.valor), cv = sum(cts.filter(x => x.tipo != 'cartao'), x => x.valor);
  return `<div class="grid"><div class="card"><small>Lucro bruto no período</small><b class="blk ${L.lucro >= 0 ? 'grn' : 'red'}">${R(L.lucro)}</b></div>
  <div class="card"><small>Margem de lucro</small><b class="blk">${pct(L.margem)}</b></div></div>${avisoCusto(L)}
  <h2>Lucro por categoria</h2>${pc.map(([k, l]) => `<div class="card row"><span>${IC[k]} ${k}<small class="blk">vendido ${R(l.total)} · margem ${pct(l.margem)}</small></span><b class="${l.lucro >= 0 ? 'grn' : 'red'}">${l.base ? R(l.lucro) : '—'}</b></div>`).join('') || '<p class="mut">Sem vendas neste filtro.</p>'}
  <h2>Produtos mais lucrativos</h2>${tp.map(([n, o]) => `<div class="card row"><span>${esc(n)}<small class="blk">${o.q} un.</small></span><b class="grn">${R(o.l)}</b></div>`).join('') || '<p class="mut">Informe o custo dos produtos para ver o lucro.</p>'}
  ${F.cli ? '' : `<h2>Lucro × contas do período</h2><div class="card"><div class="row"><span>Contas a pagar no período<small class="blk">Cartão ${R(cc)} · À vista ${R(cv)}</small></span><b class="red">${R(cc + cv)}</b></div>
  <div class="row" style="margin-top:8px"><span>Lucro bruto − contas</span><b class="${L.lucro - cc - cv >= 0 ? 'grn' : 'red'}">${R(L.lucro - cc - cv)}</b></div>
  <small class="blk">As contas incluem compras de estoque, que já estão no custo dos produtos vendidos. Use como visão de fôlego do caixa.</small></div>`}`;
}
const lucroTag = v => { const l = lucroDe(v.itens_venda || []); return l.base ? `<small class="blk ${l.lucro >= 0 ? 'grn' : 'red'}">Lucro: ${R(l.lucro)}</small>` : ''; };
/* ===== FLUXO DE CAIXA PROJETADO ===== */
let FX = { n: 6 };
const kf = v => Math.abs(v) >= 1000 ? (v / 1000).toFixed(1).replace('.', ',') + 'k' : String(Math.round(v));
const caixaLer = () => { try { return +localStorage.getItem('rs_caixa') || 0; } catch (e) { return 0; } };
function caixaGrava(v) { try { localStorage.setItem('rs_caixa', String(+v || 0)); } catch (e) {} render(); }
function fluxoDados(n) {
  const b = new Date(), meses = [...Array(n)].map((_, i) => { const d = new Date(b.getFullYear(), b.getMonth() + i, 1); return { k: mes(d), d, ent: 0, sai: 0, atr: 0 }; });
  const cur = meses[0].k, idx = k => k < cur ? 0 : meses.findIndex(m => m.k == k);
  todasParc().filter(x => x.falta > 0.005).forEach(x => { const k = x.vencimento.slice(0, 7), i = idx(k); if (i >= 0) { meses[i].ent += x.falta; if (k < cur) meses[i].atr += x.falta; } });
  S.ct.filter(x => !x.pago).forEach(x => { const k = x.vencimento.slice(0, 7), i = idx(k); if (i >= 0) { meses[i].sai += Number(x.valor); if (k < cur) meses[i].atrs = (meses[i].atrs || 0) + Number(x.valor); } });
  const caixa0 = caixaLer(); let ac = caixa0;
  meses.forEach(m => { m.saldo = m.ent - m.sai; ac += m.saldo; m.ac = ac; });
  return { meses, caixa0 };
}
const mesLong = d => d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
function fluxoSvg(meses) {
  const W = 640, H = 250, pl = 8, pt = 24, pb = 28, sl = (W - pl * 2) / meses.length;
  const hi = Math.max(1, ...meses.flatMap(m => [m.ent, m.sai, m.ac])), lo = Math.min(0, ...meses.map(m => m.ac));
  const y = v => pt + (hi - v) / (hi - lo) * (H - pt - pb), z = y(0);
  const bar = (x, v, c) => v > 0.005 ? `<rect x="${x.toFixed(1)}" y="${y(v).toFixed(1)}" width="${(sl * 0.28).toFixed(1)}" height="${(z - y(v)).toFixed(1)}" rx="3" fill="${c}"/><text x="${(x + sl * 0.14).toFixed(1)}" y="${(y(v) - 4).toFixed(1)}" text-anchor="middle" font-size="9" fill="#8d9bb5">${kf(v)}</text>` : '';
  const pts = meses.map((m, i) => `${(pl + i * sl + sl / 2).toFixed(1)},${y(m.ac).toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto" role="img" aria-label="Fluxo de caixa projetado">
  <line x1="${pl}" x2="${W - pl}" y1="${z.toFixed(1)}" y2="${z.toFixed(1)}" stroke="#334155" stroke-width="1"/>
  ${meses.map((m, i) => { const x0 = pl + i * sl; return bar(x0 + sl * 0.17, m.ent, '#22c55e') + bar(x0 + sl * 0.55, m.sai, '#ef4444') + `<text x="${(x0 + sl / 2).toFixed(1)}" y="${H - 8}" text-anchor="middle" font-size="11" fill="#8d9bb5">${m.d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</text>`; }).join('')}
  <polyline points="${pts}" fill="none" stroke="#eab308" stroke-width="2.2" stroke-linejoin="round"/>
  ${meses.map((m, i) => `<circle cx="${(pl + i * sl + sl / 2).toFixed(1)}" cy="${y(m.ac).toFixed(1)}" r="3.4" fill="${m.ac < -0.005 ? '#ef4444' : '#eab308'}"/>`).join('')}</svg>`;
}
function fluxo() {
  const { meses, caixa0 } = fluxoDados(FX.n), neg = meses.find(m => m.ac < -0.005);
  return `<div class="row"><h1>Fluxo de caixa</h1><span>${[3, 6, 12].map(n => `<button class="btn ${FX.n == n ? '' : 'alt'}" onclick="FX.n=${n};render()">${n} meses</button>`).join(' ')}</span></div>
  ${neg ? `<div class="card" style="border-color:#7f1d1d;background:#1d1417"><b class="red">⚠️ Atenção: em ${mesLong(neg.d)} o caixa projetado fica negativo (${R(neg.ac)}).</b><small class="blk">Cobrar as parcelas atrasadas ou combinar prazo nas contas ajuda a fechar esse buraco.</small><button class="btn" style="margin-top:8px" onclick="go('cobranca')">Cobrar atrasados</button></div>`
    : `<div class="card" style="border-color:#14532d"><b class="grn">✅ Sem aperto previsto nos próximos ${FX.n} meses.</b></div>`}
  <div class="card"><div class="row"><small><span style="color:#22c55e">■</span> A receber &nbsp;<span style="color:#ef4444">■</span> A pagar &nbsp;<span style="color:#eab308">●</span> Sobra acumulada</small></div>${fluxoSvg(meses)}</div>
  <label><small>Saldo em caixa hoje (opcional, fica salvo neste aparelho)</small><input class="inp" type="number" step="0.01" inputmode="decimal" value="${caixa0 || ''}" placeholder="0,00" onchange="caixaGrava(this.value)"></label>
  ${meses.map(m => `<div class="card"><div class="row"><b style="text-transform:capitalize">${mesLong(m.d)}</b>${m.ac < -0.005 ? '<em class="tag bad">Vai faltar</em>' : m.saldo < -0.005 ? '<em class="tag wait">Mês apertado</em>' : '<em class="tag ok">Tranquilo</em>'}</div>
  <div class="fxg"><div><small>A receber</small><b class="blk grn">${R(m.ent)}</b></div><div><small>A pagar</small><b class="blk red">${R(m.sai)}</b></div>
  <div><small>Saldo do mês</small><b class="blk ${m.saldo >= 0 ? 'grn' : 'red'}">${R(m.saldo)}</b></div><div><small>Acumulado</small><b class="blk ${m.ac >= 0 ? '' : 'red'}">${R(m.ac)}</b></div></div>
  ${m.atr > 0.005 ? `<small class="blk">Inclui ${R(m.atr)} de parcelas atrasadas a receber.</small>` : ''}${m.atrs ? `<small class="blk">Inclui ${R(m.atrs)} de contas atrasadas a pagar.</small>` : ''}</div>`).join('')}
  <small class="blk">A receber considera só as parcelas já cadastradas (vendas a prazo); novas vendas ainda não entram na projeção.</small>`;
}
/* ===== PAINEL HOJE + COBRANÇA EM FILA ===== */
function hojeItens() {
  const pcs = todasParc().filter(x => x.falta > 0.005), atr = pcs.filter(x => x.vencimento < HOJE), hj = pcs.filter(x => x.vencimento == HOJE);
  const lim = dia2(new Date(Date.now() + 7 * 864e5)), ct = S.ct.filter(x => !x.pago && x.vencimento <= lim), ent = S.v.filter(v => v.entregue === false);
  const ap = fluxoDados(3).meses.find(m => m.ac < -0.005);
  const it = [
    sgNovas().length && ['🔎', 'Clientes procurando produtos que você não tem', `${sgNovas().length} novos · ${sgResumo()}`, "go('procuras')", 'warn'],
    atr.length && ['🔴', 'Parcelas atrasadas', `${atr.length} · ${R(sum(atr, x => x.falta))}`, "COB.f='atrasadas';go('cobranca')", 'bad'],
    hj.length && ['📅', 'Vencem hoje', `${hj.length} · ${R(sum(hj, x => x.falta))}`, "COB.f='hoje';go('cobranca')", 'warn'],
    ent.length && ['🚚', 'Entregas pendentes', String(ent.length), "H.st='Entrega pendente';go('historico')", ''],
    S.pd.length && ['🛒', 'Pedidos novos do catálogo', String(S.pd.length), "go('pedidos')", 'warn'],
    ct.length && ['💸', 'Contas a pagar (vencidas ou em 7 dias)', `${ct.length} · ${R(sum(ct, x => x.valor))}`, "go('contas')", ''],
    ap && ['⚠️', 'Caixa apertado em ' + ap.d.toLocaleDateString('pt-BR', { month: 'long' }), R(ap.ac), "go('fluxo')", 'bad']
  ].filter(Boolean);
  return it;
}
function hojePainel() {
  const it = hojeItens();
  return `<div class="card"><h2 class="up">Hoje · ${new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
  ${it.length ? `<div class="hoje">${it.map(([i, t, v, a, c]) => `<button class="hj ${c}" onclick="${a}"><span class="em">${i}</span><span><small>${t}</small><b>${v}</b></span></button>`).join('')}</div>` : '<small class="grn">Tudo em dia por aqui. ✅</small>'}</div>`;
}
let COB = { f: 'atrasadas' };
const cobLer = () => { try { const o = JSON.parse(localStorage.getItem('rs_cob') || '{}'); return o.d == HOJE ? o.ids || [] : []; } catch (e) { return []; } };
const cobGrava = ids => { try { localStorage.setItem('rs_cob', JSON.stringify({ d: HOJE, ids })); } catch (e) {} };
function cobGrupos() {
  const sem = dia2(new Date(Date.now() + 7 * 864e5)), g = {};
  const ok = x => COB.f == 'hoje' ? x.vencimento == HOJE : COB.f == 'semana' ? x.vencimento <= sem : x.vencimento < HOJE;
  todasParc().filter(x => x.falta > 0.005 && ok(x)).forEach(x => (g[x.c.id] = g[x.c.id] || { c: x.c, l: [] }).l.push(x));
  return Object.values(g).map(o => ({ ...o, l: o.l.sort((a, b) => a.vencimento < b.vencimento ? -1 : 1), tot: sum(o.l, x => x.falta) })).sort((a, b) => a.l[0].vencimento.localeCompare(b.l[0].vencimento) || b.tot - a.tot);
}
function msgCob(c, l) {
  const atr = l.some(x => x.vencimento < HOJE);
  return `Olá, ${c.nome}! Tudo bem? 😊\n\nPassando para lembrar ${l.length == 1 ? 'da parcela' : 'das parcelas'} ${atr ? 'em atraso' : 'com vencimento'} na Rozivaldo Store:\n` + l.map(x => `• ${x.numero}ª parcela — ${dt(x.vencimento)} — ${R(x.falta)}`).join('\n') + `\n\n*Total: ${R(sum(l, x => x.falta))}*\n\nSe já pagou, é só me avisar! Qualquer dúvida estou à disposição. 💜`;
}
function cobCard(g) {
  const id = g.c.id, env = cobLer().includes(id);
  return `<div class="card cob ${env ? 'ok' : ''}" id="cb-${id}"><div class="row"><b>${esc(g.c.nome)}</b><b class="${g.l.some(x => x.vencimento < HOJE) ? 'red' : ''}">${R(g.tot)}</b></div>
  <small class="blk">${g.l.map(x => `${x.numero}ª · ${dt(x.vencimento)} · ${R(x.falta)}`).join(' | ')}</small>
  ${g.c.telefone ? `<details><summary class="lnk">Ver / editar mensagem</summary><textarea class="inp" id="mc-${id}" rows="8">${esc(msgCob(g.c, g.l))}</textarea></details>
  <div class="row"><button class="btn ${env ? 'alt' : ''}" onclick="cobEnviar('${id}')">${env ? '✓ Enviado · enviar de novo' : 'Enviar no WhatsApp'}</button>${env ? `<button class="lnk" onclick="cobDesfaz('${id}')">Desfazer</button>` : ''}</div>`
    : `<div class="row"><small>Sem WhatsApp cadastrado</small><button class="btn alt" onclick="formCliente('${id}')">Cadastrar número</button></div>`}</div>`;
}
function cobResumoTxt() { const g = cobGrupos(), e = cobLer(); return `${g.length} ${g.length == 1 ? 'cliente' : 'clientes'} · ${R(sum(g, x => x.tot))} · ${g.filter(x => e.includes(x.c.id)).length} já cobrados hoje`; }
function cobRefaz(id) { const g = cobGrupos().find(x => x.c.id == id), el = document.getElementById('cb-' + id); if (g && el) el.outerHTML = cobCard(g); const r = $('#cobres'); if (r) r.textContent = cobResumoTxt(); }
function cobEnviar(id) {
  const g = cobGrupos().find(x => x.c.id == id); if (!g) return;
  const ta = document.getElementById('mc-' + id), txt = ta ? ta.value : msgCob(g.c, g.l);
  window.open(zapLink(g.c, txt), '_blank');
  const ids = cobLer(); if (!ids.includes(id)) cobGrava([...ids, id]);
  cobRefaz(id);
}
function cobDesfaz(id) { cobGrava(cobLer().filter(x => x != id)); cobRefaz(id); }
function cobranca() {
  return `<h1>Cobrar clientes</h1>
  <div class="row" style="justify-content:flex-start">${[['atrasadas', 'Atrasadas'], ['hoje', 'Vencem hoje'], ['semana', 'Até 7 dias']].map(([k, l]) => `<button class="btn ${COB.f == k ? '' : 'alt'}" onclick="COB.f='${k}';render()">${l}</button>`).join('')}</div>
  <p class="mut" id="cobres">${cobResumoTxt()}</p>
  <small class="blk">A mensagem já vem pronta: toque em "Enviar no WhatsApp", confirme o envio lá e volte para o próximo cliente.</small>
  <div id="cobl">${cobGrupos().map(cobCard).join('') || '<p class="mut">Ninguém para cobrar neste filtro. 🎉</p>'}</div>`;
}
async function excluiPag(id) {
  const p = S.p.find(x => x.id == id); if (!p) return;
  const aviso = p.venda_id ? '\n\nObs.: esse valor foi pago na própria venda. O saldo do cliente vai aumentar; se precisar, ajuste as parcelas em Editar venda.' : '';
  if (!confirm('Excluir o recebimento de ' + R(p.valor) + ' de ' + (S.c.find(c => c.id == p.cliente_id) || {}).nome + '? Ele sai do caixa. Não dá para desfazer.' + aviso)) return;
  const { error } = await db.from('pagamentos').delete().eq('id', id);
  if (error) return toast('Erro: ' + error.message);
  fecha(); await load(); render(); toast('Recebimento excluído');
}
/* ===== RECEBIMENTOS: vínculo com a venda e edição ===== */
function vendasAbertas(cid) {
  const pa = parc(cid);
  return S.v.filter(v => v.cliente_id == cid).map(v => ({ v, falta: sum(pa.filter(x => x.venda_id == v.id), x => x.falta) })).filter(o => o.falta > 0.005);
}
const rotVenda = (v, falta) => new Date(v.data).toLocaleDateString('pt-BR') + ' · ' + R(v.total) + (falta != null ? ' · falta ' + R(falta) : '');
function editaPag(id) {
  const p = S.p.find(x => x.id == id); if (!p) return;
  if (p.venda_id) { toast('Esse valor foi pago na própria venda: altere aqui em Editar venda'); return go('venda', p.cliente_id, p.venda_id); }
  const vs = S.v.filter(v => v.cliente_id == p.cliente_id), fs = [...new Set([...FORMAS, p.forma].filter(Boolean))];
  modal(`<h2>Editar recebimento</h2><p class="mut">${cn(p.cliente_id)}</p><form onsubmit="salvaEdPag(event,'${id}')">
  <input class="inp" name="valor" type="number" step="0.01" min="0.01" inputmode="decimal" value="${Number(p.valor).toFixed(2)}" required>
  <select class="inp" name="forma">${fs.map(f => `<option ${f == p.forma ? 'selected' : ''}>${esc(f)}</option>`).join('')}</select>
  <label><small>Data do recebimento</small><input class="inp" type="date" name="data" value="${dia2(new Date(p.criado_em))}" required></label>
  <label><small>Referente a qual venda?</small><select class="inp" name="ref"><option value="">Automático (parcelas mais antigas)</option>${vs.map(v => `<option value="${v.id}" ${v.id == p.ref_venda_id ? 'selected' : ''}>${rotVenda(v)}</option>`).join('')}</select></label>
  <button class="btn w">Salvar recebimento</button>
  <button type="button" class="btn alt w red" style="margin-top:8px" onclick="excluiPag('${id}')">Excluir recebimento</button></form>`);
}
async function salvaEdPag(e, id) {
  e.preventDefault();
  const f = e.target, p = S.p.find(x => x.id == id), d = { valor: +f.valor.value, forma: f.forma.value, ref_venda_id: f.ref.value || null };
  if (f.data.value != dia2(new Date(p.criado_em))) d.criado_em = new Date(f.data.value + 'T12:00:00').toISOString();
  const { error } = await db.from('pagamentos').update(d).eq('id', id);
  if (error) return toast('Erro: ' + error.message);
  fecha(); await load(); render(); toast('Recebimento atualizado');
}
async function excluiVenda(id) {
  const v = S.v.find(x => x.id == id); if (!v) return;
  if (!confirm('Excluir esta venda de ' + R(v.total) + '? Os itens, as parcelas e os pagamentos dela também serão apagados. Não dá para desfazer.')) return;
  const { error } = await db.from('vendas').delete().eq('id', id);
  if (error) return toast('Erro: ' + error.message);
  EDIT = null; await load();
  const sobra = S.p.filter(p => p.cliente_id == v.cliente_id && !p.venda_id && !p.ref_venda_id);
  if (!S.v.some(x => x.cliente_id == v.cliente_id) && sobra.length && confirm('Este cliente não tem mais nenhuma venda, mas ainda tem ' + R(sum(sobra, p => p.valor)) + ' em recebimentos avulsos registrados.\n\nApagar esses recebimentos também? (eles saem do caixa)')) {
    await db.from('pagamentos').delete().in('id', sobra.map(p => p.id)); await load();
  }
  if (cur == 'venda') go('ficha', v.cliente_id); else render();
  toast('Venda excluída');
}
let EDIT = null, PKEY = '', PDATES = [];
const planoForm = (f, resto, n) => plano(resto, n, f.venc.value).map((x, k) => ({ ...x, vencimento: PKEY == f.venc.value + '|' + n && PDATES[k] ? PDATES[k] : x.vencimento }));
function carregaEdicao() {
  const v = S.v.find(x => x.id == EDIT);
  if (!v) { EDIT = null; return go('inicio'); }
  const f = $('#view form');
  (v.itens_venda || []).forEach(t => { addItem(); fillRow($('#its').lastElementChild, { produto: t.produto, categoria: t.categoria, qtd: t.quantidade, preco: t.preco_unit, custo: t.custo_unit }); });
  const pgs = S.p.filter(p => p.venda_id == v.id), pa = S.pa.filter(x => x.venda_id == v.id).sort((a, b) => a.numero - b.numero);
  f.pago.value = pgs.length ? sum(pgs, p => p.valor).toFixed(2) : '';
  if (pgs[0] && pgs[0].forma) f.forma.value = pgs[0].forma;
  f.pend.checked = v.entregue === false;
  if (pa.length) { f.np.value = pa.length; f.venc.value = pa[0].vencimento; PKEY = pa[0].vencimento + '|' + pa.length; PDATES = pa.map(x => x.vencimento); }
  calc();
}
async function salvaEdicao(f, itens, total, pago) {
  const id = EDIT, v = S.v.find(x => x.id == id), cid = v.cliente_id, antigos = v.itens_venda || [];
  let r = await db.from('vendas').update({ total, entregue: !f.pend.checked }).eq('id', id);
  if (r.error) return toast('Erro: ' + r.error.message);
  r = await db.from('itens_venda').delete().eq('venda_id', id);
  if (r.error) return toast('Erro: ' + r.error.message);
  r = await db.from('itens_venda').insert(itens.map(x => ({ ...x, venda_id: id })));
  if (r.error) { await db.from('itens_venda').insert(antigos); return toast('Erro: ' + r.error.message); }
  const pgs = S.p.filter(p => p.venda_id == id);
  if (Math.abs(sum(pgs, p => p.valor) - pago) > 0.005) {
    await db.from('pagamentos').delete().eq('venda_id', id);
    if (pago > 0) await db.from('pagamentos').insert({ cliente_id: cid, venda_id: id, valor: pago, forma: f.forma.value, ...(pgs[0] ? { criado_em: pgs[0].criado_em } : {}) });
  }
  await db.from('parcelas').delete().eq('venda_id', id);
  const resto = total - pago;
  if (resto > 0.005) {
    const n = Math.max(1, Math.min(24, +f.np.value || 1));
    r = await db.from('parcelas').insert(planoForm(f, resto, n).map(x => ({ ...x, venda_id: id, cliente_id: cid })));
    if (r.error) toast('Erro nas parcelas: ' + r.error.message);
  }
  EDIT = null; await load(); go('ficha', cid); toast('Venda atualizada');
}
function editaParc(id) {
  const x = S.pa.find(p => p.id == id); if (!x) return;
  modal(`<h2>Alterar vencimento</h2><p class="mut">${x.numero}ª parcela · ${R(x.valor)}<br>Vencimento atual: ${dt(x.vencimento)}</p>
  <form onsubmit="salvaParc(event,'${id}')"><input class="inp" type="date" name="d" value="${x.vencimento}" required><button class="btn w">Salvar nova data</button></form>`);
}
async function salvaParc(e, id) {
  e.preventDefault();
  const { error } = await db.from('parcelas').update({ vencimento: e.target.d.value }).eq('id', id);
  if (error) return toast('Erro: ' + error.message);
  fecha(); await load(); render(); toast('Vencimento alterado');
}

const skuDe = p => p.sku || 'RS' + String(p.id).replace(/-/g, '').slice(0, 8).toUpperCase();
const skuNovo = cat => String(cat || 'RS').slice(0, 2).toUpperCase() + String(Date.now()).slice(-8);
const MICBAR = `<svg viewBox="0 0 70 40" fill="none" stroke-width="2.6" stroke-linecap="round"><g stroke="#a855f7"><path d="M4 16v8M10 11v18M16 15v10"/></g><g stroke="#ec4899"><rect x="29" y="5" width="12" height="20" rx="6"/><path d="M24 20a11 11 0 0 0 22 0M35 31v5"/></g><g stroke="#a855f7"><path d="M54 15v10M60 11v18M66 16v8"/></g></svg>`;
function saudacao(sub) {
  return `<div class="hello"><div><h1>Olá, Rozivaldo!</h1><p class="mut">${sub}</p></div>
  <button class="audio" onclick="audio()">${MICBAR}<span><b>Venda por Áudio</b><small>Toque e Fale: "Venda para..."</small></span></button></div>`;
}
const imgProd = p => p.foto ? `<img src="${p.foto}" alt="">` : '<div class="pimg">🛍️</div>';
const cardProd = p => `<div class="pc">${imgProd(p)}<b class="pn">${esc(p.nome)}</b><b class="pp">${R(p.preco)}</b><small>SKU: ${esc(skuDe(p))}</small><button class="vend" onclick="vender('${p.id}')">VENDER <span>+</span></button></div>`;
const cardMini = p => `<div class="mini">${imgProd(p)}<div class="grow"><b class="pn">${esc(p.nome)}</b><b class="pp blk">${R(p.preco)}</b><button class="vend" onclick="vender('${p.id}')">VENDER <span>+</span></button></div></div>`;

function inicio() {
  return `${saudacao('Bem-vindo ao seu Dashboard.')}
  ${hojePainel()}
  <div class="card"><h2>Sua Vitrine de Produtos - Clique para vender</h2>
  ${S.pr.length ? `<div class="car"><button class="arw l" onclick="rola(-1)">‹</button><div id="vit">${S.pr.map(cardProd).join('')}</div><button class="arw r" onclick="rola(1)">›</button></div><div id="dots"></div>`
      : '<p class="mut">Nenhum produto cadastrado ainda. <button class="lnk" onclick="go(\'catalogo\');formProd()">Cadastrar o primeiro produto</button></p>'}</div>
  ${maisVendidos()}
  <div class="dois">${ultimasVendas()}${clientesReativar()}</div>`;
}
function rola(d) { const v = $('#vit'); v.scrollBy({ left: d * v.clientWidth * 0.9, behavior: 'smooth' }); }
function vitPag(k) { const v = $('#vit'); v.scrollTo({ left: k * v.clientWidth, behavior: 'smooth' }); }
function vitInit() {
  const v = $('#vit'), dd = $('#dots'); if (!v || !dd) return;
  const draw = () => {
    const n = Math.max(1, Math.ceil(v.scrollWidth / v.clientWidth - 0.05));
    const fim = v.scrollLeft + v.clientWidth >= v.scrollWidth - 2;
    const i = fim ? n - 1 : Math.min(n - 1, Math.round(v.scrollLeft / v.clientWidth));
    dd.innerHTML = [...Array(n)].map((_, k) => `<i class="${k == i ? 'on' : ''}" onclick="vitPag(${k})"></i>`).join('');
  };
  v.onscroll = draw; draw();
}
function vender(id) {
  const p = S.pr.find(x => x.id == id); if (!p) return;
  PRE = { pedido: null, itens: [{ pid: p.id, produto: p.nome, categoria: p.categoria, qtd: 1, preco: p.preco }] };
  go('venda');
}
function audio() { AUTO = 'ouvir'; go('venda'); }
function lancar() { AUTO = 'foco'; go('venda'); }

function vitrine() {
  return `<h1>Vitrine Interativa WhatsApp</h1><p class="mut">Marque os produtos que quer destacar, escolha o cliente e envie a vitrine com o link do catálogo.</p>
  <select class="inp" id="vc"><option value="">Cliente (opcional)</option>${S.c.map(c => `<option value="${c.id}">${esc(c.nome)}</option>`).join('')}</select>
  <div class="card"><b>Produtos a destacar</b>${S.pr.map(p => `<label class="row"><span><input type="checkbox" class="vk" value="${p.id}" onchange="vtxt()"> ${esc(p.nome)}</span><small>${R(p.preco)}</small></label>`).join('') || '<p class="mut">Cadastre produtos no Catálogo primeiro.</p>'}</div>
  <textarea class="inp" id="vt" rows="9"></textarea>
  <button class="btn w" onclick="vzap()">Abrir WhatsApp</button>`;
}
function vtxt() {
  const ids = [...document.querySelectorAll('.vk:checked')].map(x => x.value), l = S.pr.filter(p => ids.includes(String(p.id)));
  $('#vt').value = 'Olá! Veja a vitrine da Rozivaldo Store 🛍️\n' + (l.length ? '\n' + l.map(p => `• ${p.nome} — ${R(p.preco)}`).join('\n') + '\n' : '') + `\nCatálogo completo: ${LINK()}\n\nPara comprar é só me chamar! 💜`;
}
function vzap() {
  const c = S.c.find(x => x.id == $('#vc').value), t = encodeURIComponent($('#vt').value);
  window.open(c && c.telefone ? `https://wa.me/${fone(c.telefone)}?text=${t}` : `https://wa.me/?text=${t}`, '_blank');
}

function dash() {
  const m = mes(new Date()), at = todasParc().filter(x => x.st == 'Atrasada').sort((a, b) => a.vencimento < b.vencimento ? -1 : 1);
  const tv = sum(S.v, v => v.total), rec = sum(S.p, p => p.valor), vm = sum(S.v.filter(v => mes(v.data) == m), v => v.total);
  const ms = [...Array(7)].map((_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 6 + i); return { k: mes(d), l: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '') }; });
  const vals = ms.map(x => sum(S.v.filter(v => mes(v.data) == x.k), v => v.total)), mx = Math.max(...vals, 1);
  const its = S.v.flatMap(v => v.itens_venda), nq = sum(its, i => i.quantidade) || 1;
  const LM = lucroDe(S.v.filter(v => mes(v.data) == m).flatMap(v => v.itens_venda || []));
  const top = Object.entries(its.reduce((o, t) => (o[t.produto] = (o[t.produto] || 0) + t.quantidade, o), {})).sort((a, b) => b[1] - a[1]).slice(0, 5);
  return `${saudacao('Bem-vindo ao seu Dashboard.')}
  <div class="kpis">
    <div class="card kpi"><small>VENDAS TOTAIS</small><b>${R(tv)}</b><small class="grn">${R(vm)} neste mês</small></div>
    <div class="card kpi"><small>PEDIDOS</small><b>${S.v.length}</b></div>
    <div class="card kpi"><small>CLIENTES</small><b>${S.c.length}</b></div>
    <div class="card kpi"><small>VALOR A RECEBER</small><b>${R(tv - rec)}</b></div>
    <div class="card kpi bad"><small>PARCELAS ATRASADAS</small><b>${at.length}</b><small>${R(sum(at, x => x.falta))}</small></div>
    <div class="card kpi"><small>ENTREGA PENDENTE</small><b>${S.v.filter(v => v.entregue === false).length}</b></div>
    <div class="card kpi"><small>LUCRO NO MÊS</small><b class="${LM.lucro >= 0 ? 'grn' : 'red'}">${LM.base ? R(LM.lucro) : '—'}</b><small>${LM.base ? 'margem ' + pct(LM.margem) : 'informe o custo dos produtos'}</small></div>
  </div>
  <div class="two"><div class="card"><h2>Resumo de vendas</h2><small>Últimos 7 meses</small>
    <div class="bars">${ms.map((x, i) => `<div class="col"><span>${vals[i] ? R(vals[i]).replace('R$', '').trim() : ''}</span><div class="fill"><i style="height:${vals[i] / mx * 100}%"></i></div><span>${x.l}</span></div>`).join('')}</div></div>
  <div><div class="card"><h2>Categorias populares</h2><div class="cats">${CATS.map(k => `<div><div class="cat" style="background:${CC[k]}">${IC[k]}</div><small class="blk">${k}</small><small class="blk">${Math.round(sum(its.filter(t => t.categoria == k), t => t.quantidade) / nq * 100)}%</small></div>`).join('')}</div></div>
  <div class="card"><h2>Mais vendidos</h2>${top.map(([n, q]) => `<div class="row"><small>${esc(n)}</small><b>${q} un.</b></div>`).join('') || '<small>Sem vendas ainda.</small>'}</div></div></div>
  ${lucroPainel(its)}
  <h2>Parcelas atrasadas</h2>${at.slice(0, 8).map(parcRow).join('') || '<p class="mut">Nenhuma parcela atrasada. 🎉</p>'}
  <div class="card"><h2>Últimos pedidos</h2><div class="tw"><table><tr><th>Pedido</th><th>Data</th><th>Cliente</th><th>Valor</th><th>Status</th></tr>
  ${S.v.slice(0, 6).map((v, i) => `<tr onclick="go('ficha','${v.cliente_id}')"><td>#${String(S.v.length - i).padStart(4, '0')}</td><td>${new Date(v.data).toLocaleDateString('pt-BR')}</td><td>${esc((S.c.find(c => c.id == v.cliente_id) || {}).nome)}</td><td>${R(v.total)}</td><td>${tag(stVenda(v))}</td></tr>`).join('')}</table></div></div>`;
}

function clientes() {
  return `<div class="row"><h1>Clientes</h1><button class="btn" onclick="formCliente()">+ Novo cliente</button></div>
  <input class="inp" placeholder="Buscar por nome ou telefone" oninput="filtra(this.value)">
  <div id="lista">${lista('')}</div>`;
}
function lista(q) {
  q = q.toLowerCase();
  return S.c.filter(c => (c.nome + (c.telefone || '')).toLowerCase().includes(q)).map(c => {
    const i = info(c.id), dev = i.s > 0.005;
    return `<button class="item" onclick="go('ficha','${c.id}')"><span><b>${esc(c.nome)}</b><small class="blk">${esc(c.telefone)}</small></span><span class="${dev ? 'red' : 'grn'}">${dev ? 'Deve ' + R(i.s) : 'Em dia'}</span></button>`;
  }).join('') || '<p class="mut">Nenhum cliente encontrado.</p>';
}
function filtra(q) { $('#lista').innerHTML = lista(q); }

function formCliente(id) {
  const c = S.c.find(x => x.id == id) || {};
  modal(`<h2>${id ? 'Editar' : 'Novo'} cliente</h2><form onsubmit="salvaCliente(event,'${id || ''}')">
  <input class="inp" name="nome" placeholder="Nome" value="${esc(c.nome)}" required>
  <input class="inp" name="telefone" type="tel" placeholder="WhatsApp com DDD (ex: 84999998888)" value="${esc(c.telefone)}">
  <input class="inp" name="endereco" placeholder="Endereço" value="${esc(c.endereco)}">
  <textarea class="inp" name="observacoes" placeholder="Observações">${esc(c.observacoes)}</textarea>
  <button class="btn w">Salvar cliente</button></form>`);
}
async function salvaCliente(e, id) {
  e.preventDefault();
  const d = Object.fromEntries(new FormData(e.target));
  const r = id ? await db.from('clientes').update(d).eq('id', id).select().single() : await db.from('clientes').insert(d).select().single();
  if (r.error) return toast('Erro: ' + r.error.message);
  fecha(); await load(); toast('Cliente salvo'); go('ficha', r.data.id);
}

function ficha() {
  const c = S.c.find(x => x.id == curId);
  if (!c) return clientes();
  const i = info(c.id), dev = i.s > 0.005;
  return `<button class="mut" onclick="go('clientes')">← Clientes</button>
  <div class="row"><h1>${esc(c.nome)}</h1><span><button class="lnk" onclick="formCliente('${c.id}')">Editar</button> <button class="lnk red" onclick="del('clientes','${c.id}')">Excluir cliente</button></span></div>
  <p class="mut">${esc(c.telefone) || 'Sem WhatsApp cadastrado'}<br>${esc(c.endereco)}<br>${esc(c.observacoes)}</p>
  <div class="grid">
    <div class="card"><small>Total comprado</small><b class="blk">${R(i.t)}</b></div>
    <div class="card"><small>Total pago</small><b class="blk grn">${R(i.p)}</b></div>
    <div class="card w2"><small>Saldo devedor</small><b class="blk big ${dev ? 'red' : 'grn'}">${R(i.s)}</b></div>
  </div>
  <div class="row" style="margin-top:12px"><button class="btn" onclick="formPag('${c.id}')">Receber pagamento</button><button class="btn alt" onclick="go('venda','${c.id}')">Nova venda</button>
  ${dev && c.telefone ? `<a class="btn alt" target="_blank" href="${zapLink(c, `Olá, ${c.nome}! Seu saldo em aberto na Rozivaldo Vendas é de ${R(i.s)}. Qualquer dúvida, é só chamar!`)}">Cobrar no WhatsApp</a>` : ''}</div>
  <h2>Parcelas</h2>${parc(c.id).map(x => `<div class="card row"><b>${x.numero}ª · vence ${dt(x.vencimento)}</b><span>${R(x.valor)} ${tag(x.st)} <button class="lnk" onclick="editaParc('${x.id}')">Mudar data</button></span></div>`).join('') || '<p class="mut">Sem parcelas.</p>'}
  <h2>Compras</h2>
  ${i.vs.map(v => `<div class="card"><div class="row"><b>${D(v.data)}</b><b>${R(v.total)}</b></div>
    ${(v.itens_venda || []).map(t => `<small class="blk">${t.quantidade}× ${esc(t.produto)} (${t.categoria}) — ${R(t.preco_unit)}</small>`).join('')}
    <div class="row">${v.entregue === false ? `<button class="lnk" onclick="entregar('${v.id}')">🚚 Marcar entregue</button>` : ''}<button class="lnk" onclick="go('venda','${v.cliente_id}','${v.id}')">✏️ Editar venda</button><button class="lnk" onclick="zapVenda('${v.id}')">Enviar no WhatsApp</button><button class="lnk red" onclick="excluiVenda('${v.id}')">Excluir venda</button></div></div>`).join('') || '<p class="mut">Nenhuma compra ainda.</p>'}
  <h2>Pagamentos recebidos</h2>
  ${i.ps.map(p => `<div class="card row"><span>${D(p.criado_em)}<small class="blk">${esc(p.forma)}</small></span><b class="grn">${R(p.valor)}</b><button class="lnk" onclick="editaPag('${p.id}')">Editar</button><button class="lnk red" onclick="excluiPag('${p.id}')">Excluir</button></div>`).join('') || '<p class="mut">Nenhum pagamento ainda.</p>'}`;
}

function formPag(id) {
  const s = info(id).s;
  modal(`<h2>Receber pagamento</h2><p class="mut">Saldo atual: ${R(s)}</p>
  <form onsubmit="salvaPag(event,'${id}')">
  <input class="inp" name="valor" type="number" step="0.01" min="0.01" inputmode="decimal" placeholder="Valor recebido (R$)" required>
  <select class="inp" name="forma">${opts(FORMAS)}</select>
  <label><small>Referente a qual venda?</small><select class="inp" name="ref"><option value="">Automático (parcelas mais antigas)</option>${vendasAbertas(id).map((o, _, a) => `<option value="${o.v.id}" ${a.length == 1 ? 'selected' : ''}>${rotVenda(o.v, o.falta)}</option>`).join('')}</select></label>
  <button class="btn w">Registrar pagamento</button></form>`);
}
async function salvaPag(e, id) {
  e.preventDefault();
  const f = e.target;
  const { error } = await db.from('pagamentos').insert({ cliente_id: id, valor: +f.valor.value, forma: f.forma.value, ref_venda_id: f.ref.value || null });
  if (error) return toast('Erro: ' + error.message);
  fecha(); await load(); render(); toast('Pagamento registrado');
}

function venda() {
  return `<h1>${EDIT ? 'Editar venda' : 'Nova venda'}</h1>
  ${EDIT ? '' : `<div class="card"><small>🎤 Lançar por voz ou texto</small>
  <div class="row" style="flex-wrap:nowrap"><input class="inp" id="frase" placeholder="Ex: venda para Maria, uma camisa polo de 119,90 em 3 vezes" onkeydown="if(event.key=='Enter'){event.preventDefault();aplicaVoz(this.value)}">
  <button type="button" class="btn" onclick="ouvir()">🎤</button><button type="button" class="btn alt" onclick="aplicaVoz($('#frase').value)">Preencher</button></div>
  <small id="fb" class="blk"></small></div>`}
  <form onsubmit="salvaVenda(event)">
  <select class="inp" name="cliente_id" required ${EDIT ? 'disabled' : ''}><option value="">Escolha o cliente</option>${S.c.map(c => `<option value="${c.id}" ${c.id == curId ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}</select>
  ${vitrineVenda()}
  <div id="its"></div>
  <button type="button" class="btn alt" onclick="addItem()">+ Adicionar item</button>
  <div class="card row"><span>Total da venda</span><b id="tot">R$ 0,00</b></div>
  <input class="inp" name="pago" type="number" step="0.01" min="0" inputmode="decimal" placeholder="Valor pago agora (deixe vazio se for fiado)" oninput="calc()">
  <select class="inp" name="forma">${opts(FORMAS)}</select>
  <div class="grid"><label><small>Nº de parcelas</small><input class="inp" name="np" type="number" min="1" max="24" value="1" oninput="calc()"></label><label><small>1º vencimento (escolha o dia)</small><input class="inp" name="venc" type="date" value="${proxDia5()}" oninput="calc()" required></label></div>
  <div class="card" id="prev"></div>
  <label class="card row"><span>🚚 Entrega pendente</span><input type="checkbox" name="pend"></label>
  <button class="btn w">${EDIT ? 'Salvar alterações' : 'Registrar venda'}</button>
  ${EDIT ? `<button type="button" class="btn alt w" style="margin-top:8px" onclick="go('ficha','${curId}')">Cancelar</button><button type="button" class="btn alt w red" style="margin-top:8px" onclick="excluiVenda('${EDIT}')">Excluir esta venda</button>` : ''}</form>`;
}
function addItem() {
  const d = document.createElement('div');
  d.className = 'card it';
  d.innerHTML = `<select class="inp" onchange="pick(this)"><option value="">Item avulso (digitar nome)</option>${S.pr.map(p => `<option value="${p.id}">${esc(p.nome)} — ${R(p.preco)}</option>`).join('')}</select>
  <input class="inp" name="produto" placeholder="Nome do item" required>
  <div class="grid3"><label><small>Categoria</small><select class="inp" name="categoria">${opts(CATS)}</select></label>
  <label><small>Qtd</small><input class="inp" name="quantidade" type="number" min="1" value="1" oninput="calc()"></label>
  <label><small>Preço un. (R$)</small><input class="inp" name="preco" type="number" step="0.01" min="0" inputmode="decimal" placeholder="0,00" oninput="calc()" required></label></div>
  <label><small>Custo un. (R$, opcional: para calcular o lucro)</small><input class="inp" name="custo" type="number" step="0.01" min="0" inputmode="decimal" placeholder="0,00"></label>
  <div class="row"><button type="button" class="lnk" onclick="this.closest('.it').remove();calc()">Remover item</button><b class="sub"></b></div>`;
  $('#its').append(d);
}
function plano(resto, n, venc) {
  const base = Math.floor(resto / n * 100) / 100;
  return [...Array(n)].map((_, k) => { const d = new Date(venc + 'T12:00:00'); d.setMonth(d.getMonth() + k); return { numero: k + 1, vencimento: dia2(d), valor: k == n - 1 ? +(resto - base * (n - 1)).toFixed(2) : base }; });
}
function calc() {
  let t = 0;
  document.querySelectorAll('.it').forEach(r => { const x = r.querySelector('[name=quantidade]').value * r.querySelector('[name=preco]').value; t += x; r.querySelector('.sub').textContent = 'Subtotal ' + R(x); });
  $('#tot').textContent = R(t); vpBadges();
  const f = $('#view form');
  if (f && f.pago && $('#prev')) {
    const resto = t - (+f.pago.value || 0), n = Math.max(1, Math.min(24, +f.np.value || 1));
    if (resto > 0.005 && f.venc.value) {
      const pl = plano(resto, n, f.venc.value), key = f.venc.value + '|' + n;
      if (key != PKEY) { PKEY = key; PDATES = pl.map(x => x.vencimento); }
      $('#prev').innerHTML = `<b>${n}× de ${R(resto / n)}</b><small class="blk">Vencimento de cada parcela (toque na data para mudar o dia):</small>` + pl.map((x, k) => `<div class="row" style="margin-top:6px"><span>${x.numero}ª · ${R(x.valor)}</span><input class="inp" style="width:auto;margin:0" type="date" value="${PDATES[k]}" onchange="PDATES[${k}]=this.value"></div>`).join('');
    } else $('#prev').innerHTML = t > 0 ? '<small>Pago à vista, sem parcelas.</small>' : '';
  }
  return t;
}
let SALVANDO = false;
async function salvaVenda(e) {
  e.preventDefault();
  if (SALVANDO) return;
  SALVANDO = true;
  const b = e.target.querySelector('button:not([type=button])'), tx = b && b.textContent;
  if (b) { b.disabled = true; b.textContent = 'Salvando…'; }
  try { await salvaVendaInterna(e); }
  finally { SALVANDO = false; if (b && b.isConnected) { b.disabled = false; b.textContent = tx; } }
}
async function salvaVendaInterna(e) {
  e.preventDefault();
  const f = e.target, q = (r, n) => r.querySelector(`[name=${n}]`).value;
  const itens = [...document.querySelectorAll('.it')].map(r => ({ produto: q(r, 'produto'), categoria: q(r, 'categoria'), quantidade: +q(r, 'quantidade'), preco_unit: +q(r, 'preco'), custo_unit: q(r, 'custo') === '' ? null : +q(r, 'custo') }));
  if (!itens.length) return toast('Adicione ao menos um item');
  const total = calc(), pago = +f.pago.value || 0, cid = f.cliente_id.value;
  if (pago > total) return toast('O valor pago é maior que o total da venda');
  if (EDIT) return salvaEdicao(f, itens, total, pago);
  const rec = S.v.find(x => x.cliente_id == cid && Math.abs(x.total - total) < 0.005 && Date.now() - new Date(x.data) < 180000);
  if (rec && !confirm('Já existe uma venda de ' + R(total) + ' para este cliente registrada há poucos minutos. Registrar outra igual mesmo assim?')) return;
  const { data: v, error } = await db.from('vendas').insert({ cliente_id: cid, total, entregue: !f.pend.checked }).select().single();
  if (error) return toast('Erro: ' + error.message);
  const r1 = await db.from('itens_venda').insert(itens.map(x => ({ ...x, venda_id: v.id })));
  if (r1.error) { await db.from('vendas').delete().eq('id', v.id); return toast('Erro: ' + r1.error.message); }
  if (pago > 0) await db.from('pagamentos').insert({ cliente_id: cid, venda_id: v.id, valor: pago, forma: f.forma.value });
  const resto = total - pago;
  if (resto > 0.005) {
    const n = Math.max(1, Math.min(24, +f.np.value || 1));
    await db.from('parcelas').insert(planoForm(f, resto, n).map(x => ({ ...x, venda_id: v.id, cliente_id: cid })));
  }
  if (PEDIDO) { await db.from('pedidos').update({ status: 'convertido' }).eq('id', PEDIDO); PEDIDO = null; }
  await load(); go('ficha', cid); zapVenda(v.id);
}

const fone = t => { const d = (t || '').replace(/\D/g, ''); return d.length <= 11 ? '55' + d : d; };
const zapLink = (c, txt) => `https://wa.me/${fone(c.telefone)}?text=${encodeURIComponent(txt)}`;
function msgVenda(v, c) {
  const pago = sum(S.p.filter(p => p.venda_id == v.id), p => p.valor), pa = S.pa.filter(x => x.venda_id == v.id).sort((a, b) => a.numero - b.numero);
  return `Olá, ${c.nome}! Obrigado por realizar sua compra na Rozivaldo Store 🛍️\n\nSeus produtos são:\n` +
    v.itens_venda.map(t => `• ${t.quantidade}x ${t.produto} — ${R(t.quantidade * t.preco_unit)}`).join('\n') +
    `\n\n*Valor total: ${R(v.total)}*` + (pago > 0 ? `\nPago na compra: ${R(pago)}` : '') +
    (pa.length ? `\n\nParcelas:\n` + pa.map(x => `${x.numero}ª — ${dt(x.vencimento)} — ${R(x.valor)}`).join('\n') : '') +
    `\n\nObrigado pela preferência! 💜`;
}
function zapVenda(id) {
  const v = S.v.find(x => x.id == id), c = S.c.find(x => x.id == v.cliente_id);
  if (!c.telefone) return toast('Cadastre o WhatsApp do cliente (botão Editar) para enviar a mensagem');
  modal(`<h2>Mensagem de agradecimento</h2><small>Você pode editar o texto antes de enviar.</small>
  <textarea id="zt" class="inp" rows="13">${esc(msgVenda(v, c))}</textarea>
  <button class="btn w" onclick="zapAbrir('${c.id}')">Abrir WhatsApp de ${esc(c.nome)}</button>
  <button class="lnk" onclick="fecha()">Agora não</button>`);
}
function zapAbrir(cid) { window.open(zapLink(S.c.find(x => x.id == cid), $('#zt').value), '_blank'); fecha(); }

function pick(sel) {
  const r = sel.closest('.it'), p = S.pr.find(x => x.id == sel.value);
  r.classList.toggle('sel', !!p);
  if (!p) { r.querySelector('[name=produto]').value = ''; return calc(); }
  r.querySelector('[name=produto]').value = p.nome;
  r.querySelector('[name=categoria]').value = p.categoria;
  r.querySelector('[name=preco]').value = Number(p.preco).toFixed(2);
  r.querySelector('[name=custo]').value = p.custo != null ? Number(p.custo).toFixed(2) : '';
  calc();
}

function catalogo() {
  return `<div class="row"><h1>Catálogo</h1><button class="btn" onclick="formProd()">+ Novo produto</button></div>
  <div class="card"><small>🔗 Link da vitrine para seus clientes</small><b class="blk" style="word-break:break-all">${LINK()}</b>
  <div class="row" style="margin-top:8px"><button class="btn" onclick="copiaLink()">Copiar link</button><a class="btn alt" target="_blank" href="https://wa.me/?text=${encodeURIComponent('Veja nosso catálogo: ' + LINK())}">Enviar no WhatsApp</a></div></div>
  ${CATS.map(k => { const l = S.pr.filter(p => p.categoria == k); return l.length ? `<h2>${k}</h2>` + l.map(p => `<div class="card row">${foto(p)}<b class="grow">${esc(p.nome)}<small class="blk">SKU: ${esc(skuDe(p))}${p.custo != null && p.preco > 0 ? ` · custo ${R(p.custo)} · margem ${pct((p.preco - p.custo) / p.preco)}` : ''}</small></b><span>${R(p.preco)} <button class="lnk" onclick="formProd('${p.id}')">Editar</button> <button class="lnk" onclick="del('produtos','${p.id}')">Excluir</button></span></div>`).join('') : ''; }).join('')}
  ${S.pr.length ? '' : '<p class="mut">Catálogo vazio. Cadastre seus produtos para escolher na hora da venda.</p>'}`;
}
function formProd(id) {
  const p = S.pr.find(x => x.id == id) || (!id && PREPROD ? PREPROD : {});
  const pp = PREPROD; modal(`<h2>${id ? 'Editar' : 'Novo'} produto</h2><form onsubmit="salvaProd(event,'${id || ''}')">
  <input class="inp" name="nome" placeholder="Nome do produto" value="${esc(p.nome)}" required>
  <input class="inp" name="sku" placeholder="Código SKU (vazio = gerar automático)" value="${esc(p.sku)}">
  <select class="inp" name="categoria">${opts(CATS)}</select>
  <input class="inp" name="preco" type="number" step="0.01" min="0" inputmode="decimal" placeholder="Preço de venda (R$)" value="${p.preco ?? ''}" required>
  <input class="inp" name="custo" type="number" step="0.01" min="0" inputmode="decimal" placeholder="Preço de custo (R$) — quanto você pagou" value="${p.custo ?? ''}">
  <label><small>Foto (opcional)</small><input class="inp" name="foto" type="file" accept="image/*"></label>
  <label class="row"><span>Mostrar na vitrine online</span><input type="checkbox" name="vitrine" ${p.vitrine === false ? '' : 'checked'}></label>
  <button class="btn w">Salvar produto</button></form>`);
  PREPROD = pp;
  if (p.categoria) document.querySelector('#modal [name=categoria]').value = p.categoria;
}
async function salvaProd(e, id) {
  e.preventDefault();
  const pp = !id && PREPROD ? PREPROD : null;
  const fd = new FormData(e.target), d = { nome: fd.get('nome'), categoria: fd.get('categoria'), preco: +fd.get('preco'), custo: fd.get('custo') === '' ? null : +fd.get('custo'), vitrine: fd.get('vitrine') == 'on', sku: (fd.get('sku') || '').trim() || skuNovo(fd.get('categoria')) };
  const file = fd.get('foto'); if (file && file.size) d.foto = await redim(file);
  const { error } = id ? await db.from('produtos').update(d).eq('id', id) : await db.from('produtos').insert(d);
  if (error) return toast('Erro: ' + error.message);
  if (pp) { const ids = S.sg.filter(x => x.status == 'nova' && sgChave(x) == pp.sg).map(x => x.id); if (ids.length) await db.from('sugestoes').update({ status: 'atendida' }).in('id', ids); }
  fecha(); await load();
  if (pp) { PR.f = 'atendidas'; go('procuras'); toast('Produto cadastrado! Avise quem pediu 💜'); } else { render(); toast('Produto salvo'); }
}

function relDados() {
  const dia = d => { const x = new Date(d); return mes(x) + '-' + String(x.getDate()).padStart(2, '0'); };
  const ok = (d, c) => (!F.de || dia(d) >= F.de) && (!F.ate || dia(d) <= F.ate) && (!F.cli || c == F.cli);
  return { vs: S.v.filter(v => ok(v.data, v.cliente_id)), ps: S.p.filter(p => ok(p.criado_em, p.cliente_id)) };
}
function relatorio() {
  return `<div class="row"><h1>Relatórios</h1><button class="btn" onclick="relPDF()">📄 Relatório PDF / Imprimir</button></div>
  <div class="grid"><label><small>De</small><input class="inp" type="date" value="${F.de}" onchange="F.de=this.value;relRes()"></label>
  <label><small>Até</small><input class="inp" type="date" value="${F.ate}" onchange="F.ate=this.value;relRes()"></label></div>
  <select class="inp" onchange="F.cli=this.value;relRes()"><option value="">Todos os clientes</option>${S.c.map(c => `<option value="${c.id}" ${c.id == F.cli ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}</select>
  <div id="rel">${relRes(true)}</div>`;
}
function relRes(ret) {
  const { vs, ps } = relDados();
  const top = Object.entries(vs.flatMap(v => v.itens_venda).reduce((o, t) => (o[t.produto] = (o[t.produto] || 0) + t.quantidade, o), {})).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const cat = CATS.map(k => [k, sum(vs.flatMap(v => v.itens_venda).filter(t => t.categoria == k), t => t.quantidade * t.preco_unit)]);
  const h = `<div class="grid"><div class="card"><small>Vendido no período</small><b class="blk">${R(sum(vs, v => v.total))}</b></div>
  <div class="card"><small>Recebido no período</small><b class="blk grn">${R(sum(ps, p => p.valor))}</b></div></div>
  ${lucroRel(vs)}
  <h2>Quanto vou receber por mês</h2><small>Parcelas por mês de vencimento. Toque no mês para ver quem paga.</small>${previsao()}
  <h2>Produtos mais vendidos</h2>${top.map(([n, q]) => `<div class="card row"><span>${esc(n)}</span><b>${q} un.</b></div>`).join('') || '<p class="mut">Sem vendas neste filtro.</p>'}
  <h2>Por categoria</h2>${cat.map(([k, t]) => `<div class="card row"><span>${k}</span><b>${R(t)}</b></div>`).join('')}
  <h2>Vendas (${vs.length})</h2>
  ${vs.map(v => { const c = S.c.find(x => x.id == v.cliente_id) || {}; return `<div class="card"><div class="row"><b>${D(v.data)}</b><b>${R(v.total)}</b></div><button class="lnk" onclick="go('ficha','${v.cliente_id}')">${esc(c.nome)}</button><small class="blk">${v.itens_venda.map(t => t.quantidade + '× ' + esc(t.produto)).join(', ')}</small>${lucroTag(v)}</div>`; }).join('') || '<p class="mut">Nenhuma venda neste filtro.</p>'}`;
  if (ret) return h;
  $('#rel').innerHTML = h;
}
/* ===== RELATÓRIO EM PDF / IMPRESSÃO ===== */
function relPDF() {
  const { vs, ps } = relDados();
  const cliNome = F.cli ? ((S.c.find(c => c.id == F.cli) || {}).nome || '') : 'Todos os clientes';
  const per = (F.de ? dt(F.de) : 'início') + ' a ' + (F.ate ? dt(F.ate) : 'hoje');
  const dia = d => mes(d) + '-' + String(new Date(d).getDate()).padStart(2, '0');
  const noPer = d => (!F.de || dia(d) >= F.de) && (!F.ate || dia(d) <= F.ate);
  const pcs = todasParc().filter(x => !F.cli || x.c.id == F.cli);
  const abertas = pcs.filter(x => x.falta > 0.005), atras = abertas.filter(x => x.st == 'Atrasada');
  const itens = vs.flatMap(v => v.itens_venda);
  const cts = F.cli ? [] : S.ct;
  const pagasPer = cts.filter(x => x.pago && x.pago_em && noPer(x.pago_em));
  const vendido = sum(vs, v => v.total), recebido = sum(ps, p => p.valor), saidas = sum(pagasPer, x => x.valor);
  const saldo = recebido - saidas, LP = lucroDe(itens);
  const top = Object.entries(itens.reduce((o, t) => (o[t.produto] = (o[t.produto] || 0) + t.quantidade, o), {})).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const nome = id => esc((S.c.find(c => c.id == id) || {}).nome || '—');
  const tb = (head, rows) => `<table><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td${String(c).startsWith('R$') ? ' class="n"' : ''}>${c}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${head.length}" class="vz">Sem registros neste período</td></tr>`}</tbody></table>`;
  const st = x => `<span class="st ${({ Paga: 'ok', Pago: 'ok', Atrasada: 'bad', Atrasado: 'bad' })[x] || 'wait'}">${x}</span>`;
  const g = {};
  pcs.forEach(x => (g[x.vencimento.slice(0, 7)] = g[x.vencimento.slice(0, 7)] || []).push(x));
  const prev = Object.keys(g).sort().map(k => { const [a, m] = k.split('-'); return [new Date(a, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }), g[k].length, R(sum(g[k], x => x.valor)), R(sum(g[k], x => x.falta))]; });

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório - Rozivaldo Store</title><style>
@page{size:A4;margin:12mm}
*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{margin:0;font-family:Inter,Arial,sans-serif;color:#1c2433;font-size:12px;background:#eef1f6}
.pg{max-width:900px;margin:0 auto;background:#fff;padding:0 0 24px}
.bar{max-width:900px;margin:0 auto;padding:12px 0;display:flex;gap:8px;justify-content:flex-end}
.bar button{background:#3b82f6;color:#fff;border:0;border-radius:8px;padding:10px 18px;font:inherit;font-weight:700;cursor:pointer}
.bar button.alt{background:#27344f}
.top{background:#0f1a2e;color:#fff;padding:20px 26px;display:flex;align-items:center;gap:16px}
.top h1{margin:0;font-size:20px;letter-spacing:.04em}.top small{color:#9fb0cf;letter-spacing:.08em;font-size:9px}
.top .meta{margin-left:auto;text-align:right;font-size:11px;line-height:1.6;color:#cbd5e8}
.sec{padding:0 26px}
h2{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#3b82f6;border-bottom:2px solid #e3e8f2;padding-bottom:5px;margin:22px 0 8px}
.kp{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:18px}
.kp div{border:1px solid #e3e8f2;border-left:4px solid #3b82f6;border-radius:8px;padding:10px 12px}
.kp small{display:block;color:#6b7a96;font-size:10px;text-transform:uppercase;letter-spacing:.04em}
.kp b{font-size:17px}.kp .g{border-left-color:#16a34a}.kp .g b{color:#15803d}.kp .r{border-left-color:#dc2626}.kp .r b{color:#b91c1c}.kp .y{border-left-color:#d97706}
table{width:100%;border-collapse:collapse;font-size:11px}
th{background:#f1f4fa;text-align:left;padding:7px 8px;color:#45536e;font-size:10px;text-transform:uppercase;letter-spacing:.04em}
td{padding:7px 8px;border-bottom:1px solid #eceff5;vertical-align:top}tr:nth-child(even) td{background:#fafbfd}
td.n{text-align:right;white-space:nowrap}.vz{text-align:center;color:#8a96ad;padding:14px}
tr{page-break-inside:avoid}
.st{padding:2px 8px;border-radius:99px;font-size:10px;font-weight:700}.ok{background:#dcfce7;color:#166534}.bad{background:#fee2e2;color:#991b1b}.wait{background:#fef3c7;color:#92400e}
.foot{margin:26px 26px 0;padding-top:8px;border-top:1px solid #e3e8f2;color:#8a96ad;font-size:10px;text-align:center}
@media print{body{background:#fff}.bar{display:none}.pg{max-width:none}}
</style></head><body>
<div class="bar"><button class="alt" onclick="window.close()">Fechar</button><button onclick="window.print()">🖨️ Imprimir / Salvar PDF</button></div>
<div class="pg">
<div class="top"><svg viewBox="0 0 64 64" width="52" height="52"><path d="M14 22h36l-3 34H17z" fill="none" stroke="#cbd5e1" stroke-width="2.5"/><path d="M24 22v-6a8 8 0 0 1 16 0v6" fill="none" stroke="#cbd5e1" stroke-width="2.5"/><text x="32" y="47" text-anchor="middle" font-size="22" font-weight="800" fill="#cbd5e1" font-family="sans-serif">R</text></svg>
<div><h1>ROZIVALDO STORE</h1><small>MODA · LINGERIE · SEX SHOP</small></div>
<div class="meta"><b>RELATÓRIO FINANCEIRO E DE VENDAS</b><br>Período: ${per}<br>Cliente: ${esc(cliNome)}<br>Emitido em ${new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</div></div>
<div class="sec">
<div class="kp">
<div><small>Vendido no período</small><b>${R(vendido)}</b></div>
<div class="g"><small>Recebido no período</small><b>${R(recebido)}</b></div>
<div class="y"><small>A receber (parcelas em aberto)</small><b>${R(sum(abertas, x => x.falta))}</b></div>
<div class="r"><small>Em atraso (${atras.length})</small><b>${R(sum(atras, x => x.falta))}</b></div>
<div class="r"><small>Contas pagas no período</small><b>${R(saidas)}</b></div>
<div class="${saldo >= 0 ? 'g' : 'r'}"><small>Saldo (recebido − contas pagas)</small><b>${R(saldo)}</b></div>
</div>
<div class="kp" style="margin-top:10px"><div class="${LP.lucro >= 0 ? 'g' : 'r'}"><small>Lucro bruto</small><b>${R(LP.lucro)}</b></div><div><small>Margem de lucro</small><b>${pct(LP.margem)}</b></div><div class="y"><small>Custo dos produtos vendidos</small><b>${R(LP.custo)}</b></div></div>
${LP.total > 0 && LP.cobertura < 0.999 ? `<p style="color:#8a96ad;font-size:10px;margin:6px 0 0">Lucro calculado sobre ${pct(LP.cobertura)} das vendas (as demais não têm custo informado).</p>` : ''}
<h2>Vendas por categoria</h2>
${tb(['Categoria', 'Unidades', 'Total'], CATS.map(k => { const l = itens.filter(t => t.categoria == k); return [k, sum(l, t => t.quantidade), R(sum(l, t => t.quantidade * t.preco_unit))]; }))}
<h2>Produtos mais vendidos</h2>
${tb(['Produto', 'Unidades'], top.map(([n, q]) => [esc(n), q]))}
<h2>Lucro por categoria</h2>
${tb(['Categoria', 'Vendido', 'Custo', 'Lucro', 'Margem'], lucroPorCat(itens).map(([k, l]) => [k, R(l.total), R(l.custo), l.base ? R(l.lucro) : '—', l.base ? pct(l.margem) : '—']))}
<h2>Produtos mais lucrativos</h2>
${tb(['Produto', 'Unidades', 'Lucro'], lucroPorProd(itens, 10).map(([n, o]) => [esc(n), o.q, R(o.l)]))}
<h2>Previsão de recebimento por mês</h2>
${tb(['Mês', 'Parcelas', 'Valor total', 'Falta receber'], prev)}
<h2>Parcelas em atraso</h2>
${tb(['Cliente', 'Parcela', 'Vencimento', 'Falta receber'], atras.sort((a, b) => a.vencimento < b.vencimento ? -1 : 1).map(x => [esc(x.c.nome), x.numero + 'ª', dt(x.vencimento), R(x.falta)]))}
<h2>Recebimentos no período</h2>
${tb(['Data', 'Cliente', 'Forma', 'Valor'], ps.map(p => [new Date(p.criado_em).toLocaleDateString('pt-BR'), nome(p.cliente_id), esc(p.forma || '—'), R(p.valor)]))}
${F.cli ? '' : `<h2>Contas a pagar</h2>
${tb(['Descrição', 'Forma', 'Vencimento', 'Valor', 'Situação'], [...cts].sort((a, b) => a.vencimento < b.vencimento ? -1 : 1).map(x => [esc(x.descricao) + (x.parcelas_total > 1 ? ` (${x.parcela_num}/${x.parcelas_total})` : ''), esc(x.forma || '—'), dt(x.vencimento), R(x.valor), st(x.pago ? 'Pago' : (x.vencimento < HOJE ? 'Atrasado' : 'A vencer'))]))}`}
<h2>Vendas detalhadas (${vs.length})</h2>
${tb(['Data', 'Cliente', 'Itens', 'Total', 'Lucro', 'Situação'], vs.map(v => { const lv = lucroDe(v.itens_venda || []); return [new Date(v.data).toLocaleDateString('pt-BR'), nome(v.cliente_id), v.itens_venda.map(t => t.quantidade + '× ' + esc(t.produto)).join(', '), R(v.total), lv.base ? R(lv.lucro) : '—', st(stVenda(v))]; }))}
</div>
<div class="foot">Rozivaldo Store · Relatório gerado automaticamente pelo sistema de gestão</div>
</div></body></html>`;
  const w = window.open('', '_blank');
  if (!w) return toast('Permita pop-ups deste site para abrir o relatório');
  w.document.write(html); w.document.close();
}

function csv() {
  const l = [['Data', 'Cliente', 'Produto', 'Categoria', 'Qtd', 'Preço unit.', 'Subtotal']];
  relDados().vs.forEach(v => { const c = S.c.find(x => x.id == v.cliente_id) || {}; v.itens_venda.forEach(t => l.push([new Date(v.data).toLocaleDateString('pt-BR'), c.nome, t.produto, t.categoria, t.quantidade, t.preco_unit, t.quantidade * t.preco_unit])); });
  const txt = l.map(r => r.map(x => `"${String(x ?? '').replace(/"/g, '""')}"`).join(';')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\ufeff' + txt], { type: 'text/csv' }));
  a.download = 'vendas.csv'; a.click();
}

const CC = { Masculino: '#3b6ab0', Feminino: '#a24bd0', Lingerie: '#d6409f', Sexshop: '#d23a4e' };
const IC = { Masculino: '👔', Feminino: '👗', Lingerie: '💗', Sexshop: '🔥' };
const TAG = { Paga: 'ok', Pago: 'ok', Atrasada: 'bad', Atrasado: 'bad', 'A vencer': 'wait', Pendente: 'wait' };
const tag = x => `<em class="tag ${TAG[x]}">${x}</em>`;
const dia2 = d => mes(d) + '-' + String(d.getDate()).padStart(2, '0');
const HOJE = dia2(new Date());
const proxDia5 = () => { const d = new Date(); d.setDate(5); d.setMonth(d.getMonth() + 1); return dia2(d); };
const dt = x => x.split('-').reverse().join('/');
const foto = p => p.foto ? `<img class="ph" src="${p.foto}" alt="">` : '<div class="ph">🛍️</div>';
const redim = f => new Promise(ok => {
  const im = new Image();
  im.onload = () => { const k = Math.min(1, 240 / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = im.width * k; c.height = im.height * k; c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); ok(c.toDataURL('image/jpeg', .75)); };
  im.src = URL.createObjectURL(f);
});
// Pagamentos de baixa (sem venda) quitam as parcelas do cliente da mais antiga para a mais nova
function parc(cid) {
  const vend = {}; let pool = 0;
  S.p.filter(p => p.cliente_id == cid && !p.venda_id).forEach(p => { if (p.ref_venda_id) vend[p.ref_venda_id] = (vend[p.ref_venda_id] || 0) + Number(p.valor); else pool += Number(p.valor); });
  const l = S.pa.filter(x => x.cliente_id == cid).sort((a, b) => a.vencimento < b.vencimento ? -1 : 1);
  const f = l.map(x => { const v = Number(x.valor), pg = Math.min(vend[x.venda_id] || 0, v); vend[x.venda_id] = (vend[x.venda_id] || 0) - pg; return v - pg; });
  pool += sum(Object.values(vend), a => a);
  return l.map((x, i) => { const pg = Math.min(pool, f[i]); pool -= pg; const falta = f[i] - pg; return { ...x, falta, st: falta < 0.005 ? 'Paga' : x.vencimento < HOJE ? 'Atrasada' : 'A vencer' }; });
}
const todasParc = () => S.c.flatMap(c => parc(c.id).map(x => ({ ...x, c })));
function stVenda(v) {
  const pa = parc(v.cliente_id).filter(x => x.venda_id == v.id);
  if (pa.some(x => x.st == 'Atrasada')) return 'Atrasado';
  const pago = sum(S.p.filter(p => p.venda_id == v.id), p => p.valor);
  return (pa.length ? pa.every(x => x.st == 'Paga') : pago >= v.total - 0.005) ? 'Pago' : 'Pendente';
}
function parcRow(x) {
  const msg = `Olá, ${x.c.nome}! Passando para lembrar da parcela ${x.numero} de ${R(x.falta)}, ${x.st == 'Atrasada' ? 'vencida em' : 'com vencimento em'} ${dt(x.vencimento)}, da Rozivaldo Store. Obrigado!`;
  return `<div class="card row"><span><button class="lnk" onclick="go('ficha','${x.c.id}')">${esc(x.c.nome)}</button><small class="blk">${x.numero}ª parcela · vence ${dt(x.vencimento)}</small></span><span>${R(x.falta)} ${tag(x.st)} <button class="lnk" onclick="editaParc('${x.id}')">Mudar data</button> ${x.c.telefone ? `<a class="lnk" target="_blank" href="${zapLink(x.c, msg)}">Cobrar</a>` : ''}</span></div>`;
}
function financeiro() {
  const t = todasParc().filter(x => x.st != 'Paga').sort((a, b) => a.vencimento < b.vencimento ? -1 : 1);
  return `<div class="row"><h1>Financeiro</h1><span><button class="btn alt" onclick="go('fluxo')">Fluxo de caixa</button> <button class="btn" onclick="COB.f='atrasadas';go('cobranca')">Cobrar atrasados</button></span></div><p class="mut">Parcelas em aberto: ${t.length} · ${R(sum(t, x => x.falta))}</p>${t.map(parcRow).join('') || '<p class="mut">Nenhuma parcela em aberto.</p>'}`;
}

function previsao() {
  const g = {};
  todasParc().filter(x => !F.cli || x.c.id == F.cli).forEach(x => { (g[x.vencimento.slice(0, 7)] = g[x.vencimento.slice(0, 7)] || []).push(x); });
  return Object.keys(g).sort().map(k => {
    const l = g[k], [a, m] = k.split('-'), falta = sum(l, x => x.falta);
    const lab = new Date(a, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    return `<details class="card"><summary class="row"><b>${lab}</b><span><b class="${falta > 0.005 ? '' : 'grn'}">${R(falta)}</b> <small>de ${R(sum(l, x => x.valor))}</small> ${k < HOJE.slice(0, 7) && falta > 0.005 ? tag('Atrasado') : ''}</span></summary>${l.filter(x => x.falta > 0.005).sort((p, q) => p.vencimento < q.vencimento ? -1 : 1).map(parcRow).join('') || '<small>Tudo recebido neste mês.</small>'}</details>`;
  }).join('') || '<p class="mut">Nenhuma parcela cadastrada ainda.</p>';
}
function menu() { $('#side').classList.toggle('open'); }
document.addEventListener('click', e => { if (!e.target.closest('aside,#top')) $('#side').classList.remove('open'); });
async function entregar(id) {
  const { error } = await db.from('vendas').update({ entregue: true }).eq('id', id);
  if (error) return toast('Erro: ' + error.message);
  await load(); render(); toast('Entrega concluída');
}

let H = { q: '', st: '' }, M = mes(new Date());
const cn = id => esc((S.c.find(c => c.id == id) || {}).nome);
function historico() {
  return `<h1>Histórico de vendas</h1><div class="grid"><input class="inp" placeholder="Buscar cliente" value="${esc(H.q)}" oninput="H.q=this.value;histRes()">
  <select class="inp" onchange="H.st=this.value;histRes()">${['', 'Pago', 'Pendente', 'Atrasado', 'Entrega pendente'].map(x => `<option value="${x}" ${H.st == x ? 'selected' : ''}>${x || 'Todos os status'}</option>`).join('')}</select></div><div id="hist">${histRes(1)}</div>`;
}
function histRes(r) {
  const l = S.v.filter(v => (S.c.find(c => c.id == v.cliente_id) || {}).nome?.toLowerCase().includes(H.q.toLowerCase()) && (!H.st || (H.st == 'Entrega pendente' ? v.entregue === false : stVenda(v) == H.st)));
  const h = `<small>${l.length} vendas · ${R(sum(l, v => v.total))}</small>` + (l.map(v => `<div class="card"><div class="row"><b>${cn(v.cliente_id)}</b><span>${R(v.total)} ${tag(stVenda(v))} ${v.entregue === false ? '<em class="tag wait">Entrega pendente</em>' : ''}</span></div>
    <small class="blk">${D(v.data)} · ${v.itens_venda.map(t => t.quantidade + '× ' + esc(t.produto)).join(', ')}</small>
    <div class="row"><button class="lnk" onclick="go('ficha','${v.cliente_id}')">Abrir cliente</button><button class="lnk" onclick="go('venda','${v.cliente_id}','${v.id}')">✏️ Editar</button><button class="lnk" onclick="zapVenda('${v.id}')">WhatsApp</button><button class="lnk red" onclick="excluiVenda('${v.id}')">Excluir</button>${v.entregue === false ? `<button class="lnk" onclick="entregar('${v.id}')">🚚 Marcar entregue</button>` : ''}</div></div>`).join('') || '<p class="mut">Nenhuma venda encontrada.</p>');
  if (r) return h;
  $('#hist').innerHTML = h;
}

function recebimentos() {
  return `<h1>Recebimentos</h1><input class="inp" type="month" value="${M}" onchange="M=this.value;recRes()"><div id="rec">${recRes(1)}</div>`;
}
function recRes(r) {
  const l = S.p.filter(p => mes(p.criado_em) == M);
  const h = `<div class="card"><small>Total recebido no mês</small><b class="blk grn" style="font-size:1.6rem">${R(sum(l, p => p.valor))}</b>
    <small class="blk">${FORMAS.map(f => f + ': ' + R(sum(l.filter(p => p.forma == f), p => p.valor))).join(' · ')}</small></div>` +
    (l.map(p => `<div class="card row"><span><b>${cn(p.cliente_id)}</b><small class="blk">${D(p.criado_em)} · ${esc(p.forma)}</small></span><span><b class="grn">${R(p.valor)}</b> <button class="lnk" onclick="editaPag('${p.id}')">Editar</button><button class="lnk red" onclick="excluiPag('${p.id}')">Excluir</button></span></div>`).join('') || '<p class="mut">Nenhum recebimento neste mês.</p>');
  if (r) return h;
  $('#rec').innerHTML = h;
}

/* ===== CONTAS A PAGAR: cartões, à vista, parcelas e resumo por mês ===== */
const addMes = (s, k) => { const [a, m, d] = s.split('-').map(Number), t = new Date(a, m - 1 + k, 1), u = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate(); t.setDate(Math.min(d, u)); return dia2(t); };
const SVGS = {
  nubank: '<rect width="32" height="32" rx="8" fill="#820AD1"/><text x="16" y="21.5" text-anchor="middle" font-family="Arial,sans-serif" font-weight="800" font-size="14" fill="#fff">nu</text>',
  master: '<rect width="32" height="32" rx="8" fill="#1f2937"/><circle cx="12.5" cy="16" r="7" fill="#EB001B"/><circle cx="19.5" cy="16" r="7" fill="#F79E1B"/><path d="M16 10.4a7 7 0 0 1 0 11.2 7 7 0 0 1 0-11.2z" fill="#FF5F00"/>',
  pix: '<rect width="32" height="32" rx="8" fill="#32BCAD"/><path d="M16 6l10 10-10 10L6 16z" fill="none" stroke="#fff" stroke-width="2.4" stroke-linejoin="round"/><path d="M11.5 16 16 11.5 20.5 16 16 20.5z" fill="#fff"/>',
  cash: '<rect width="32" height="32" rx="8" fill="#15803d"/><rect x="5" y="9" width="22" height="14" rx="2.5" fill="#bbf7d0"/><circle cx="16" cy="16" r="3.6" fill="#15803d"/><circle cx="8.8" cy="16" r="1.2" fill="#15803d"/><circle cx="23.2" cy="16" r="1.2" fill="#15803d"/>',
  card: '<rect width="32" height="32" rx="8" fill="#334155"/><rect x="5" y="9" width="22" height="14" rx="2.5" fill="#94a3b8"/><rect x="5" y="12.5" width="22" height="3.4" fill="#1e293b"/><rect x="8" y="19" width="7" height="1.8" rx=".9" fill="#1e293b"/>',
  other: '<rect width="32" height="32" rx="8" fill="#475569"/><circle cx="16" cy="16" r="5" fill="none" stroke="#e2e8f0" stroke-width="2.2"/><path d="M16 13.5v5M13.5 16h5" stroke="#e2e8f0" stroke-width="2"/>'
};
const ICOF = (f, t) => {
  const k = nz(String(f || '')), s = /nubank|^nu$/.test(k) ? 'nubank' : /master/.test(k) ? 'master' : /pix/.test(k) ? 'pix' : /dinheiro|especie/.test(k) ? 'cash' : t == 'cartao' ? 'card' : 'other';
  return `<svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">${SVGS[s]}</svg>`;
};
const CTILES = [['Nubank', 'cartao', 'Nubank'], ['Mastercard', 'cartao', 'Mastercard'], ['Outro cartão', 'cartao', 'Outro cartão'], ['Pix', 'vista', 'Pix'], ['Dinheiro', 'vista', 'Dinheiro'], ['Outro', 'vista', 'Outro']];
function contaRow(x) {
  return `<div class="card row"><span style="display:flex;gap:10px;align-items:center">${ICOF(x.forma, x.tipo)}<span><b>${esc(x.descricao)}${x.parcelas_total > 1 ? ` <small>(${x.parcela_num}/${x.parcelas_total})</small>` : ''}</b><small class="blk">${esc(x.forma || 'Outro')} · vence ${dt(x.vencimento)}</small></span></span>
  <span>${R(x.valor)} ${x.pago ? tag('Pago') : tag(x.vencimento < HOJE ? 'Atrasado' : 'A vencer')}
  ${x.pago ? '' : `<button class="lnk" onclick="pagaConta('${x.id}')">Dar baixa</button>`}<button class="lnk red" onclick="excluiConta('${x.id}')">Excluir</button></span></div>`;
}
function contas() {
  const l = [...S.ct].sort((a, b) => a.vencimento < b.vencimento ? -1 : 1), mm = mes(new Date()), ab = l.filter(x => !x.pago), pg = l.filter(x => x.pago).reverse();
  const saldo = sum(S.p.filter(p => mes(p.criado_em) == mm), p => p.valor) - sum(S.ct.filter(x => x.pago && mes(x.pago_em) == mm), x => x.valor);
  const fm = x => x.forma || 'Outro', porForma = {}, tp = {}, g = {};
  ab.forEach(x => { porForma[fm(x)] = (porForma[fm(x)] || 0) + Number(x.valor); tp[fm(x)] = x.tipo; (g[x.vencimento.slice(0, 7)] = g[x.vencimento.slice(0, 7)] || []).push(x); });
  const chips = o => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([f, v]) => `<span class="fc">${ICOF(f, tp[f])}<span>${esc(f)}<b class="blk">${R(v)}</b></span></span>`).join('');
  return `<div class="row"><h1>Contas a pagar</h1><button class="btn" onclick="formConta()">+ Nova conta</button></div>
  <div class="grid"><div class="card"><small>Em aberto</small><b class="blk red">${R(sum(ab, x => x.valor))}</b></div>
  <div class="card"><small>Saldo do mês (recebido − contas pagas)</small><b class="blk ${saldo >= 0 ? 'grn' : 'red'}">${R(saldo)}</b></div>
  <div class="card w2"><small>A cobrir até o fim deste mês (inclui atrasadas)</small><b class="blk">${R(sum(ab.filter(x => x.vencimento.slice(0, 7) <= HOJE.slice(0, 7)), x => x.valor))}</b></div></div>
  ${ab.length ? `<h2>Em aberto por forma de pagamento</h2><div class="fchips">${chips(porForma)}</div>
  <h2>Quanto cobrir em cada mês</h2>${Object.keys(g).sort().map(k => {
    const [a, m] = k.split('-'), it = g[k], po = {};
    it.forEach(x => po[fm(x)] = (po[fm(x)] || 0) + Number(x.valor));
    return `<details class="card" ${k <= HOJE.slice(0, 7) ? 'open' : ''}><summary class="row"><b style="text-transform:capitalize">${new Date(a, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</b><span><b>${R(sum(it, x => x.valor))}</b> ${k < HOJE.slice(0, 7) ? tag('Atrasado') : ''}</span></summary><div class="fchips">${chips(po)}</div>${it.map(contaRow).join('')}</details>`;
  }).join('')}` : '<p class="mut">Nenhuma conta em aberto.</p>'}
  ${pg.length ? `<details class="card"><summary class="row"><b>Contas pagas (${pg.length})</b><span>${R(sum(pg, x => x.valor))}</span></summary>${pg.map(contaRow).join('')}</details>` : ''}`;
}
function formConta() {
  modal(`<h2>Nova conta a pagar</h2><form id="cf" onsubmit="salvaConta(event)">
  <input class="inp" name="descricao" placeholder="Descrição (ex: fornecedor, estoque, aluguel)" required>
  <input class="inp" name="valor" type="number" step="0.01" min="0.01" inputmode="decimal" placeholder="Valor total (R$)" oninput="ctPrev()" required>
  <small>Como você pagou / vai pagar?</small>
  <div class="tiles">${CTILES.map(([v, t, n]) => `<label class="tile"><input type="radio" name="fm" value="${v}" data-t="${t}" onchange="ctForma()">${ICOF(v, t)}<span>${n}</span></label>`).join('')}</div>
  <input class="inp" id="ctn" name="fnome" placeholder="Nome (ex: Inter, Itaú, boleto)" hidden>
  <div id="ctp" hidden><label><small>Nº de parcelas no cartão</small><input class="inp" name="np" type="number" min="1" max="24" value="1" oninput="ctPrev()"></label><small id="ctpv" class="blk"></small></div>
  <label><small id="ctvl">Vencimento / data do pagamento</small><input class="inp" name="vencimento" type="date" value="${HOJE}" required></label>
  <label class="card row" id="ctj"><span>✅ Já paguei</span><input type="checkbox" name="jap"></label>
  <button class="btn w">Salvar conta</button></form>`);
}
function ctForma() {
  const r = document.querySelector('[name=fm]:checked'); if (!r) return;
  const f = r.form, cartao = r.dataset.t == 'cartao';
  $('#ctn').hidden = !r.value.startsWith('Outro'); $('#ctp').hidden = !cartao; $('#ctj').hidden = cartao;
  $('#ctvl').textContent = cartao ? 'Vencimento da 1ª parcela (fatura)' : 'Data do pagamento';
  if (!cartao) f.np.value = 1;
  f.jap.checked = !cartao; ctPrev();
}
function ctPrev() {
  const f = $('#cf'); if (!f) return;
  const v = +f.valor.value || 0, n = Math.max(1, Math.min(24, +f.np.value || 1));
  $('#ctpv').textContent = v > 0 && n > 1 ? `${n}× de ${R(v / n)}, uma por mês` : '';
}
async function salvaConta(e) {
  e.preventDefault();
  const f = e.target, r = f.querySelector('[name=fm]:checked');
  if (!r) return toast('Escolha como foi pago: cartão, Pix, dinheiro...');
  const cartao = r.dataset.t == 'cartao', nome = r.value.startsWith('Outro') ? (f.fnome.value.trim() || r.value) : r.value;
  const total = +f.valor.value, n = cartao ? Math.max(1, Math.min(24, +f.np.value || 1)) : 1, base = Math.floor(total / n * 100) / 100;
  const grupo = window.crypto && crypto.randomUUID ? crypto.randomUUID() : null, jap = !cartao && f.jap.checked;
  const linhas = [...Array(n)].map((_, k) => ({ descricao: f.descricao.value.trim(), valor: k == n - 1 ? +(total - base * (n - 1)).toFixed(2) : base, vencimento: addMes(f.vencimento.value, k), forma: nome, tipo: cartao ? 'cartao' : 'vista', parcela_num: k + 1, parcelas_total: n, grupo, pago: jap, ...(jap ? { pago_em: new Date(f.vencimento.value + 'T12:00:00').toISOString() } : {}) }));
  const { error } = await db.from('contas').insert(linhas);
  if (error) return toast('Erro: ' + error.message);
  fecha(); await load(); render(); toast(n > 1 ? `Conta salva em ${n} parcelas` : 'Conta salva');
}
async function excluiConta(id) {
  const x = S.ct.find(c => c.id == id); if (!x) return;
  let q = db.from('contas').delete().eq('id', id);
  if (x.grupo && x.parcelas_total > 1) {
    if (confirm(`Essa compra tem ${x.parcelas_total} parcelas. Excluir TODAS as parcelas?\n\nOK = todas · Cancelar = escolher só esta`)) q = db.from('contas').delete().eq('grupo', x.grupo);
    else if (!confirm('Excluir só esta parcela?')) return;
  } else if (!confirm('Excluir esta conta? Não dá para desfazer.')) return;
  const { error } = await q;
  if (error) return toast('Erro: ' + error.message);
  await load(); render(); toast('Excluído');
}
async function pagaConta(id) {
  const { error } = await db.from('contas').update({ pago: true, pago_em: new Date().toISOString() }).eq('id', id);
  if (error) return toast('Erro: ' + error.message);
  await load(); render(); toast('Conta paga');
}

function ajustes() {
  return `<h1>Configurações</h1>
  <div class="card"><h2>Alterar senha</h2><form onsubmit="novaSenha(event)">
  <input class="inp" name="s1" type="password" minlength="8" placeholder="Nova senha (mínimo 8 caracteres)" required>
  <input class="inp" name="s2" type="password" placeholder="Repita a nova senha" required><button class="btn w">Salvar nova senha</button></form></div>
  ${cardInstalar()}
  <div class="card"><h2>Backup dos dados</h2><small class="blk">Baixa um arquivo com clientes, vendas, pagamentos, parcelas, produtos e contas. Guarde em local seguro.</small>
  <button class="btn alt w" style="margin-top:8px" onclick="backup()">Baixar backup</button></div>`;
}
async function novaSenha(e) {
  e.preventDefault();
  const f = e.target;
  if (f.s1.value != f.s2.value) return toast('As senhas não são iguais');
  const { error } = await db.auth.updateUser({ password: f.s1.value });
  if (error) return toast('Erro: ' + error.message);
  f.reset(); toast('Senha alterada');
}
function backup() {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify({ gerado_em: new Date().toISOString(), ...S }, null, 1)], { type: 'application/json' }));
  a.download = 'backup-rozivaldo-' + HOJE + '.json'; a.click();
}

let PRE = null, PEDIDO = null;
const LINK = () => location.origin + location.pathname.replace(/[^/]*$/, '') + 'catalogo.html';
function copiaLink() { navigator.clipboard.writeText(LINK()).then(() => toast('Link copiado!')); }

function fillRow(row, i) {
  const sel = row.querySelector('select');
  if (i.pid && S.pr.some(x => x.id == i.pid)) { sel.value = i.pid; pick(sel); }
  else { row.querySelector('[name=produto]').value = i.produto; row.querySelector('[name=categoria]').value = i.categoria; }
  row.querySelector('[name=quantidade]').value = i.qtd;
  if (i.preco != null) row.querySelector('[name=preco]').value = Number(i.preco).toFixed(2);
  if (i.custo != null) row.querySelector('[name=custo]').value = Number(i.custo).toFixed(2);
}
function iniciaVenda() {
  PKEY = ''; PDATES = []; VP = { q: '', cat: 'Todos' }; vpDesenha();
  if (EDIT) { AUTO = null; return carregaEdicao(); }
  if (PRE) { PEDIDO = PRE.pedido; PRE.itens.forEach(i => { addItem(); fillRow($('#its').lastElementChild, i); }); PRE = null; toast(PEDIDO ? 'Pedido carregado. Confira e registre a venda.' : 'Produto adicionado. Escolha o cliente e registre a venda.'); }
  else { PEDIDO = null; addItem(); }
  calc();
  if (AUTO == 'ouvir') ouvir(); else if (AUTO == 'foco') $('#frase').focus();
  AUTO = null;
}

const NUM = { um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12 };
const STOP = new Set('venda vendi vender para pra cliente parcelado parcelada em de do da por no na valor cada reais real a vista avista entrada e o as os'.split(' '));
const nz = t => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const nm = x => Object.hasOwn(NUM, x) ? NUM[x] : parseFloat(x.replace(',', '.'));
const stem = x => x.replace(/s$/, '');
const guessCat = t => /lingerie|calcinha|suti|camisola|body|cinta|espartilho/.test(t) ? 'Lingerie' : /vibrador|gel|sexshop|algema|fantasia|lubrificante|pompoar|plug/.test(t) ? 'Sexshop' : /feminin|vestido|saia|blusa|cropped|short|legging/.test(t) ? 'Feminino' : 'Masculino';
function interpreta(txt) {
  let t = ' ' + nz(txt).replace(/r\$\s*/g, '').replace(/(\d+)\s*reais?\s*e\s*(\d{1,2})\s*centavos?/g, '$1,$2') + ' ';
  const r = { itens: [] }, W = t.split(/[^a-z0-9]+/);
  const cl = S.c.map(c => ({ c, n: nz(c.nome) })).map(x => ({ ...x, k: t.includes(x.n) ? 2 : W.includes(x.n.split(' ')[0]) ? 1 : 0 })).filter(x => x.k).sort((a, b) => b.k - a.k || b.n.length - a.n.length)[0];
  if (cl) { r.cid = cl.c.id; t = t.replace(cl.k == 2 ? cl.n : cl.n.split(' ')[0], ' '); }
  let m = t.match(new RegExp('(\\d+|' + Object.keys(NUM).join('|') + ')\\s*(?:vezes|x|parcelas?)(?![a-z])'));
  if (m) { r.np = nm(m[1]); t = t.replace(m[0], ' '); }
  m = t.match(/(?:entrada|pagou|pago|deu)\s*(?:de\s*)?(\d+(?:[.,]\d+)?)/);
  if (m) { r.pago = nm(m[1]); t = t.replace(m[0], ' '); }
  if (/\ba vista\b|\bavista\b/.test(t)) r.vista = true;
  t.split(/,|;|\s+mais\s+|\s+e\s+(?=(?:um|uma|dois|duas|tres|quatro|cinco|\d+)\s)/).forEach(p => {
    const tk = (p.match(/[a-z]+|\d+(?:[.,]\d+)?/g) || []).filter(x => !STOP.has(x));
    let qtd = 1;
    if (tk.length > 1 && (Object.hasOwn(NUM, tk[0]) || /^\d+$/.test(tk[0]))) qtd = nm(tk.shift());
    const i = tk.map(x => /^\d/.test(x)).lastIndexOf(true);
    const preco = i >= 0 ? nm(tk.splice(i, 1)[0]) : null, w = tk.filter(x => !/^\d/.test(x));
    if (!w.length) return;
    const ws = new Set(w.map(stem));
    const pr = S.pr.filter(x => { const pw = (nz(x.nome).match(/[a-z]+/g) || []).filter(y => !STOP.has(y)).map(stem); return pw.length && pw.every(y => ws.has(y)); }).sort((a, b) => b.nome.length - a.nome.length)[0];
    r.itens.push(pr ? { pid: pr.id, produto: pr.nome, categoria: pr.categoria, qtd, preco: preco ?? pr.preco } : { produto: w.join(' ').replace(/^./, c => c.toUpperCase()), categoria: guessCat(w.join(' ')), qtd, preco });
  });
  return r;
}
function ouvir() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return toast('Este navegador não tem reconhecimento de voz. Use o Chrome ou digite a frase ao lado.');
  const r = new SR(); r.lang = 'pt-BR';
  r.onresult = e => aplicaVoz(e.results[0][0].transcript);
  r.onerror = e => toast('Não consegui ouvir (' + e.error + '). Libere o microfone no navegador.');
  toast('🎤 Ouvindo… fale a venda'); r.start();
}
function aplicaVoz(txt) {
  if (!txt.trim()) return toast('Fale ou digite a venda primeiro');
  const r = interpreta(txt), f = $('#view form');
  $('#frase').value = txt;
  $('#fb').textContent = 'Entendi: ' + [r.cid ? 'Cliente ' + S.c.find(c => c.id == r.cid).nome : 'cliente não identificado (escolha na lista)', ...r.itens.map(i => `${i.qtd}× ${i.produto} ${i.preco != null ? R(i.preco) : '(sem preço)'}`), r.np ? r.np + ' parcela(s)' : '', r.pago != null ? 'entrada ' + R(r.pago) : '', r.vista ? 'à vista' : ''].filter(Boolean).join(' · ');
  if (r.cid) f.cliente_id.value = r.cid;
  if (!r.itens.length) return toast('Não entendi os produtos. Tente: "uma camisa polo de 119,90"');
  $('#its').innerHTML = ''; r.itens.forEach(i => { addItem(); fillRow($('#its').lastElementChild, i); });
  if (r.np) f.np.value = r.np;
  const tot = calc();
  if (r.vista) f.pago.value = tot.toFixed(2); else if (r.pago != null) f.pago.value = r.pago;
  calc(); toast('Confira os campos e toque em Registrar venda');
}

function pedidos() {
  return `<h1>Pedidos online</h1><p class="mut">Pedidos feitos pelos clientes na vitrine. “Virar venda” abre a Nova venda já preenchida.</p>` +
  (S.pd.map(p => `<div class="card"><div class="row"><b>${esc(p.nome)}</b><b>${R(p.total)}</b></div><small class="blk">${esc(p.telefone)} · ${D(p.criado_em)}</small>
    ${p.itens.map(i => `<small class="blk">${i.qtd}× ${esc(i.nome)} — ${R(i.preco)}</small>`).join('')}
    <div class="row"><button class="btn" onclick="virarVenda('${p.id}')">Virar venda</button><a class="lnk" target="_blank" href="https://wa.me/${fone(p.telefone)}">Chamar no WhatsApp</a><button class="lnk red" onclick="del('pedidos','${p.id}')">Descartar</button></div></div>`).join('') || '<p class="mut">Nenhum pedido novo.</p>');
}
async function virarVenda(id) {
  const p = S.pd.find(x => x.id == id), d = (p.telefone || '').replace(/\D/g, '');
  let c = S.c.find(x => d && (x.telefone || '').replace(/\D/g, '') == d);
  if (!c) {
    const r = await db.from('clientes').insert({ nome: p.nome, telefone: p.telefone }).select().single();
    if (r.error) return toast('Erro: ' + r.error.message);
    c = r.data; await load();
  }
  PRE = { pedido: id, itens: p.itens.map(i => ({ pid: i.id, produto: i.nome, categoria: i.categoria, qtd: i.qtd, preco: (S.pr.find(x => x.id == i.id) || i).preco })) };
  go('venda', c.id);
}

async function del(t, id) {
  if (!confirm(t == 'clientes' ? 'Excluir o cliente E todas as compras e pagamentos dele? Não dá para desfazer.' : 'Excluir este registro? Não dá para desfazer.')) return;
  const { error } = await db.from(t).delete().eq('id', id);
  if (error) return toast('Erro: ' + error.message);
  if (t == 'clientes') cur = 'clientes';
  await load(); render(); toast('Excluído');
}

$('#lf').onsubmit = async e => {
  e.preventDefault();
  const { error } = await db.auth.signInWithPassword({ email: $('#em').value, password: $('#pw').value });
  if (error) return toast('E-mail ou senha incorretos');
  start();
};
async function start() {
  const { data } = await db.auth.getSession();
  $('#login').hidden = !!data.session; $('#app').hidden = !data.session;
  if (data.session) { await load(); const g = new URLSearchParams(location.search).get('go'); if (['venda', 'cobranca', 'fluxo', 'contas', 'historico', 'clientes', 'dash'].includes(g)) cur = g; render(); const nn = sgNovas().length; if (nn) setTimeout(() => toast('🔎 ' + nn + (nn == 1 ? ' nova procura' : ' novas procuras') + ' de clientes: ' + sgResumo()), 700); }
}
/* ===== APLICATIVO INSTALÁVEL ===== */
let INST = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); INST = e; if (cur == 'ajustes') render(); });
window.addEventListener('appinstalled', () => { INST = null; toast('App instalado! 🎉'); if (cur == 'ajustes') render(); });
const jaApp = () => window.matchMedia && (matchMedia('(display-mode: standalone)').matches || navigator.standalone);
async function instalar() {
  if (!INST) return toast('Use o menu do navegador: "Instalar app" (Android/Chrome) ou Compartilhar → Adicionar à Tela de Início (iPhone)');
  INST.prompt(); await INST.userChoice; INST = null; render();
}
function cardInstalar() {
  return `<div class="card"><h2>📲 Instalar como aplicativo</h2>${jaApp() ? '<small class="grn blk">Você já está usando o app instalado. ✅</small>'
    : `<small class="blk">Ganhe um ícone na tela do celular, abertura em tela cheia e carregamento mais rápido.</small>
    <button class="btn w" style="margin-top:8px" onclick="instalar()">Instalar app</button>
    <small class="blk" style="margin-top:8px"><b>iPhone:</b> Safari → Compartilhar → Adicionar à Tela de Início.<br><b>Android:</b> Chrome → menu ⋮ → Instalar app.</small>`}</div>`;
}
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
function sair() { db.auth.signOut().then(start); }
start();
