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
let S = { c: [], v: [], p: [], pr: [], pa: [] }, cur = 'dash', curId = null;

function toast(m) { const t = $('#toast'); t.textContent = m; t.style.display = 'block'; setTimeout(() => t.style.display = 'none', 2800); }

async function load() {
  const [c, v, p, pr, pa] = await Promise.all([
    db.from('clientes').select('*').order('nome'),
    db.from('vendas').select('*, itens_venda(*)').order('data', { ascending: false }),
    db.from('pagamentos').select('*').order('criado_em', { ascending: false }),
    db.from('produtos').select('*').order('nome'),
    db.from('parcelas').select('*')
  ]);
  S = { c: c.data || [], v: v.data || [], p: p.data || [], pr: pr.data || [], pa: pa.data || [] };
}
function info(id) {
  const vs = S.v.filter(v => v.cliente_id == id), ps = S.p.filter(p => p.cliente_id == id);
  const t = sum(vs, v => v.total), p = sum(ps, x => x.valor);
  return { vs, ps, t, p, s: t - p };
}
function go(v, id) { cur = v; curId = id || null; render(); window.scrollTo(0, 0); }
function render() {
  document.querySelectorAll('[data-nav]').forEach(b => b.classList.toggle('on', b.dataset.nav == cur || (cur == 'ficha' && b.dataset.nav == 'clientes')));
  $('#view').innerHTML = { dash, clientes, venda, ficha, catalogo, relatorio, financeiro }[cur]();
  if (cur == 'venda') { addItem(); calc(); }
}
function modal(h) { $('#modal').innerHTML = `<div class="bk" onclick="if(event.target==this)fecha()"><div class="sheet">${h}</div></div>`; }
function fecha() { $('#modal').innerHTML = ''; }

function dash() {
  const m = mes(new Date()), at = todasParc().filter(x => x.st == 'Atrasada').sort((a, b) => a.vencimento < b.vencimento ? -1 : 1);
  const tv = sum(S.v, v => v.total), rec = sum(S.p, p => p.valor), vm = sum(S.v.filter(v => mes(v.data) == m), v => v.total);
  const ms = [...Array(7)].map((_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 6 + i); return { k: mes(d), l: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '') }; });
  const vals = ms.map(x => sum(S.v.filter(v => mes(v.data) == x.k), v => v.total)), mx = Math.max(...vals, 1);
  const its = S.v.flatMap(v => v.itens_venda), nq = sum(its, i => i.quantidade) || 1;
  const top = Object.entries(its.reduce((o, t) => (o[t.produto] = (o[t.produto] || 0) + t.quantidade, o), {})).sort((a, b) => b[1] - a[1]).slice(0, 5);
  return `<h1>Olá, Rozivaldo!</h1><p class="mut">Bem-vindo ao seu Dashboard.</p>
  <div class="kpis">
    <div class="card kpi"><small>VENDAS TOTAIS</small><b>${R(tv)}</b><small class="grn">${R(vm)} neste mês</small></div>
    <div class="card kpi"><small>PEDIDOS</small><b>${S.v.length}</b></div>
    <div class="card kpi"><small>CLIENTES</small><b>${S.c.length}</b></div>
    <div class="card kpi"><small>VALOR A RECEBER</small><b>${R(tv - rec)}</b></div>
    <div class="card kpi bad"><small>PARCELAS ATRASADAS</small><b>${at.length}</b><small>${R(sum(at, x => x.falta))}</small></div>
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
  <h2>Parcelas</h2>${parc(c.id).map(x => `<div class="card row"><b>${x.numero}ª · vence ${dt(x.vencimento)}</b><span>${R(x.valor)} ${tag(x.st)}</span></div>`).join('') || '<p class="mut">Sem parcelas.</p>'}
  <h2>Compras</h2>
  ${i.vs.map(v => `<div class="card"><div class="row"><b>${D(v.data)}</b><b>${R(v.total)}</b></div>
    ${(v.itens_venda || []).map(t => `<small class="blk">${t.quantidade}× ${esc(t.produto)} (${t.categoria}) — ${R(t.preco_unit)}</small>`).join('')}
    <div class="row"><button class="lnk" onclick="zapVenda('${v.id}')">Enviar no WhatsApp</button><button class="lnk" onclick="del('vendas','${v.id}')">Excluir venda</button></div></div>`).join('') || '<p class="mut">Nenhuma compra ainda.</p>'}
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
  return `<h1>Nova venda</h1><form onsubmit="salvaVenda(event)">
  <select class="inp" name="cliente_id" required><option value="">Escolha o cliente</option>${S.c.map(c => `<option value="${c.id}" ${c.id == curId ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}</select>
  <div id="its"></div>
  <button type="button" class="btn alt" onclick="addItem()">+ Adicionar item</button>
  <div class="card row"><span>Total da venda</span><b id="tot">R$ 0,00</b></div>
  <input class="inp" name="pago" type="number" step="0.01" min="0" inputmode="decimal" placeholder="Valor pago agora (deixe vazio se for fiado)" oninput="calc()">
  <select class="inp" name="forma">${opts(FORMAS)}</select>
  <div class="grid"><label><small>Nº de parcelas</small><input class="inp" name="np" type="number" min="1" max="24" value="1" oninput="calc()"></label><label><small>1º vencimento</small><input class="inp" name="venc" type="date" value="${proxDia5()}" oninput="calc()" required></label></div>
  <div class="card" id="prev"></div>
  <button class="btn w">Registrar venda</button></form>`;
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
    $('#prev').innerHTML = resto > 0.005 && f.venc.value ? `<b>${n}× de ${R(resto / n)}</b><small class="blk">Vencimentos: ${plano(resto, n, f.venc.value).map(x => dt(x.vencimento)).join(' · ')}</small>` : t > 0 ? '<small>Pago à vista, sem parcelas.</small>' : '';
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
  const { data: v, error } = await db.from('vendas').insert({ cliente_id: cid, total }).select().single();
  if (error) return toast('Erro: ' + error.message);
  const r1 = await db.from('itens_venda').insert(itens.map(x => ({ ...x, venda_id: v.id })));
  if (r1.error) { await db.from('vendas').delete().eq('id', v.id); return toast('Erro: ' + r1.error.message); }
  if (pago > 0) await db.from('pagamentos').insert({ cliente_id: cid, venda_id: v.id, valor: pago, forma: f.forma.value });
  const resto = total - pago;
  if (resto > 0.005) {
    const n = Math.max(1, Math.min(24, +f.np.value || 1));
    await db.from('parcelas').insert(plano(resto, n, f.venc.value).map(x => ({ ...x, venda_id: v.id, cliente_id: cid })));
  }
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
  ${CATS.map(k => { const l = S.pr.filter(p => p.categoria == k); return l.length ? `<h2>${k}</h2>` + l.map(p => `<div class="card row">${foto(p)}<b class="grow">${esc(p.nome)}</b><span>${R(p.preco)} <button class="lnk" onclick="formProd('${p.id}')">Editar</button> <button class="lnk" onclick="del('produtos','${p.id}')">Excluir</button></span></div>`).join('') : ''; }).join('')}
  ${S.pr.length ? '' : '<p class="mut">Catálogo vazio. Cadastre seus produtos para escolher na hora da venda.</p>'}`;
}
function formProd(id) {
  const p = S.pr.find(x => x.id == id) || {};
  modal(`<h2>${id ? 'Editar' : 'Novo'} produto</h2><form onsubmit="salvaProd(event,'${id || ''}')">
  <input class="inp" name="nome" placeholder="Nome do produto" value="${esc(p.nome)}" required>
  <select class="inp" name="categoria">${opts(CATS)}</select>
  <input class="inp" name="preco" type="number" step="0.01" min="0" inputmode="decimal" placeholder="Preço (R$)" value="${p.preco ?? ''}" required>
  <label><small>Foto (opcional)</small><input class="inp" name="foto" type="file" accept="image/*"></label>
  <button class="btn w">Salvar produto</button></form>`);
  if (p.categoria) document.querySelector('#modal [name=categoria]').value = p.categoria;
}
async function salvaProd(e, id) {
  e.preventDefault();
  const fd = new FormData(e.target), d = { nome: fd.get('nome'), categoria: fd.get('categoria'), preco: +fd.get('preco') };
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
  return `<h1>Relatórios</h1>
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
  <div class="row"><h2>Vendas (${vs.length})</h2><button class="btn alt" onclick="csv()">Baixar planilha</button></div>
  ${vs.map(v => { const c = S.c.find(x => x.id == v.cliente_id) || {}; return `<div class="card"><div class="row"><b>${D(v.data)}</b><b>${R(v.total)}</b></div><button class="lnk" onclick="go('ficha','${v.cliente_id}')">${esc(c.nome)}</button><small class="blk">${v.itens_venda.map(t => t.quantidade + '× ' + esc(t.produto)).join(', ')}</small></div>`; }).join('') || '<p class="mut">Nenhuma venda neste filtro.</p>'}`;
  if (ret) return h;
  $('#rel').innerHTML = h;
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
  return `<div class="card row"><span><button class="lnk" onclick="go('ficha','${x.c.id}')">${esc(x.c.nome)}</button><small class="blk">${x.numero}ª parcela · vence ${dt(x.vencimento)}</small></span><span>${R(x.falta)} ${tag(x.st)} ${x.c.telefone ? `<a class="lnk" target="_blank" href="${zapLink(x.c, msg)}">Cobrar</a>` : ''}</span></div>`;
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
