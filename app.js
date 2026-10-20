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
let S = { c: [], v: [], p: [], pr: [], pa: [], ct: [], pd: [] }, cur = 'inicio', curId = null;

function toast(m) { const t = $('#toast'); t.textContent = m; t.style.display = 'block'; setTimeout(() => t.style.display = 'none', 2800); }

async function load() {
  const [c, v, p, pr, pa, ct, pd] = await Promise.all([
    db.from('clientes').select('*').order('nome'),
    db.from('vendas').select('*, itens_venda(*)').order('data', { ascending: false }),
    db.from('pagamentos').select('*').order('criado_em', { ascending: false }),
    db.from('produtos').select('*').order('nome'),
    db.from('parcelas').select('*'),
    db.from('contas').select('*'),
    db.from('pedidos').select('*').eq('status', 'novo').order('criado_em', { ascending: false })
  ]);
  S = { c: c.data || [], v: v.data || [], p: p.data || [], pr: pr.data || [], pa: pa.data || [], ct: ct.data || [], pd: pd.data || [] };
}
function info(id) {
  const vs = S.v.filter(v => v.cliente_id == id), ps = S.p.filter(p => p.cliente_id == id);
  const t = sum(vs, v => v.total), p = sum(ps, x => x.valor);
  return { vs, ps, t, p, s: t - p };
}
function go(v, id, ed) { $('#side').classList.remove('open'); cur = v; curId = id || null; EDIT = ed || null; render(); window.scrollTo(0, 0); }
function render() {
  document.querySelectorAll('[data-nav]').forEach(b => b.classList.toggle('on', b.dataset.nav == cur || (cur == 'ficha' && b.dataset.nav == 'clientes')));
  $('#view').innerHTML = { inicio, vitrine, dash, clientes, venda, ficha, catalogo, relatorio, financeiro, historico, recebimentos, contas, ajustes, pedidos }[cur]();
  if (cur == 'inicio') vitInit();
  if (cur == 'vitrine') vtxt();
  if (cur == 'venda') iniciaVenda();
  const pb = $('#pbadge'); pb.textContent = S.pd.length || ''; pb.hidden = !S.pd.length;
}
function modal(h) { $('#modal').innerHTML = `<div class="bk" onclick="if(event.target==this)fecha()"><div class="sheet">${h}</div></div>`; }
function fecha() { $('#modal').innerHTML = ''; }

/* ===== INÍCIO: vitrine, recentes, voz e vitrine WhatsApp ===== */
let AUTO = null;
async function excluiVenda(id) {
  const v = S.v.find(x => x.id == id); if (!v) return;
  if (!confirm('Excluir esta venda de ' + R(v.total) + '? Os itens, as parcelas e os pagamentos dela também serão apagados. Não dá para desfazer.')) return;
  const { error } = await db.from('vendas').delete().eq('id', id);
  if (error) return toast('Erro: ' + error.message);
  EDIT = null; await load();
  if (cur == 'venda') go('ficha', v.cliente_id); else render();
  toast('Venda excluída');
}
let EDIT = null, PKEY = '', PDATES = [];
const planoForm = (f, resto, n) => plano(resto, n, f.venc.value).map((x, k) => ({ ...x, vencimento: PKEY == f.venc.value + '|' + n && PDATES[k] ? PDATES[k] : x.vencimento }));
function carregaEdicao() {
  const v = S.v.find(x => x.id == EDIT);
  if (!v) { EDIT = null; return go('inicio'); }
  const f = $('#view form');
  (v.itens_venda || []).forEach(t => { addItem(); fillRow($('#its').lastElementChild, { produto: t.produto, categoria: t.categoria, qtd: t.quantidade, preco: t.preco_unit }); });
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
  const rec = [...S.pr].sort((a, b) => new Date(b.criado_em || 0) - new Date(a.criado_em || 0)).slice(0, 6);
  return `${saudacao('Bem-vindo ao seu Dashboard.')}
  <div class="card"><h2>Sua Vitrine de Produtos - Clique para vender</h2>
  ${S.pr.length ? `<div class="car"><button class="arw l" onclick="rola(-1)">‹</button><div id="vit">${S.pr.map(cardProd).join('')}</div><button class="arw r" onclick="rola(1)">›</button></div><div id="dots"></div>`
      : '<p class="mut">Nenhum produto cadastrado ainda. <button class="lnk" onclick="go(\'catalogo\');formProd()">Cadastrar o primeiro produto</button></p>'}</div>
  <div class="card"><h2 class="up">Produtos recentes adicionados</h2>
  ${rec.length ? `<div class="rgrid">${rec.map(cardMini).join('')}</div>` : '<p class="mut">Os produtos que você cadastrar aparecem aqui.</p>'}</div>`;
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
  const top = Object.entries(its.reduce((o, t) => (o[t.produto] = (o[t.produto] || 0) + t.quantidade, o), {})).sort((a, b) => b[1] - a[1]).slice(0, 5);
  return `${saudacao('Bem-vindo ao seu Dashboard.')}
  <div class="kpis">
    <div class="card kpi"><small>VENDAS TOTAIS</small><b>${R(tv)}</b><small class="grn">${R(vm)} neste mês</small></div>
    <div class="card kpi"><small>PEDIDOS</small><b>${S.v.length}</b></div>
    <div class="card kpi"><small>CLIENTES</small><b>${S.c.length}</b></div>
    <div class="card kpi"><small>VALOR A RECEBER</small><b>${R(tv - rec)}</b></div>
    <div class="card kpi bad"><small>PARCELAS ATRASADAS</small><b>${at.length}</b><small>${R(sum(at, x => x.falta))}</small></div>
    <div class="card kpi"><small>ENTREGA PENDENTE</small><b>${S.v.filter(v => v.entregue === false).length}</b></div>
  </div>
  <div class="two"><div class="card"><h2>Resumo de vendas</h2><small>Últimos 7 meses</small>
    <div class="bars">${ms.map((x, i) => `<div class="col"><span>${vals[i] ? R(vals[i]).replace('R$', '').trim() : ''}</span><div class="fill"><i style="height:${vals[i] / mx * 100}%"></i></div><span>${x.l}</span></div>`).join('')}</div></div>
  <div><div class="card"><h2>Categorias populares</h2><div class="cats">${CATS.map(k => `<div><div class="cat" style="background:${CC[k]}">${IC[k]}</div><small class="blk">${k}</small><small class="blk">${Math.round(sum(its.filter(t => t.categoria == k), t => t.quantidade) / nq * 100)}%</small></div>`).join('')}</div></div>
  <div class="card"><h2>Mais vendidos</h2>${top.map(([n, q]) => `<div class="row"><small>${esc(n)}</small><b>${q} un.</b></div>`).join('') || '<small>Sem vendas ainda.</small>'}</div></div></div>
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
  ${i.ps.map(p => `<div class="card row"><span>${D(p.criado_em)}<small class="blk">${esc(p.forma)}</small></span><b class="grn">${R(p.valor)}</b><button class="lnk" onclick="del('pagamentos','${p.id}')">Excluir</button></div>`).join('') || '<p class="mut">Nenhum pagamento ainda.</p>'}`;
}

function formPag(id) {
  const s = info(id).s;
  modal(`<h2>Receber pagamento</h2><p class="mut">Saldo atual: ${R(s)}</p>
  <form onsubmit="salvaPag(event,'${id}')">
  <input class="inp" name="valor" type="number" step="0.01" min="0.01" inputmode="decimal" placeholder="Valor recebido (R$)" required>
  <select class="inp" name="forma">${opts(FORMAS)}</select>
  <button class="btn w">Registrar pagamento</button></form>`);
}
async function salvaPag(e, id) {
  e.preventDefault();
  const f = e.target;
  const { error } = await db.from('pagamentos').insert({ cliente_id: id, valor: +f.valor.value, forma: f.forma.value });
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
  $('#tot').textContent = R(t);
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
async function salvaVenda(e) {
  e.preventDefault();
  const f = e.target, q = (r, n) => r.querySelector(`[name=${n}]`).value;
  const itens = [...document.querySelectorAll('.it')].map(r => ({ produto: q(r, 'produto'), categoria: q(r, 'categoria'), quantidade: +q(r, 'quantidade'), preco_unit: +q(r, 'preco') }));
  if (!itens.length) return toast('Adicione ao menos um item');
  const total = calc(), pago = +f.pago.value || 0, cid = f.cliente_id.value;
  if (pago > total) return toast('O valor pago é maior que o total da venda');
  if (EDIT) return salvaEdicao(f, itens, total, pago);
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
  calc();
}

function catalogo() {
  return `<div class="row"><h1>Catálogo</h1><button class="btn" onclick="formProd()">+ Novo produto</button></div>
  <div class="card"><small>🔗 Link da vitrine para seus clientes</small><b class="blk" style="word-break:break-all">${LINK()}</b>
  <div class="row" style="margin-top:8px"><button class="btn" onclick="copiaLink()">Copiar link</button><a class="btn alt" target="_blank" href="https://wa.me/?text=${encodeURIComponent('Veja nosso catálogo: ' + LINK())}">Enviar no WhatsApp</a></div></div>
  ${CATS.map(k => { const l = S.pr.filter(p => p.categoria == k); return l.length ? `<h2>${k}</h2>` + l.map(p => `<div class="card row">${foto(p)}<b class="grow">${esc(p.nome)}<small class="blk">SKU: ${esc(skuDe(p))}</small></b><span>${R(p.preco)} <button class="lnk" onclick="formProd('${p.id}')">Editar</button> <button class="lnk" onclick="del('produtos','${p.id}')">Excluir</button></span></div>`).join('') : ''; }).join('')}
  ${S.pr.length ? '' : '<p class="mut">Catálogo vazio. Cadastre seus produtos para escolher na hora da venda.</p>'}`;
}
function formProd(id) {
  const p = S.pr.find(x => x.id == id) || {};
  modal(`<h2>${id ? 'Editar' : 'Novo'} produto</h2><form onsubmit="salvaProd(event,'${id || ''}')">
  <input class="inp" name="nome" placeholder="Nome do produto" value="${esc(p.nome)}" required>
  <input class="inp" name="sku" placeholder="Código SKU (vazio = gerar automático)" value="${esc(p.sku)}">
  <select class="inp" name="categoria">${opts(CATS)}</select>
  <input class="inp" name="preco" type="number" step="0.01" min="0" inputmode="decimal" placeholder="Preço (R$)" value="${p.preco ?? ''}" required>
  <label><small>Foto (opcional)</small><input class="inp" name="foto" type="file" accept="image/*"></label>
  <label class="row"><span>Mostrar na vitrine online</span><input type="checkbox" name="vitrine" ${p.vitrine === false ? '' : 'checked'}></label>
  <button class="btn w">Salvar produto</button></form>`);
  if (p.categoria) document.querySelector('#modal [name=categoria]').value = p.categoria;
}
async function salvaProd(e, id) {
  e.preventDefault();
  const fd = new FormData(e.target), d = { nome: fd.get('nome'), categoria: fd.get('categoria'), preco: +fd.get('preco'), vitrine: fd.get('vitrine') == 'on', sku: (fd.get('sku') || '').trim() || skuNovo(fd.get('categoria')) };
  const file = fd.get('foto'); if (file && file.size) d.foto = await redim(file);
  const { error } = id ? await db.from('produtos').update(d).eq('id', id) : await db.from('produtos').insert(d);
  if (error) return toast('Erro: ' + error.message);
  fecha(); await load(); render(); toast('Produto salvo');
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
  <h2>Quanto vou receber por mês</h2><small>Parcelas por mês de vencimento. Toque no mês para ver quem paga.</small>${previsao()}
  <h2>Produtos mais vendidos</h2>${top.map(([n, q]) => `<div class="card row"><span>${esc(n)}</span><b>${q} un.</b></div>`).join('') || '<p class="mut">Sem vendas neste filtro.</p>'}
  <h2>Por categoria</h2>${cat.map(([k, t]) => `<div class="card row"><span>${k}</span><b>${R(t)}</b></div>`).join('')}
  <h2>Vendas (${vs.length})</h2>
  ${vs.map(v => { const c = S.c.find(x => x.id == v.cliente_id) || {}; return `<div class="card"><div class="row"><b>${D(v.data)}</b><b>${R(v.total)}</b></div><button class="lnk" onclick="go('ficha','${v.cliente_id}')">${esc(c.nome)}</button><small class="blk">${v.itens_venda.map(t => t.quantidade + '× ' + esc(t.produto)).join(', ')}</small></div>`; }).join('') || '<p class="mut">Nenhuma venda neste filtro.</p>'}`;
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
  const saldo = recebido - saidas;
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
<h2>Vendas por categoria</h2>
${tb(['Categoria', 'Unidades', 'Total'], CATS.map(k => { const l = itens.filter(t => t.categoria == k); return [k, sum(l, t => t.quantidade), R(sum(l, t => t.quantidade * t.preco_unit))]; }))}
<h2>Produtos mais vendidos</h2>
${tb(['Produto', 'Unidades'], top.map(([n, q]) => [esc(n), q]))}
<h2>Previsão de recebimento por mês</h2>
${tb(['Mês', 'Parcelas', 'Valor total', 'Falta receber'], prev)}
<h2>Parcelas em atraso</h2>
${tb(['Cliente', 'Parcela', 'Vencimento', 'Falta receber'], atras.sort((a, b) => a.vencimento < b.vencimento ? -1 : 1).map(x => [esc(x.c.nome), x.numero + 'ª', dt(x.vencimento), R(x.falta)]))}
<h2>Recebimentos no período</h2>
${tb(['Data', 'Cliente', 'Forma', 'Valor'], ps.map(p => [new Date(p.criado_em).toLocaleDateString('pt-BR'), nome(p.cliente_id), esc(p.forma || '—'), R(p.valor)]))}
${F.cli ? '' : `<h2>Contas a pagar</h2>
${tb(['Descrição', 'Vencimento', 'Valor', 'Situação'], [...cts].sort((a, b) => a.vencimento < b.vencimento ? -1 : 1).map(x => [esc(x.descricao), dt(x.vencimento), R(x.valor), st(x.pago ? 'Pago' : (x.vencimento < HOJE ? 'Atrasado' : 'A vencer'))]))}`}
<h2>Vendas detalhadas (${vs.length})</h2>
${tb(['Data', 'Cliente', 'Itens', 'Total', 'Situação'], vs.map(v => [new Date(v.data).toLocaleDateString('pt-BR'), nome(v.cliente_id), v.itens_venda.map(t => t.quantidade + '× ' + esc(t.produto)).join(', '), R(v.total), st(stVenda(v))]))}
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
  let pool = sum(S.p.filter(p => p.cliente_id == cid && !p.venda_id), p => p.valor);
  return S.pa.filter(x => x.cliente_id == cid).sort((a, b) => a.vencimento < b.vencimento ? -1 : 1).map(x => {
    const v = Number(x.valor), pg = Math.min(pool, v); pool -= pg;
    return { ...x, falta: v - pg, st: v - pg < 0.005 ? 'Paga' : x.vencimento < HOJE ? 'Atrasada' : 'A vencer' };
  });
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
  return `<h1>Financeiro</h1><p class="mut">Parcelas em aberto: ${t.length} · ${R(sum(t, x => x.falta))}</p>${t.map(parcRow).join('') || '<p class="mut">Nenhuma parcela em aberto.</p>'}`;
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
  <select class="inp" onchange="H.st=this.value;histRes()">${['', 'Pago', 'Pendente', 'Atrasado'].map(x => `<option value="${x}" ${H.st == x ? 'selected' : ''}>${x || 'Todos os status'}</option>`).join('')}</select></div><div id="hist">${histRes(1)}</div>`;
}
function histRes(r) {
  const l = S.v.filter(v => (S.c.find(c => c.id == v.cliente_id) || {}).nome?.toLowerCase().includes(H.q.toLowerCase()) && (!H.st || stVenda(v) == H.st));
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
    (l.map(p => `<div class="card row"><span><b>${cn(p.cliente_id)}</b><small class="blk">${D(p.criado_em)} · ${esc(p.forma)}</small></span><b class="grn">${R(p.valor)}</b></div>`).join('') || '<p class="mut">Nenhum recebimento neste mês.</p>');
  if (r) return h;
  $('#rec').innerHTML = h;
}

function contas() {
  const l = [...S.ct].sort((a, b) => a.vencimento < b.vencimento ? -1 : 1), mm = mes(new Date());
  const saldo = sum(S.p.filter(p => mes(p.criado_em) == mm), p => p.valor) - sum(S.ct.filter(x => x.pago && mes(x.pago_em) == mm), x => x.valor);
  return `<div class="row"><h1>Contas a pagar</h1><button class="btn" onclick="formConta()">+ Nova conta</button></div>
  <div class="grid"><div class="card"><small>Em aberto</small><b class="blk red">${R(sum(l.filter(x => !x.pago), x => x.valor))}</b></div>
  <div class="card"><small>Saldo do mês (recebido − contas pagas)</small><b class="blk ${saldo >= 0 ? 'grn' : 'red'}">${R(saldo)}</b></div></div>
  ${l.map(x => `<div class="card row"><span><b>${esc(x.descricao)}</b><small class="blk">vence ${dt(x.vencimento)}</small></span><span>${R(x.valor)} ${x.pago ? tag('Pago') : tag(x.vencimento < HOJE ? 'Atrasado' : 'A vencer')}
    ${x.pago ? '' : `<button class="lnk" onclick="pagaConta('${x.id}')">Dar baixa</button>`}<button class="lnk red" onclick="del('contas','${x.id}')">Excluir</button></span></div>`).join('') || '<p class="mut">Nenhuma conta cadastrada.</p>'}`;
}
function formConta() {
  modal(`<h2>Nova conta a pagar</h2><form onsubmit="salvaConta(event)">
  <input class="inp" name="descricao" placeholder="Descrição (ex: fornecedor, aluguel)" required>
  <input class="inp" name="valor" type="number" step="0.01" min="0.01" inputmode="decimal" placeholder="Valor (R$)" required>
  <label><small>Vencimento</small><input class="inp" name="vencimento" type="date" value="${HOJE}" required></label>
  <button class="btn w">Salvar conta</button></form>`);
}
async function salvaConta(e) {
  e.preventDefault();
  const d = Object.fromEntries(new FormData(e.target)); d.valor = +d.valor;
  const { error } = await db.from('contas').insert(d);
  if (error) return toast('Erro: ' + error.message);
  fecha(); await load(); render(); toast('Conta salva');
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
}
function iniciaVenda() {
  PKEY = ''; PDATES = [];
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
  if (data.session) { await load(); render(); }
}
function sair() { db.auth.signOut().then(start); }
start();
