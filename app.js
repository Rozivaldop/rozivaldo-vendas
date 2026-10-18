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
let S = { c: [], v: [], p: [] }, cur = 'dash', curId = null;

function toast(m) { const t = $('#toast'); t.textContent = m; t.style.display = 'block'; setTimeout(() => t.style.display = 'none', 2800); }

async function load() {
  const [c, v, p] = await Promise.all([
    db.from('clientes').select('*').order('nome'),
    db.from('vendas').select('*, itens_venda(*)').order('data', { ascending: false }),
    db.from('pagamentos').select('*').order('criado_em', { ascending: false })
  ]);
  S = { c: c.data || [], v: v.data || [], p: p.data || [] };
}
function info(id) {
  const vs = S.v.filter(v => v.cliente_id == id), ps = S.p.filter(p => p.cliente_id == id);
  const t = sum(vs, v => v.total), p = sum(ps, x => x.valor);
  return { vs, ps, t, p, s: t - p };
}
function go(v, id) { cur = v; curId = id || null; render(); window.scrollTo(0, 0); }
function render() {
  document.querySelectorAll('[data-nav]').forEach(b => b.classList.toggle('on', b.dataset.nav == cur || (cur == 'ficha' && b.dataset.nav == 'clientes')));
  $('#view').innerHTML = { dash, clientes, venda, ficha }[cur]();
  if (cur == 'venda') addItem();
}
function modal(h) { $('#modal').innerHTML = `<div class="bk" onclick="if(event.target==this)fecha()"><div class="sheet">${h}</div></div>`; }
function fecha() { $('#modal').innerHTML = ''; }

function dash() {
  const m = mes(new Date());
  const vm = sum(S.v.filter(v => mes(v.data) == m), v => v.total);
  const rm = sum(S.p.filter(p => mes(p.criado_em) == m), p => p.valor);
  const tv = sum(S.v, v => v.total), tr = sum(S.p, p => p.valor);
  const dev = S.c.map(c => ({ c, s: info(c.id).s })).filter(x => x.s > 0.005).sort((a, b) => b.s - a.s);
  return `<h1>Rozivaldo Vendas</h1>
  <div class="grid">
    <div class="card"><small>Vendido no mês</small><b class="blk">${R(vm)}</b></div>
    <div class="card"><small>Recebido no mês</small><b class="blk grn">${R(rm)}</b></div>
    <div class="card"><small>Vendido no geral</small><b class="blk">${R(tv)}</b></div>
    <div class="card"><small>Recebido no geral</small><b class="blk grn">${R(tr)}</b></div>
    <div class="card w2"><small>Total a receber</small><b class="blk big red">${R(tv - tr)}</b></div>
  </div>
  <h2>Clientes com débito (${dev.length})</h2>
  ${dev.map(x => `<button class="item" onclick="go('ficha','${x.c.id}')"><span><b>${esc(x.c.nome)}</b><small class="blk">${esc(x.c.telefone)}</small></span><b class="red">${R(x.s)}</b></button>`).join('') || '<p class="mut">Ninguém devendo. 🎉</p>'}`;
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

function formCliente() {
  modal(`<h2>Novo cliente</h2><form onsubmit="salvaCliente(event)">
  <input class="inp" name="nome" placeholder="Nome" required>
  <input class="inp" name="telefone" placeholder="Telefone / WhatsApp (com DDD)">
  <input class="inp" name="endereco" placeholder="Endereço">
  <textarea class="inp" name="observacoes" placeholder="Observações"></textarea>
  <button class="btn w">Salvar cliente</button></form>`);
}
async function salvaCliente(e) {
  e.preventDefault();
  const { data, error } = await db.from('clientes').insert(Object.fromEntries(new FormData(e.target))).select().single();
  if (error) return toast('Erro: ' + error.message);
  fecha(); await load(); toast('Cliente salvo'); go('ficha', data.id);
}

function ficha() {
  const c = S.c.find(x => x.id == curId);
  if (!c) return clientes();
  const i = info(c.id), wa = (c.telefone || '').replace(/\D/g, ''), dev = i.s > 0.005;
  return `<button class="mut" onclick="go('clientes')">← Clientes</button>
  <h1>${esc(c.nome)}</h1>
  <p class="mut">${esc(c.telefone)} ${wa ? `<a class="lnk" target="_blank" href="https://wa.me/55${wa}">Abrir WhatsApp</a>` : ''}<br>${esc(c.endereco)}<br>${esc(c.observacoes)}</p>
  <div class="grid">
    <div class="card"><small>Total comprado</small><b class="blk">${R(i.t)}</b></div>
    <div class="card"><small>Total pago</small><b class="blk grn">${R(i.p)}</b></div>
    <div class="card w2"><small>Saldo devedor</small><b class="blk big ${dev ? 'red' : 'grn'}">${R(i.s)}</b></div>
  </div>
  <div class="row" style="margin-top:12px"><button class="btn" onclick="formPag('${c.id}')">Receber pagamento</button><button class="btn alt" onclick="go('venda','${c.id}')">Nova venda</button></div>
  <h2>Compras</h2>
  ${i.vs.map(v => `<div class="card"><div class="row"><b>${D(v.data)}</b><b>${R(v.total)}</b></div>
    ${(v.itens_venda || []).map(t => `<small class="blk">${t.quantidade}× ${esc(t.produto)} (${t.categoria}) — ${R(t.preco_unit)}</small>`).join('')}
    <button class="lnk" onclick="del('vendas','${v.id}')">Excluir venda</button></div>`).join('') || '<p class="mut">Nenhuma compra ainda.</p>'}
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
  <input class="inp" name="pago" type="number" step="0.01" min="0" inputmode="decimal" placeholder="Valor pago agora (deixe vazio se for fiado)">
  <select class="inp" name="forma">${opts(FORMAS)}</select>
  <button class="btn w">Registrar venda</button></form>`;
}
function addItem() {
  const d = document.createElement('div');
  d.className = 'card it';
  d.innerHTML = `<input class="inp" name="produto" placeholder="Produto" required>
  <div class="grid3"><select class="inp" name="categoria">${opts(CATS)}</select>
  <input class="inp" name="quantidade" type="number" min="1" value="1" oninput="calc()">
  <input class="inp" name="preco" type="number" step="0.01" min="0" inputmode="decimal" placeholder="Preço un." oninput="calc()" required></div>
  <button type="button" class="lnk" onclick="this.parentNode.remove();calc()">Remover item</button>`;
  $('#its').append(d);
}
function calc() {
  let t = 0;
  document.querySelectorAll('.it').forEach(r => t += r.querySelector('[name=quantidade]').value * r.querySelector('[name=preco]').value);
  $('#tot').textContent = R(t);
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
  await load(); toast('Venda registrada'); go('ficha', cid);
}

async function del(t, id) {
  if (!confirm('Excluir este registro? Não dá para desfazer.')) return;
  const { error } = await db.from(t).delete().eq('id', id);
  if (error) return toast('Erro: ' + error.message);
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
