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
let S = { c: [], v: [], p: [], pr: [], pa: [], ct: [], pd: [], pt: [], sg: [], sc: [], mc: [], nf: [], an: [], cfg: {}, et: [] }, cur = 'inicio', curId = null;

function toast(m) { const t = $('#toast'); t.textContent = m; t.style.display = 'block'; setTimeout(() => t.style.display = 'none', 2800); }

async function load() {
  const [c, v, p, pr, pa, ct, pd, sg, sc, mc, nf, an, cf, et] = await Promise.all([
    db.from('clientes').select('*').order('nome'),
    db.from('vendas').select('*, itens_venda(*)').order('data', { ascending: false }),
    db.from('pagamentos').select('*').order('criado_em', { ascending: false }),
    db.from('produtos').select('*').order('nome'),
    db.from('parcelas').select('*'),
    db.from('contas').select('*'),
    db.from('pedidos').select('*').order('criado_em', { ascending: false }).limit(300),
    db.from('sugestoes').select('*').order('criado_em', { ascending: false }),
    db.from('subcategorias').select('*').order('nome'),
    db.from('marcas').select('*').order('nome'),
    db.from('notas').select('*').order('data_compra', { ascending: false }).limit(500),
    db.from('anuncios').select('*').order('ordem'),
    db.from('configuracoes').select('*'),
    db.from('etapas_pedido').select('*').order('ordem')
  ]);
  S = { c: c.data || [], v: v.data || [], p: p.data || [], pr: pr.data || [], pa: pa.data || [], ct: ct.data || [], pt: pd.data || [], pd: (pd.data || []).filter(p => p.status == 'novo'), sg: sg.data || [], sc: sc.data || [], mc: mc.data || [], nf: nf.data || [], an: an.data || [], cfg: Object.fromEntries((cf.data || []).map(x => [x.chave, x.valor])), et: et.data || [] };
}
function info(id) {
  const vs = S.v.filter(v => v.cliente_id == id), ps = S.p.filter(p => p.cliente_id == id);
  const t = sum(vs, v => v.total), p = sum(ps, x => x.valor);
  return { vs, ps, t, p, s: t - p };
}
function go(v, id, ed) { $('#side').classList.remove('open'); cur = v; curId = id || null; EDIT = ed || null; render(); window.scrollTo(0, 0); }
function render() {
  document.querySelectorAll('[data-nav]').forEach(b => b.classList.toggle('on', b.dataset.nav == cur || (cur == 'ficha' && b.dataset.nav == 'clientes')));
  $('#view').innerHTML = { inicio, vitrine, anuncios, notas, procuras, cobranca, fluxo, dash, clientes, venda, ficha, catalogo, relatorio, financeiro, historico, recebimentos, contas, ajustes, pedidos }[cur]();
  if (cur == 'inicio') vitInit();
  if (cur == 'vitrine') vtxt();
  if (cur == 'venda') iniciaVenda();
  const nn = sgPend().length, nu = nfUrgentes().length, tt = S.pd.length + nn + nu, pb = $('#pbadge'), sb = $('#sbadge'); pb.textContent = tt || ''; pb.hidden = !tt; if (sb) { sb.textContent = nn || ''; sb.hidden = !nn; } const nfb = $('#nfbadge'); if (nfb) { nfb.textContent = nu || ''; nfb.hidden = !nu; } const pdb = $('#pdbadge'); if (pdb) { pdb.textContent = S.pd.length || ''; pdb.hidden = !S.pd.length; }
}
function modal(h) { $('#modal').innerHTML = `<div class="bk" onclick="if(event.target==this)fecha()"><div class="sheet">${h}</div></div>`; }
function fecha() { PREPROD = null; $('#modal').innerHTML = ''; }

/* ===== INÍCIO: vitrine, recentes, voz e vitrine WhatsApp ===== */
let AUTO = null;
/* ===== CATÁLOGO VIRTUAL: anúncios, textos/contatos e etapas do pedido ===== */
const cfgGet = (k, d = '') => { const v = (S.cfg || {})[k]; return v == null ? d : v; };
const semTabela = e => e && /Could not find the table|relation .* does not exist|schema cache/i.test(e.message || '') ? 'Falta rodar o arquivo atualizacao-catalogo-virtual.sql no Supabase (SQL Editor).' : (e ? e.message : '');
function anSit(a) {
  if (!a.ativo) return ['Pausado', '']; if (a.inicio && HOJE < a.inicio) return ['Agendado', 'wait']; if (a.fim && HOJE > a.fim) return ['Encerrado', ''];
  return ['No ar', 'ok'];
}
function anDestino(a) {
  const v = a.link_valor || '';
  return { marca: 'Marca: ' + ((S.mc.find(m => m.id == v) || {}).nome || '—'), categoria: 'Categoria: ' + v, subcategoria: 'Categoria: ' + v.replace('|', ' › '), produto: 'Produto: ' + ((S.pr.find(p => p.id == v) || {}).nome || '—'), busca: 'Busca: “' + v + '”', url: 'Link: ' + v }[a.link_tipo] || 'Sem destino (só informativo)';
}
const anSlide = a => `<div class="anp" style="background:${esc(a.cor_fundo || '#111111')};color:${esc(a.cor_texto || '#ffffff')}">${a.imagem ? `<img src="${a.imagem}" alt="">` : ''}<div class="anpt"><b>${esc(a.titulo || 'Título do anúncio')}</b>${a.subtitulo ? `<span>${esc(a.subtitulo)}</span>` : ''}${a.link_tipo && a.link_tipo != 'nenhum' ? `<em style="background:${esc(a.cor_texto || '#ffffff')};color:${esc(a.cor_fundo || '#111111')}">${esc(a.texto_botao || 'Ver agora')}</em>` : ''}</div></div>`;
function anuncios() {
  const l = [...(S.an || [])].sort((a, b) => a.ordem - b.ordem);
  return `<div class="row"><h1>Anúncios do catálogo</h1><button class="btn" onclick="formAn()">+ Novo anúncio</button></div>
  <p class="mut">Banners que aparecem no topo do catálogo do cliente. Ao tocar, o cliente vai para a marca, categoria, produto, busca ou link que você escolher. Promoções (Black Friday, liquidação...) entram aqui, e você liga e desliga quando quiser.</p>
  ${l.map((a, i) => { const [t, c] = anSit(a); return `<div class="card">${anSlide(a)}<div class="row" style="margin-top:8px"><span><em class="tag ${c}">${t}</em> <small>${esc(anDestino(a))}</small>${a.inicio || a.fim ? `<small class="blk">${a.inicio ? 'de ' + dt(a.inicio) + ' ' : ''}${a.fim ? 'até ' + dt(a.fim) : ''}</small>` : ''}</span>
    <span><button class="lnk" onclick="anMove('${a.id}',-1)" ${i == 0 ? 'disabled' : ''}>↑</button><button class="lnk" onclick="anMove('${a.id}',1)" ${i == l.length - 1 ? 'disabled' : ''}>↓</button><button class="lnk" onclick="anAtivo('${a.id}')">${a.ativo ? 'Pausar' : 'Ativar'}</button><button class="lnk" onclick="formAn('${a.id}')">Editar</button><button class="lnk red" onclick="anExclui('${a.id}')">Excluir</button></span></div></div>`; }).join('') || '<p class="mut">Nenhum anúncio ainda. O catálogo mostra um banner padrão até você criar o primeiro.</p>'}`;
}
let ANIMG = null;
function formAn(id) {
  const a = id ? S.an.find(x => x.id == id) : { cor_fundo: '#111111', cor_texto: '#ffffff', ativo: true, link_tipo: 'nenhum', texto_botao: 'Ver agora' };
  if (!a) return; ANIMG = a.imagem || null;
  modal(`<h2>${id ? 'Editar' : 'Novo'} anúncio</h2><div id="anprev"></div>
  <form id="anf" onsubmit="salvaAn(event,'${id || ''}')">
  <input class="inp" name="titulo" maxlength="80" placeholder="Título (ex: Black Friday Rozivaldo)" value="${esc(a.titulo)}" required oninput="anPrev()">
  <input class="inp" name="subtitulo" maxlength="140" placeholder="Subtítulo (opcional)" value="${esc(a.subtitulo)}" oninput="anPrev()">
  <input class="inp" name="texto_botao" maxlength="30" placeholder="Texto do botão (ex: Ver ofertas)" value="${esc(a.texto_botao)}" oninput="anPrev()">
  <div class="card"><small>🖼️ Imagem do anúncio (opcional, formato horizontal)</small><div class="row" style="margin-top:6px"><label class="btn alt">Escolher imagem<input type="file" accept="image/*" hidden onchange="anImg(this)"></label><button type="button" class="lnk red" onclick="ANIMG=null;anPrev()">Remover imagem</button></div></div>
  <div class="row" style="justify-content:flex-start;gap:18px"><label><small>Cor de fundo</small><br><input type="color" name="cor_fundo" value="${esc(a.cor_fundo || '#111111')}" oninput="anPrev()"></label><label><small>Cor do texto</small><br><input type="color" name="cor_texto" value="${esc(a.cor_texto || '#ffffff')}" oninput="anPrev()"></label></div>
  <small>Para onde o cliente vai ao tocar no anúncio?</small>
  <select class="inp" name="link_tipo" onchange="anTipo();anPrev()">${[['nenhum', 'Ninguém (só informativo)'], ['marca', 'Uma marca'], ['categoria', 'Uma categoria (área)'], ['subcategoria', 'Uma subcategoria'], ['produto', 'Um produto'], ['busca', 'Uma busca'], ['url', 'Link externo']].map(([v, t]) => `<option value="${v}" ${a.link_tipo == v ? 'selected' : ''}>${t}</option>`).join('')}</select>
  <div id="anv"></div>
  <div class="row"><label style="flex:1"><small>Começa em (opcional)</small><input class="inp" type="date" name="inicio" value="${a.inicio || ''}"></label><label style="flex:1"><small>Termina em (opcional)</small><input class="inp" type="date" name="fim" value="${a.fim || ''}"></label></div>
  <label class="card row"><span>No ar (ativo)</span><input type="checkbox" name="ativo" ${a.ativo ? 'checked' : ''}></label>
  <button class="btn w">Salvar anúncio</button><button type="button" class="btn alt w" style="margin-top:8px" onclick="fecha()">Cancelar</button></form>`);
  anTipo(a.link_valor); anPrev();
}
function anTipo(val) {
  const f = $('#anf'), t = f.link_tipo.value, v = $('#anv'), sel = x => (val != null && String(val) == String(x) ? 'selected' : '');
  v.innerHTML = { nenhum: '',
    marca: `<select class="inp" name="lval">${S.mc.map(m => `<option value="${m.id}" ${sel(m.id)}>${esc(m.nome)}</option>`).join('')}</select>`,
    categoria: `<select class="inp" name="lval">${CATS.map(k => `<option ${sel(k)}>${k}</option>`).join('')}</select>`,
    subcategoria: `<select class="inp" name="lval">${S.sc.map(s => `<option value="${esc(s.area + '|' + s.nome)}" ${sel(s.area + '|' + s.nome)}>${esc(s.area)} › ${esc(s.nome)}</option>`).join('')}</select>`,
    produto: `<select class="inp" name="lval">${[...S.pr].sort((a, b) => a.nome.localeCompare(b.nome)).map(p => `<option value="${p.id}" ${sel(p.id)}>${esc(p.nome)}</option>`).join('')}</select>`,
    busca: `<input class="inp" name="lval" maxlength="60" placeholder="O que buscar (ex: camisa polo)" value="${esc(val || '')}">`,
    url: `<input class="inp" name="lval" type="url" maxlength="300" placeholder="https://..." value="${esc(val || '')}">` }[t] || '';
}
function anPrev() {
  const f = $('#anf'), p = $('#anprev'); if (!f || !p) return;
  p.innerHTML = anSlide({ titulo: f.titulo.value, subtitulo: f.subtitulo.value, texto_botao: f.texto_botao.value, cor_fundo: f.cor_fundo.value, cor_texto: f.cor_texto.value, imagem: ANIMG, link_tipo: f.link_tipo.value });
}
async function anImg(inp) {
  const f = inp.files[0]; inp.value = ''; if (!f) return;
  try { ANIMG = await redimN(await fileUrl(f), 1600, 0.82); } catch (e) { return toast('Não consegui ler essa imagem'); }
  anPrev();
}
async function salvaAn(e, id) {
  e.preventDefault();
  const f = e.target, tipo = f.link_tipo.value, val = f.lval ? String(f.lval.value || '').trim() : '';
  if (tipo != 'nenhum' && !val) return toast('Escolha para onde o anúncio leva');
  if (tipo == 'url' && !/^https?:\/\//i.test(val)) return toast('O link precisa começar com http:// ou https://');
  const ordem = id ? (S.an.find(x => x.id == id) || {}).ordem : Math.max(0, ...S.an.map(a => a.ordem)) + 1;
  const d = { titulo: f.titulo.value.trim(), subtitulo: f.subtitulo.value.trim() || null, texto_botao: f.texto_botao.value.trim() || null, imagem: ANIMG, cor_fundo: f.cor_fundo.value, cor_texto: f.cor_texto.value, link_tipo: tipo, link_valor: tipo == 'nenhum' ? null : val, inicio: f.inicio.value || null, fim: f.fim.value || null, ativo: f.ativo.checked, ordem };
  const r = id ? await db.from('anuncios').update(d).eq('id', id) : await db.from('anuncios').insert(d);
  if (r.error) return toast('Erro: ' + semTabela(r.error));
  fecha(); await load(); render(); toast('Anúncio salvo');
}
async function anMove(id, dir) {
  const l = [...S.an].sort((a, b) => a.ordem - b.ordem), i = l.findIndex(x => x.id == id), j = i + dir; if (i < 0 || j < 0 || j >= l.length) return;
  [l[i], l[j]] = [l[j], l[i]];
  for (let k = 0; k < l.length; k++) if (l[k].ordem !== k) { const r = await db.from('anuncios').update({ ordem: k }).eq('id', l[k].id); if (r.error) return toast('Erro: ' + semTabela(r.error)); }
  await load(); render();
}
async function anAtivo(id) { const a = S.an.find(x => x.id == id); if (!a) return; const { error } = await db.from('anuncios').update({ ativo: !a.ativo }).eq('id', id); if (error) return toast('Erro: ' + semTabela(error)); await load(); render(); toast(a.ativo ? 'Anúncio pausado' : 'Anúncio no ar'); }
async function anExclui(id) { if (!confirm('Excluir este anúncio?')) return; const { error } = await db.from('anuncios').delete().eq('id', id); if (error) return toast('Erro: ' + semTabela(error)); await load(); render(); toast('Anúncio excluído'); }
/* ---- textos e contatos ---- */
const cardCatalogo = () => `<div class="card"><h2>🛍️ Catálogo virtual</h2><small class="blk">Textos e contatos que aparecem no catálogo do cliente.</small>
  <form onsubmit="salvaCfg(event)">
  <label class="row" style="margin-top:8px"><small>Mostrar a faixa de aviso no topo</small><input type="checkbox" name="faixa_ativa" ${cfgGet('faixa_ativa', 'true') != 'false' ? 'checked' : ''}></label>
  <input class="inp" name="faixa_texto" maxlength="120" placeholder="Texto da faixa do topo" value="${esc(cfgGet('faixa_texto', 'CATÁLOGO VIRTUAL · ROZIVALDO STORE'))}">
  <input class="inp" name="whatsapp" inputmode="tel" maxlength="20" placeholder="WhatsApp da loja com DDD (ex: 84999998888)" value="${esc(cfgGet('whatsapp'))}">
  <input class="inp" name="instagram" maxlength="40" placeholder="Instagram (sem @)" value="${esc(cfgGet('instagram'))}">
  <input class="inp" name="horario" maxlength="80" placeholder="Horário de atendimento (ex: Seg a Sáb, 9h às 18h)" value="${esc(cfgGet('horario'))}">
  <input class="inp" name="endereco" maxlength="120" placeholder="Endereço da loja (opcional)" value="${esc(cfgGet('endereco'))}">
  <button class="btn w">Salvar</button></form>
  <div class="row" style="margin-top:10px;justify-content:flex-start"><button class="btn alt" onclick="go('anuncios')">📣 Gerenciar anúncios</button><button class="btn alt" onclick="formEtapas()">📦 Etapas do pedido</button></div></div>
`;
async function salvaCfg(e) {
  e.preventDefault();
  const fd = new FormData(e.target), linhas = [{ chave: 'faixa_ativa', valor: fd.get('faixa_ativa') ? 'true' : 'false' }, ...['faixa_texto', 'whatsapp', 'instagram', 'horario', 'endereco'].map(k => ({ chave: k, valor: String(fd.get(k) || '').trim() }))];
  const { error } = await db.from('configuracoes').upsert(linhas);
  if (error) return toast('Erro: ' + semTabela(error));
  await load(); render(); toast('Catálogo atualizado');
}
/* ---- etapas do pedido ---- */
function formEtapas() {
  const l = [...(S.et || [])].sort((a, b) => a.ordem - b.ordem);
  modal(`<h2>📦 Etapas do pedido</h2><p class="mut">Os passos que o cliente vê em "Acompanhar pedido". Você avança cada pedido por eles em Pedidos online.</p>
  ${l.map((x, i) => `<div class="card"><div class="row"><b>${i + 1}. ${esc(x.nome)}</b><span><button class="lnk" onclick="etMove('${x.id}',-1)" ${i == 0 ? 'disabled' : ''}>↑</button><button class="lnk" onclick="etMove('${x.id}',1)" ${i == l.length - 1 ? 'disabled' : ''}>↓</button><button class="lnk" onclick="etEdita('${x.id}')">Editar</button><button class="lnk red" onclick="etExclui('${x.id}')">Excluir</button></span></div><small class="blk">${esc(x.descricao)}</small></div>`).join('') || '<p class="mut">Nenhuma etapa. Rode o SQL do catálogo virtual para criar as padrão.</p>'}
  <form onsubmit="etNova(event)"><input class="inp" name="nome" maxlength="50" placeholder="Nova etapa (ex: Saiu para entrega)" required><input class="inp" name="descricao" maxlength="160" placeholder="O que o cliente vê nessa etapa"><button class="btn w">Adicionar etapa</button></form>`);
}
async function etNova(e) {
  e.preventDefault(); const f = e.target;
  const { error } = await db.from('etapas_pedido').insert({ nome: f.nome.value.trim(), descricao: f.descricao.value.trim() || null, ordem: Math.max(0, ...S.et.map(x => x.ordem)) + 1 });
  if (error) return toast('Erro: ' + semTabela(error));
  await load(); render(); formEtapas(); toast('Etapa adicionada');
}
async function etEdita(id) {
  const x = S.et.find(e => e.id == id); if (!x) return;
  const nome = prompt('Nome da etapa:', x.nome); if (nome == null || !nome.trim()) return;
  const desc = prompt('O que o cliente vê nessa etapa:', x.descricao || ''); if (desc == null) return;
  const { error } = await db.from('etapas_pedido').update({ nome: nome.trim(), descricao: desc.trim() || null }).eq('id', id);
  if (error) return toast('Erro: ' + error.message);
  await load(); render(); formEtapas();
}
async function etMove(id, dir) {
  const l = [...S.et].sort((a, b) => a.ordem - b.ordem), i = l.findIndex(x => x.id == id), j = i + dir; if (i < 0 || j < 0 || j >= l.length) return;
  const a = l[i].ordem, b = l[j].ordem;
  await db.from('etapas_pedido').update({ ordem: b }).eq('id', l[i].id); await db.from('etapas_pedido').update({ ordem: a }).eq('id', l[j].id);
  await load(); render(); formEtapas();
}
async function etExclui(id) {
  if (S.et.length <= 1) return toast('Deixe pelo menos uma etapa');
  if (!confirm('Excluir esta etapa? Pedidos que estavam nela voltam para a primeira etapa.')) return;
  const { error } = await db.from('etapas_pedido').delete().eq('id', id);
  if (error) return toast('Erro: ' + error.message);
  await load(); render(); formEtapas();
}
/* ---- avançar etapa nos pedidos ---- */
const etLista = () => [...(S.et || [])].sort((a, b) => a.ordem - b.ordem);
function etapaUI(p) {
  const l = etLista(); if (!p.codigo || !l.length || p.status == 'recusado') return '';
  const cur = l.findIndex(e => e.id == p.etapa_id), i = cur < 0 ? 0 : cur, prox = l[i + 1];
  return `<div style="margin-top:8px;padding-top:8px;border-top:1px dashed var(--line)"><small class="blk">📦 Código <b>${esc(p.codigo)}</b> · etapa: <b>${esc(l[i].nome)}</b> (${i + 1}/${l.length})</small>
  <div class="row" style="margin-top:6px;justify-content:flex-start"><select class="inp" style="width:auto;margin:0" onchange="pedEtapa('${p.id}',this.value)">${l.map((e, k) => `<option value="${e.id}" ${k == i ? 'selected' : ''}>${k + 1}. ${esc(e.nome)}</option>`).join('')}</select>${prox ? `<button class="btn" onclick="pedEtapa('${p.id}','${prox.id}')">Avançar: ${esc(prox.nome)}</button>` : ''}<button class="lnk" onclick="pedAviso('${p.id}')">📲 Avisar cliente</button></div></div>`;
}
async function pedEtapa(id, etapaId) {
  const p = S.pt.find(x => x.id == id), e = S.et.find(x => x.id == etapaId); if (!p || !e) return;
  const nota = prompt('Recado para o cliente nesta etapa (opcional):', ''); if (nota === null) { render(); return; }
  const r = await db.from('pedidos').update({ etapa_id: e.id, etapa_em: new Date().toISOString() }).eq('id', id);
  if (r.error) return toast('Erro: ' + semTabela(r.error));
  await db.from('historico_pedido').insert({ pedido_id: id, etapa_id: e.id, etapa_nome: e.nome, nota: nota.trim() || null });
  await load(); render(); toast('Etapa atualizada: ' + e.nome);
}
function pedAviso(id) {
  const p = S.pt.find(x => x.id == id); if (!p) return;
  const l = etLista(), e = l.find(x => x.id == p.etapa_id) || l[0];
  window.open(zapLink(p, `Olá, ${p.nome}! Seu pedido ${p.codigo} agora está em: ${e.nome}.\n\nAcompanhe aqui: ${LINK()}#v=acompanhar&c=${p.codigo}`), '_blank');
}
/* ===== TEMA: escuro / claro / automático ===== */
const temaModo = () => { try { return localStorage.getItem('rs_tema') || 'escuro'; } catch (e) { return 'escuro'; } };
const temaEfetivo = () => { const m = temaModo(); return m == 'auto' ? (window.matchMedia && matchMedia('(prefers-color-scheme: light)').matches ? 'claro' : 'escuro') : m; };
function temaAplica() {
  const c = temaEfetivo() == 'claro';
  document.documentElement.classList.toggle('claro', c);
  const mt = document.getElementById('themeMeta'); if (mt) mt.content = c ? '#ffffff' : '#0f1521';
  const b = document.getElementById('temaBtn');
  if (b) { b.innerHTML = `<svg class="ic" style="width:20px;height:20px"><use href="#${c ? 'i-moon' : 'i-sun'}"/></svg>`; b.title = c ? 'Mudar para o modo escuro' : 'Mudar para o modo claro'; }
}
function temaSet(m) { try { localStorage.setItem('rs_tema', m); } catch (e) {} temaAplica(); if (cur == 'ajustes') render(); toast({ escuro: '🌙 Modo escuro', claro: '☀️ Modo claro', auto: '🖥️ Automático (segue o aparelho)' }[m]); }
function temaToggle() { temaSet(temaEfetivo() == 'claro' ? 'escuro' : 'claro'); }
if (window.matchMedia) { const mq = matchMedia('(prefers-color-scheme: light)'); if (mq.addEventListener) mq.addEventListener('change', () => { if (temaModo() == 'auto') temaAplica(); }); }
const cardTema = () => `<div class="card"><h2>🎨 Aparência</h2><small class="blk">Escolha como o sistema aparece neste aparelho.</small>
  <div class="row" style="justify-content:flex-start;margin-top:8px">${[['escuro', '🌙 Escuro'], ['claro', '☀️ Claro'], ['auto', '🖥️ Automático']].map(([k, t]) => `<button class="btn ${temaModo() == k ? '' : 'alt'}" onclick="temaSet('${k}')">${t}</button>`).join('')}</div>
  <small class="blk" style="margin-top:6px">Automático segue o modo claro ou escuro do seu aparelho. Você também pode alternar pelo botão ☀️/🌙 no topo.</small></div>
`;
temaAplica();
const ehDuplicado = e => e && (e.code == '23505' || /duplicate key|unique constraint/i.test(e.message || ''));
async function garanteSub(area, nome) {
  let ex = subsDe(area).find(n => nz(n) == nz(nome)); if (ex) return ex;
  const r = await db.from('subcategorias').insert({ area, nome });
  if (r.error && !ehDuplicado(r.error)) throw r.error;
  await load();                                   // atualiza a lista na hora (mesmo que o resto falhe)
  ex = subsDe(area).find(n => nz(n) == nz(nome));
  return ex || nome;
}
/* ===== NOTAS FISCAIS DE COMPRA (prazo de troca) ===== */
let NF = { f: 'prazo', q: '', m: '', p: '' }, NFP = [], NFSEL = new Set(), NFEDIT = null, NFSAVING = false;
const NFB = 'notas';
const slug = t => nz(t || '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'nota';
const dMais = (s, n) => { const [a, m, d] = s.split('-').map(Number); return dia2(new Date(a, m - 1, d + n)); };
const nfLimite = n => dMais(n.data_compra, n.prazo_dias);
const nfDias = n => Math.round((new Date(nfLimite(n) + 'T12:00:00') - new Date(HOJE + 'T12:00:00')) / 864e5);
const nfForn = n => (S.mc.find(m => m.id == n.marca_id) || {}).nome || n.fornecedor || 'Fornecedor';
function nfSit(n) {
  if (n.resolvida) return ['Troca feita', 'ok'];
  const d = nfDias(n);
  return d < 0 ? ['Prazo encerrado', ''] : d == 0 ? ['Vence hoje', 'bad'] : d <= 3 ? [`Faltam ${d} ${d == 1 ? 'dia' : 'dias'}`, 'bad'] : d <= 7 ? [`Faltam ${d} dias`, 'wait'] : [`Faltam ${d} dias`, 'ok'];
}
const nfUrgentes = () => (S.nf || []).filter(n => !n.resolvida && nfDias(n) >= 0 && nfDias(n) <= 3).sort((a, b) => nfDias(a) - nfDias(b));
const NFF = { prazo: n => !n.resolvida && nfDias(n) >= 0, encerradas: n => !n.resolvida && nfDias(n) < 0, resolvidas: n => n.resolvida, todas: () => true };
function nfLista() {
  const q = nz(NF.q.trim());
  const txt = n => nz([nfForn(n), n.numero, n.chave, n.itens, n.obs, ...(n.produtos || []).map(id => (S.pr.find(p => p.id == id) || {}).nome)].join(' '));
  let l = (S.nf || []).filter(n => (!NF.m || n.marca_id == NF.m) && (!NF.p || (n.produtos || []).includes(NF.p)) && (!q || txt(n).includes(q)));
  if (!q) l = l.filter(NFF[NF.f]);
  return l.sort((a, b) => !q && NF.f == 'prazo' ? nfDias(a) - nfDias(b) : b.data_compra.localeCompare(a.data_compra));
}
function nfCard(n) {
  const [t, c] = nfSit(n), arq = n.arquivos || [], ps = (n.produtos || []).map(id => S.pr.find(p => p.id == id)).filter(Boolean);
  const itens = (n.itens || '').split('\n').map(x => x.trim()).filter(Boolean);
  return `<div class="card nf"><div class="row" style="align-items:flex-start;flex-wrap:nowrap"><span style="display:flex;gap:10px;align-items:center;min-width:0;cursor:pointer" onclick="nfVer('${n.id}')"><span class="nft">${n.thumb ? `<img src="${n.thumb}" alt="">` : '📄'}</span>
  <span style="min-width:0"><b>${esc(nfForn(n))}${n.numero ? ' · NF ' + esc(n.numero) : ''}</b><small class="blk">Compra ${dt(n.data_compra)}${n.valor != null ? ' · ' + R(n.valor) : ''} · ${arq.length} ${arq.length == 1 ? 'página' : 'páginas'}</small></span></span><em class="tag ${c}">${t}</em></div>
  <small class="blk" style="margin-top:6px">🔁 Troca até <b>${dt(nfLimite(n))}</b> (prazo de ${n.prazo_dias} dias)</small>
  ${ps.length ? `<div class="fchips" style="margin:6px 0 0">${ps.slice(0, 4).map(p => `<span class="fc"><span>${esc(p.nome)}</span></span>`).join('')}${ps.length > 4 ? `<span class="fc"><span>+${ps.length - 4}</span></span>` : ''}</div>` : ''}
  ${itens.length ? `<small class="blk">${esc(itens.slice(0, 3).join(' · '))}${itens.length > 3 ? '…' : ''}</small>` : ''}
  <div class="row" style="margin-top:8px"><button class="btn" onclick="nfVer('${n.id}')">Abrir / baixar</button><button class="btn alt" onclick="nfShare('${n.id}')">📤</button><button class="lnk" onclick="formNF('${n.id}')">Editar</button><button class="lnk" onclick="nfResolve('${n.id}')">${n.resolvida ? 'Reabrir' : '✓ Troca feita'}</button><button class="lnk red" onclick="nfExclui('${n.id}')">Excluir</button></div></div>`;
}
const nfCards = () => nfLista().map(nfCard).join('') || `<p class="mut">${S.nf.length ? 'Nenhuma nota nesta lista.' : 'Nenhuma nota ainda. Toque em "Nova nota" e escaneie a primeira! 🧾'}</p>`;
function nfDesenha() { const b = $('#nfl'); if (b) b.innerHTML = nfCards(); }
function notas() {
  const cont = k => (S.nf || []).filter(NFF[k]).length, pr = NF.p ? S.pr.find(p => p.id == NF.p) : null;
  return `<div class="row"><h1>Notas fiscais</h1><button class="btn" onclick="formNF()">📷 Nova nota</button></div>
  <p class="mut">Guarde as notas de compra e nunca perca o prazo de troca. Busque pelo produto, fornecedor ou número da nota.</p>
  <input class="inp" id="nfq" placeholder="🔎 Buscar por produto, fornecedor ou nº da NF" value="${esc(NF.q)}" oninput="NF.q=this.value;nfDesenha()">
  ${pr ? `<div class="fchips"><span class="fc"><span>Produto: ${esc(pr.nome)}</span></span><button class="lnk" onclick="NF.p='';render()">Limpar</button></div>` : ''}
  <div class="row" style="justify-content:flex-start">${[['prazo', 'No prazo'], ['encerradas', 'Encerradas'], ['resolvidas', 'Troca feita'], ['todas', 'Todas']].map(([k, t]) => `<button class="btn ${NF.f == k ? '' : 'alt'}" onclick="NF.f='${k}';render()">${t} (${cont(k)})</button>`).join('')}</div>
  ${S.mc.length ? `<div class="fchips">${[['', 'Todos os fornecedores'], ...S.mc.map(m => [m.id, m.nome])].map(([v, t]) => `<button class="vpcat ${NF.m == v ? 'on' : ''}" onclick="NF.m='${v}';render()">${esc(t)}</button>`).join('')}</div>` : ''}
  <div id="nfl">${nfCards()}</div>`;
}
/* ---- ver / baixar / compartilhar / imprimir ---- */
async function nfUrls(n, dl) {
  const arq = n.arquivos || [], { data, error } = await db.storage.from(NFB).createSignedUrls(arq.map(a => a.path), 3600, dl ? { download: true } : undefined);
  return error || !data ? null : data.map(d => d.signedUrl);
}
async function nfVer(id) {
  const n = S.nf.find(x => x.id == id); if (!n) return;
  modal(`<h2>🧾 ${esc(nfForn(n))}${n.numero ? ' · NF ' + esc(n.numero) : ''}</h2><p class="mut">Compra ${dt(n.data_compra)} · troca até ${dt(nfLimite(n))}</p>
  <div class="row"><button class="btn" onclick="nfBaixar('${id}')">⬇️ Baixar</button><button class="btn alt" onclick="nfShare('${id}')">📤 Compartilhar</button><button class="btn alt" onclick="nfPrint('${id}')">🖨️ PDF</button></div>
  <div id="nfv"><p class="mut">Carregando…</p></div>`);
  const u = await nfUrls(n), arq = n.arquivos || [];
  if (!u) return ($('#nfv').innerHTML = '<p class="mut">Não consegui abrir os arquivos. Confira se rodou o SQL de notas fiscais.</p>');
  $('#nfv').innerHTML = u.map((s, i) => arq[i].tipo == 'pdf' ? `<div class="card row"><span>📄 ${esc(arq[i].nome)}</span><a class="btn alt" target="_blank" href="${s}">Abrir PDF</a></div>` : `<a href="${s}" target="_blank"><img class="nfimg" src="${s}" alt="Página ${i + 1}"></a>`).join('') || '<p class="mut">Nota sem arquivos.</p>';
}
async function nfBaixar(id) {
  const n = S.nf.find(x => x.id == id); if (!n) return;
  const u = await nfUrls(n, true); if (!u) return toast('Não consegui baixar agora');
  for (let i = 0; i < u.length; i++) { const a = document.createElement('a'); a.href = u[i]; a.download = n.arquivos[i].nome; document.body.appendChild(a); a.click(); a.remove(); await new Promise(r => setTimeout(r, 450)); }
}
async function nfShare(id) {
  const n = S.nf.find(x => x.id == id); if (!n) return;
  const u = await nfUrls(n); if (!u) return toast('Não consegui abrir os arquivos');
  try {
    const files = await Promise.all(u.map(async (s, i) => { const b = await (await fetch(s)).blob(); return new File([b], n.arquivos[i].nome, { type: b.type || (n.arquivos[i].tipo == 'pdf' ? 'application/pdf' : 'image/jpeg') }); }));
    if (navigator.canShare && navigator.canShare({ files })) await navigator.share({ files, title: `NF ${n.numero || ''} ${nfForn(n)}`.trim() });
    else { toast('Este aparelho não compartilha arquivos: baixando'); nfBaixar(id); }
  } catch (e) { if (e && e.name != 'AbortError') toast('Não foi possível compartilhar'); }
}
async function nfPrint(id) {
  const n = S.nf.find(x => x.id == id); if (!n) return;
  const u = await nfUrls(n); if (!u) return toast('Não consegui abrir os arquivos');
  const imgs = u.filter((_, i) => n.arquivos[i].tipo != 'pdf'), w = window.open('', '_blank');
  if (!w) return toast('Permita pop-ups deste site');
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>NF ${esc(n.numero || '')} - ${esc(nfForn(n))}</title><style>@page{margin:8mm}body{margin:0;font-family:Arial,sans-serif}img{width:100%;display:block;page-break-after:always}p{font-size:12px;color:#444;margin:0 0 6px}</style></head><body><p><b>${esc(nfForn(n))}</b> · NF ${esc(n.numero || '—')} · compra ${dt(n.data_compra)} · troca até ${dt(nfLimite(n))}</p>${imgs.map(s => `<img src="${s}">`).join('')}<script>window.onload=function(){setTimeout(function(){window.print()},500)}<\/script></body></html>`);
  w.document.close();
}
async function nfResolve(id) {
  const n = S.nf.find(x => x.id == id); if (!n) return;
  const { error } = await db.from('notas').update({ resolvida: !n.resolvida }).eq('id', id);
  if (error) return toast('Erro: ' + error.message);
  await load(); render(); toast(n.resolvida ? 'Nota reaberta' : 'Troca marcada como feita');
}
async function nfExclui(id) {
  const n = S.nf.find(x => x.id == id); if (!n) return;
  if (!confirm('Excluir esta nota e os arquivos dela? Não dá para desfazer.')) return;
  const { error } = await db.from('notas').delete().eq('id', id);
  if (error) return toast('Erro: ' + error.message);
  const ps = (n.arquivos || []).map(a => a.path); if (ps.length) await db.storage.from(NFB).remove(ps);
  await load(); render(); toast('Nota excluída');
}
/* ---- chave de acesso / código de barras ---- */
function nfChave(v) {
  const c = String(v || '').replace(/\D/g, ''); if (c.length != 44) return null;
  let s = 0, w = 2; for (let i = 42; i >= 0; i--) { s += +c[i] * w; w = w == 9 ? 2 : w + 1; }
  const r = s % 11, dv = r < 2 ? 0 : 11 - r; if (dv != +c[43]) return null;
  return { aamm: c.slice(2, 6), cnpj: c.slice(6, 20), serie: String(+c.slice(22, 25)), numero: String(+c.slice(25, 34)) };
}
async function nfCodigo(file) {
  try {
    if (!('BarcodeDetector' in window)) return null;
    const bd = new BarcodeDetector({ formats: ['code_128', 'qr_code'] }), r = await bd.detect(await createImageBitmap(file));
    for (const x of r) { const m = (x.rawValue || '').match(/\d{44}/); if (m && nfChave(m[0])) return m[0]; }
  } catch (e) {}
  return null;
}
function nfChaveIn(v, scan) {
  const f = $('#nff'), msg = $('#nfmsg'), d = String(v || '').replace(/\D/g, ''); if (!f) return;
  const c = nfChave(d);
  if (!c) { if (d.length == 44 && msg) msg.textContent = '⚠️ A chave não confere: confira os números.'; return; }
  if (!f.numero.value || scan) f.numero.value = c.numero;
  f.dataset.cnpj = c.cnpj;
  const m = S.mc.find(x => x.cnpj && x.cnpj.replace(/\D/g, '') == c.cnpj);
  if (m) { f.marca.value = m.id; nfMarca(); }
  if (msg) msg.textContent = `✅ Código lido: NF ${c.numero} · emitida em ${c.aamm.slice(2)}/20${c.aamm.slice(0, 2)}${m ? ' · ' + m.nome : ''}`;
}
/* ---- formulário ---- */
async function nfProc(file, melhora) {
  const bmp = await createImageBitmap(file), k = Math.min(1, 1800 / Math.max(bmp.width, bmp.height)), c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(bmp.width * k)); c.height = Math.max(1, Math.round(bmp.height * k));
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(bmp, 0, 0, c.width, c.height);
  if (melhora) {
    const d = x.getImageData(0, 0, c.width, c.height), p = d.data, h = new Uint32Array(256), tot = c.width * c.height;
    for (let i = 0; i < p.length; i += 4) { const g = (p[i] * 0.299 + p[i + 1] * 0.587 + p[i + 2] * 0.114) | 0; p[i] = p[i + 1] = p[i + 2] = g; h[g]++; }
    let a = 0, lo = 0, hi = 255;
    for (let i = 0; i < 256; i++) { a += h[i]; if (a > tot * 0.02) { lo = i; break; } }
    a = 0; for (let i = 255; i >= 0; i--) { a += h[i]; if (a > tot * 0.25) { hi = i; break; } }
    const span = Math.max(40, hi - lo);
    for (let i = 0; i < p.length; i += 4) { const v = Math.max(0, Math.min(255, ((p[i] - lo) * 255) / span)); p[i] = p[i + 1] = p[i + 2] = v; }
    x.putImageData(d, 0, 0);
  }
  const blob = await new Promise(ok => c.toBlob(ok, 'image/jpeg', 0.78)), t = document.createElement('canvas'), kk = 220 / Math.max(c.width, c.height);
  t.width = Math.max(1, Math.round(c.width * kk)); t.height = Math.max(1, Math.round(c.height * kk)); t.getContext('2d').drawImage(c, 0, 0, t.width, t.height);
  return { blob, thumb: t.toDataURL('image/jpeg', 0.7) };
}
async function nfAdd(inp) {
  const fs = [...inp.files], melhora = $('#nfmelhora').checked, msg = $('#nfmsg'); inp.value = '';
  for (const f of fs) {
    if (NFP.length >= 8) { toast('Máximo de 8 páginas por nota'); break; }
    if (f.type == 'application/pdf' || /\.pdf$/i.test(f.name)) { if (f.size > 10e6) { toast('PDF muito grande (máximo 10 MB)'); continue; } NFP.push({ tipo: 'pdf', nome: f.name, blob: f, novo: true }); nfPg(); continue; }
    msg.textContent = 'Processando a imagem…';
    try { const r = await nfProc(f, melhora); NFP.push({ tipo: 'img', nome: 'pagina.jpg', blob: r.blob, thumb: r.thumb, novo: true }); }
    catch (e) { toast('Não consegui ler essa imagem'); continue; }
    nfPg();
    const form = $('#nff');
    if (form && !form.chave.value) { const c = await nfCodigo(f); if (c) { form.chave.value = c; nfChaveIn(c, true); } }
  }
  if (msg && msg.textContent.startsWith('Processando')) msg.textContent = '';
}
function nfPg() {
  const b = $('#nfpg'); if (!b) return;
  const n = NFEDIT ? S.nf.find(x => x.id == NFEDIT) : null;
  b.innerHTML = NFP.map((p, i) => `<div class="ft">${p.tipo == 'pdf' ? '<div class="pimg" style="height:100%">📄</div>' : (p.thumb || (i == 0 && n && n.thumb)) ? `<img src="${p.thumb || n.thumb}" alt="">` : '<div class="pimg" style="height:100%">🖼️</div>'}<span class="pri">${i + 1}</span><button type="button" class="x" onclick="nfRem(${i})" title="Remover">✕</button></div>`).join('');
}
function nfRem(i) { NFP.splice(i, 1); nfPg(); }
function nfPrazoTxt() {
  const f = $('#nff'), b = $('#nflim'); if (!f || !b) return;
  const n = { data_compra: f.data.value, prazo_dias: +f.prazo.value || 0 };
  b.innerHTML = f.data.value ? `🔁 Troca até <b>${dt(nfLimite(n))}</b>${(d => d < 0 ? ' <small class="red">(prazo já passou)</small>' : ` <small>(${d == 0 ? 'vence hoje' : 'faltam ' + d + ' dias'})</small>`)(nfDias(n))}` : '';
}
function nfPrazo(d) { $('#nff').prazo.value = d; nfPrazoTxt(); }
function nfMarca() {
  const f = $('#nff'), v = f.marca.value; f.fornecedor.hidden = v != '__outro';
  const m = S.mc.find(x => x.id == v); if (m && m.prazo_troca != null) { f.prazo.value = m.prazo_troca; nfPrazoTxt(); }
  nfProdList();
}
function nfSel(id, on) { if (on) NFSEL.add(id); else NFSEL.delete(id); }
function nfProdList() {
  const box = $('#nfpl'); if (!box) return;
  const f = $('#nff'), mid = f ? f.marca.value : '', q = nz((($('#nfq2') || {}).value) || '');
  const l = S.pr.filter(p => !q || nz(p.nome + ' ' + skuDe(p)).includes(q)).sort((a, b) => (NFSEL.has(b.id) - NFSEL.has(a.id)) || ((b.marca_id == mid) - (a.marca_id == mid)) || a.nome.localeCompare(b.nome));
  box.innerHTML = l.slice(0, 80).map(p => `<label class="card row" style="padding:8px"><span>${esc(p.nome)}<small class="blk">${esc((S.mc.find(m => m.id == p.marca_id) || {}).nome || '')}</small></span><input type="checkbox" ${NFSEL.has(p.id) ? 'checked' : ''} onchange="nfSel('${p.id}',this.checked)"></label>`).join('') || '<small>Nenhum produto encontrado.</small>';
}
function formNF(id) {
  const n = id ? S.nf.find(x => x.id == id) : null;
  NFEDIT = id || null; NFSEL = new Set(n ? n.produtos || [] : []); NFP = (n ? n.arquivos || [] : []).map(a => ({ ...a, existing: true }));
  const mc = n ? (n.marca_id || (n.fornecedor ? '__outro' : '')) : '';
  modal(`<h2>${id ? 'Editar' : 'Nova'} nota fiscal de compra</h2>
  <form id="nff" onsubmit="salvaNF(event)">
  <div class="card"><small>📷 Escaneie ou anexe a nota (pode ter várias páginas)</small>
    <div class="row" style="margin-top:8px;justify-content:flex-start"><label class="btn">📷 Escanear<input type="file" accept="image/*" capture="environment" hidden onchange="nfAdd(this)"></label><label class="btn alt">📎 Foto ou PDF<input type="file" accept="image/*,application/pdf" multiple hidden onchange="nfAdd(this)"></label></div>
    <label class="row" style="margin-top:6px"><small>✨ Melhorar leitura (modo documento)</small><input type="checkbox" id="nfmelhora" checked></label>
    <div class="fts" id="nfpg"></div><small class="blk" id="nfmsg"></small></div>
  <select class="inp" name="marca" onchange="nfMarca()"><option value="">Fornecedor…</option>${S.mc.map(m => `<option value="${m.id}" ${m.id == mc ? 'selected' : ''}>${esc(m.nome)}</option>`).join('')}<option value="__outro" ${mc == '__outro' ? 'selected' : ''}>Outro fornecedor…</option></select>
  <input class="inp" name="fornecedor" maxlength="60" placeholder="Nome do fornecedor" value="${esc(n && !n.marca_id ? n.fornecedor : '')}" ${mc == '__outro' ? '' : 'hidden'}>
  <input class="inp" name="numero" maxlength="20" placeholder="Número da NF" value="${esc(n ? n.numero : '')}">
  <input class="inp" name="chave" inputmode="numeric" maxlength="60" placeholder="Chave de acesso (44 números, opcional)" value="${esc(n ? n.chave : '')}" oninput="nfChaveIn(this.value)">
  <label><small>Data da compra</small><input class="inp" type="date" name="data" value="${n ? n.data_compra : HOJE}" required oninput="nfPrazoTxt()"></label>
  <label><small>Prazo para troca (dias)</small><input class="inp" type="number" name="prazo" min="0" max="365" value="${n ? n.prazo_dias : 7}" required oninput="nfPrazoTxt()"></label>
  <div class="fchips">${[3, 7, 15, 30].map(d => `<button type="button" class="vpcat" onclick="nfPrazo(${d})">${d} dias</button>`).join('')}</div>
  <div class="card" id="nflim"></div>
  <input class="inp" name="valor" inputmode="decimal" placeholder="Valor total da NF (opcional)" value="${n && n.valor != null ? n.valor : ''}">
  <div class="card"><small>🛍️ Quais produtos estão nesta nota? (para achar rápido depois)</small><input class="inp" id="nfq2" placeholder="Buscar produto…" oninput="nfProdList()"><div id="nfpl" class="nfpl"></div></div>
  <textarea class="inp" name="itens" rows="2" placeholder="Outros itens (um por linha), se não estiverem no catálogo">${esc(n ? n.itens : '')}</textarea>
  <textarea class="inp" name="obs" rows="2" placeholder="Observações">${esc(n ? n.obs : '')}</textarea>
  <button class="btn w" id="nfsave">Salvar nota</button><button type="button" class="btn alt w" style="margin-top:8px" onclick="fecha()">Cancelar</button></form>`);
  nfPg(); nfPrazoTxt(); nfProdList();
}
async function salvaNF(e) {
  e.preventDefault();
  if (NFSAVING) return;
  const f = e.target, btn = $('#nfsave');
  if (!NFP.length && !confirm('Salvar sem nenhum arquivo anexado?')) return;
  NFSAVING = true; btn.disabled = true; btn.textContent = 'Salvando…';
  const antigo = NFEDIT ? S.nf.find(x => x.id == NFEDIT) : null, id = NFEDIT || (crypto.randomUUID ? crypto.randomUUID() : null);
  try {
    const v = f.marca.value, marca = S.mc.find(m => m.id == v), forn = v == '__outro' ? f.fornecedor.value.trim() : '';
    if (v == '__outro' && !forn) { toast('Digite o nome do fornecedor'); return; }
    const nome = nfForn({ marca_id: marca && marca.id, fornecedor: forn }), num = f.numero.value.trim();
    const arq = [], novos = [];
    for (let i = 0; i < NFP.length; i++) {
      const p = NFP[i];
      if (p.existing) { arq.push({ path: p.path, nome: p.nome, tipo: p.tipo }); continue; }
      const ext = p.tipo == 'pdf' ? 'pdf' : 'jpg', path = `${id}/${Date.now()}-${i}.${ext}`, nm = `${slug(nome)}-NF${slug(num || 'sn')}-p${i + 1}.${ext}`;
      const r = await db.storage.from(NFB).upload(path, p.blob, { contentType: p.blob.type || (p.tipo == 'pdf' ? 'application/pdf' : 'image/jpeg') });
      if (r.error) { if (novos.length) await db.storage.from(NFB).remove(novos); toast('Erro ao enviar o arquivo: ' + r.error.message); return; }
      novos.push(path); arq.push({ path, nome: nm, tipo: p.tipo });
    }
    const primeira = NFP.find(x => x.tipo == 'img'), d = {
      marca_id: marca ? marca.id : null, fornecedor: forn || null, numero: num || null, chave: f.chave.value.replace(/\D/g, '') || null,
      data_compra: f.data.value, prazo_dias: Math.max(0, Math.min(365, +f.prazo.value || 0)), valor: numOc(f.valor.value),
      itens: f.itens.value.trim() || null, produtos: [...NFSEL], arquivos: arq, obs: f.obs.value.trim() || null,
      thumb: primeira ? (primeira.thumb || (antigo && antigo.thumb) || null) : null
    };
    const r = NFEDIT ? await db.from('notas').update(d).eq('id', NFEDIT) : await db.from('notas').insert({ id, ...d });
    if (r.error) { if (novos.length) await db.storage.from(NFB).remove(novos); toast('Erro: ' + r.error.message); return; }
    if (antigo) { const rem = (antigo.arquivos || []).filter(a => !arq.some(x => x.path == a.path)).map(a => a.path); if (rem.length) await db.storage.from(NFB).remove(rem); }
    if (marca && !marca.cnpj && f.dataset.cnpj) await db.from('marcas').update({ cnpj: f.dataset.cnpj }).eq('id', marca.id);
    fecha(); await load(); render(); toast('Nota salva');
  } finally { NFSAVING = false; if (btn && btn.isConnected) { btn.disabled = false; btn.textContent = 'Salvar nota'; } }
}
/* ===== PRIVACIDADE: custos e lucros ocultos por padrão (olhinho) ===== */
let OCULTO = true;
const EYE_ON = '<svg class="ic" viewBox="0 0 24 24"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_OFF = '<svg class="ic" viewBox="0 0 24 24"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/><path d="M3 3l18 18"/></svg>';
const ocv = t => `<span class="oc" data-v="${esc(t)}">${OCULTO ? '•••' : esc(t)}</span>`;
const eyeBtn = () => `<button type="button" class="eye" onclick="ocToggle()" title="${OCULTO ? 'Mostrar custos e lucros' : 'Ocultar custos e lucros'}">${OCULTO ? EYE_OFF : EYE_ON}</button>`;
const numOc = v => { if (v === '' || v == null) return null; let x = String(v).trim(); if (x.includes(',')) x = x.replace(/\./g, '').replace(',', '.'); const n = +x; return isFinite(n) ? n : null; };
function ocApply() {
  document.body.classList.toggle('oculto', OCULTO);
  document.querySelectorAll('.oc').forEach(e => { e.textContent = OCULTO ? '•••' : e.dataset.v; });
  document.querySelectorAll('.eye').forEach(e => { e.innerHTML = OCULTO ? EYE_OFF : EYE_ON; e.title = OCULTO ? 'Mostrar custos e lucros' : 'Ocultar custos e lucros'; });
}
function ocToggle() { OCULTO = !OCULTO; ocApply(); toast(OCULTO ? '🙈 Custos e lucros ocultos' : '👁️ Custos e lucros visíveis'); }
ocApply();
/* ===== FOTOS (até 5) E TAMANHOS ===== */
let FT = [], FTD = false;
const TAMS = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'Único', '34', '36', '38', '40', '42', '44', '46', '48'];
const fileUrl = f => new Promise(ok => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(f); });
const redimN = (src, max, q) => new Promise(ok => { const im = new Image(); im.onload = () => { const k = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.max(1, Math.round(im.width * k)); c.height = Math.max(1, Math.round(im.height * k)); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); ok(c.toDataURL('image/jpeg', q)); }; im.src = src; });
async function ftAdd(inp) {
  const fs = [...inp.files]; inp.value = '';
  for (const f of fs) { if (FT.length >= 5) { toast('Máximo de 5 fotos por produto'); break; } FT.push(await redimN(await fileUrl(f), 900, 0.82)); FTD = true; ftDesenha(); }
}
function ftDesenha() {
  const b = $('#fts'); if (!b) return;
  b.innerHTML = FT.map((u, i) => `<div class="ft"><img src="${u}" alt="">${i == 0 ? '<span class="pri">Principal</span>' : `<button type="button" class="st" onclick="ftPrim(${i})" title="Tornar principal">★</button>`}<button type="button" class="x" onclick="ftDel(${i})" title="Remover">✕</button></div>`).join('')
    + (FT.length < 5 ? '<label class="ft add">＋<input type="file" accept="image/*" multiple onchange="ftAdd(this)" hidden></label>' : '');
  const c = $('#ftc'); if (c) c.textContent = FT.length + '/5';
}
function ftPrim(i) { FT.unshift(FT.splice(i, 1)[0]); FTD = true; ftDesenha(); }
function ftDel(i) { FT.splice(i, 1); FTD = true; ftDesenha(); }
async function ftInit(id, p) {
  FT = p.foto ? [p.foto] : []; FTD = false; ftDesenha();
  if (!id || !(p.n_fotos >= 1)) return;
  const { data } = await db.from('produto_fotos').select('url').eq('produto_id', id).order('ordem');
  if (data && data.length) { const extra = FTD ? FT.slice(1) : []; FT = [...data.map(x => x.url), ...extra].slice(0, 5); ftDesenha(); }
}
const tamHtml = p => {
  const sel = p.tamanhos || [], modo = p.tam_consulta ? 'consulta' : sel.length ? 'lista' : 'nenhum', todos = [...TAMS, ...sel.filter(t => !TAMS.includes(t))];
  return `<div class="card"><small>📏 Tamanhos disponíveis</small>
  <div class="tiles" style="grid-template-columns:repeat(3,1fr)">${[['nenhum', 'Sem tamanho'], ['lista', 'Escolher tamanhos'], ['consulta', 'Consulte o tamanho']].map(([v, t]) => `<label class="tile"><input type="radio" name="tmodo" value="${v}" ${modo == v ? 'checked' : ''} onchange="tmodoSet()"><span>${t}</span></label>`).join('')}</div>
  <div id="tmbox" ${modo == 'lista' ? '' : 'hidden'}><div class="tiles tz" id="tzs">${todos.map(t => `<label class="tile"><input type="checkbox" name="tam" value="${esc(t)}" ${sel.includes(t) ? 'checked' : ''}><span>${esc(t)}</span></label>`).join('')}</div>
  <div class="row" style="flex-wrap:nowrap"><input class="inp" id="tcus" maxlength="12" placeholder="Outro tamanho (ex: 50, 3XL)" style="margin:0"><button type="button" class="btn alt" onclick="tzAdd()">Adicionar</button></div></div>
  <small class="blk">“Consulte o tamanho” mostra ao cliente: consulte o tamanho disponível.</small></div>`;
};
function tmodoSet() { const m = document.querySelector('#modal [name=tmodo]:checked'); $('#tmbox').hidden = !m || m.value != 'lista'; }
function tzAdd() {
  const i = $('#tcus'), v = i.value.trim().replace(/[:\s]+/g, ' ').toUpperCase(); if (!v) return;
  const ex = [...document.querySelectorAll('#modal [name=tam]')].find(c => c.value == v);
  if (ex) ex.checked = true; else $('#tzs').insertAdjacentHTML('beforeend', `<label class="tile"><input type="checkbox" name="tam" value="${esc(v)}" checked><span>${esc(v)}</span></label>`);
  i.value = '';
}
/* ===== MARCAS / FORNECEDORES ===== */
let CF = { m: '' };
const marcaDe = p => (S.mc || []).find(m => m.id == p.marca_id);
const mlogo = m => `<span class="mlg">${m.logo ? `<img src="${esc(m.logo)}" alt="">` : esc(m.nome.slice(0, 2).toUpperCase())}</span>`;
function redimLogo(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => { const im = new Image(); im.onload = () => { const k = Math.min(1, 360 / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.max(1, Math.round(im.width * k)); c.height = Math.max(1, Math.round(im.height * k)); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); res(c.toDataURL('image/png')); }; im.onerror = rej; im.src = r.result; };
    r.onerror = rej; r.readAsDataURL(file);
  });
}
function formMarcas() {
  modal(`<h2>🏷️ Marcas e fornecedores</h2><p class="mut">Cadastre as marcas com que você trabalha. No catálogo, o cliente navega por elas e pelas categorias.</p>
  ${(S.mc || []).map(m => { const q = S.pr.filter(p => p.marca_id == m.id).length; return `<div class="card row"><span style="display:flex;gap:10px;align-items:center">${mlogo(m)}<span><b>${esc(m.nome)}</b><small class="blk">${(m.areas || []).map(a => IC[a] + ' ' + a).join(' · ') || 'Sem área'} · ${q} ${q == 1 ? 'produto' : 'produtos'}</small></span></span><span><button class="lnk" onclick="formMarcaProds('${m.id}')">Produtos</button><button class="lnk" onclick="formMarca('${m.id}')">Editar</button><button class="lnk red" onclick="excluiMarca('${m.id}')">Excluir</button></span></div>`; }).join('') || '<p class="mut">Nenhuma marca ainda.</p>'}
  <button class="btn w" onclick="formMarca()">+ Nova marca / fornecedor</button>`);
}
function formMarca(id) {
  const m = (S.mc || []).find(x => x.id == id) || { areas: [] };
  modal(`<h2>${id ? 'Editar' : 'Nova'} marca / fornecedor</h2><form onsubmit="salvaMarca(event,'${id || ''}')">
  <input class="inp" name="nome" maxlength="40" placeholder="Nome da marca" value="${esc(m.nome)}" required>
  <div><small>Prazo de troca deste fornecedor (dias)</small><input class="inp" name="prazo_troca" type="number" min="0" max="365" placeholder="Ex: 15, 7 ou 3" value="${m.prazo_troca ?? ''}"></div>
  <input class="inp" name="cnpj" inputmode="numeric" maxlength="20" placeholder="CNPJ do fornecedor (opcional: reconhece a NF sozinho)" value="${esc(m.cnpj || '')}">
  <small>Em quais áreas você trabalha com ela?</small>
  <div class="tiles" style="grid-template-columns:1fr 1fr">${CATS.map(k => `<label class="tile" style="flex-direction:row;justify-content:center;gap:8px"><input type="checkbox" name="areas" value="${k}" ${(m.areas || []).includes(k) ? 'checked' : ''}>${IC[k]} ${k}</label>`).join('')}</div>
  ${m.logo ? `<div style="margin:6px 0">${mlogo(m)} <small>Logo atual. Escolha outra imagem abaixo só se quiser trocar.</small></div>` : ''}
  <label><small>Logo da marca (imagem PNG ou JPG)</small><input class="inp" name="logo" type="file" accept="image/*"></label>
  <button class="btn w">Salvar marca</button><button type="button" class="btn alt w" style="margin-top:8px" onclick="formMarcas()">Voltar</button></form>`);
}
async function salvaMarca(e, id) {
  e.preventDefault();
  const fd = new FormData(e.target), nome = fd.get('nome').trim().replace(/\s+/g, ' '), areas = fd.getAll('areas');
  if (!areas.length) return toast('Escolha ao menos uma área');
  if ((S.mc || []).some(m => nz(m.nome) == nz(nome) && m.id != id)) return toast('Já existe uma marca com esse nome');
  const pz = fd.get('prazo_troca'), d = { nome, areas, prazo_troca: pz === '' || pz == null ? null : Math.max(0, Math.min(365, +pz || 0)), cnpj: String(fd.get('cnpj') || '').replace(/\D/g, '') || null }, file = fd.get('logo');
  if (file && file.size) { try { d.logo = await redimLogo(file); } catch (x) { return toast('Não consegui ler essa imagem'); } }
  const r = id ? await db.from('marcas').update(d).eq('id', id) : await db.from('marcas').insert(d);
  if (r.error) { if (ehDuplicado(r.error)) { await load(); render(); formMarcas(); return toast('Essa marca já existe: atualizei a lista'); } return toast('Erro: ' + r.error.message); }
  await load(); render(); formMarcas(); toast('Marca salva');
}
async function excluiMarca(id) {
  const m = S.mc.find(x => x.id == id); if (!m) return;
  const q = S.pr.filter(p => p.marca_id == id).length;
  if (!confirm(`Excluir a marca "${m.nome}"?${q ? `\n\nOs ${q} produtos continuam no catálogo, só ficam sem marca.` : ''}`)) return;
  const { error } = await db.from('marcas').delete().eq('id', id);
  if (error) return toast('Erro: ' + error.message);
  await load(); render(); formMarcas(); toast('Marca excluída');
}
function formMarcaProds(id) {
  const m = S.mc.find(x => x.id == id); if (!m) return;
  const l = S.pr.filter(p => !(m.areas || []).length || m.areas.includes(p.categoria));
  modal(`<h2>Produtos de ${esc(m.nome)}</h2><p class="mut">Marque os produtos que são desta marca.</p>
  <form onsubmit="salvaMarcaProds(event,'${id}')"><button type="button" class="lnk" onclick="document.querySelectorAll('#modal [name=p]').forEach(c => c.checked = true)">Marcar todos</button>
  ${l.map(p => `<label class="card row"><span style="display:flex;gap:10px;align-items:center">${foto(p)}<span>${esc(p.nome)}<small class="blk">${IC[p.categoria]} ${p.categoria}${p.marca_id && p.marca_id != id ? ' · hoje: ' + esc((marcaDe(p) || {}).nome || '') : ''}</small></span></span><input type="checkbox" name="p" value="${p.id}" ${p.marca_id == id ? 'checked' : ''}></label>`).join('') || '<p class="mut">Nenhum produto nas áreas desta marca.</p>'}
  <button class="btn w">Salvar</button><button type="button" class="btn alt w" style="margin-top:8px" onclick="formMarcas()">Voltar</button></form>`);
}
async function salvaMarcaProds(e, id) {
  e.preventDefault();
  const cs = [...e.target.querySelectorAll('[name=p]')], on = cs.filter(x => x.checked).map(x => x.value);
  const off = cs.filter(x => !x.checked && (S.pr.find(p => p.id == x.value) || {}).marca_id == id).map(x => x.value);
  if (on.length) { const r = await db.from('produtos').update({ marca_id: id }).in('id', on); if (r.error) return toast('Erro: ' + r.error.message); }
  if (off.length) await db.from('produtos').update({ marca_id: null }).in('id', off);
  await load(); render(); formMarcas(); toast('Produtos atualizados');
}
function marcaOpts(sel) {
  const f = document.querySelector('#modal form'), a = f.categoria.value, l = (S.mc || []).filter(m => (m.areas || []).includes(a)), at = sel && (S.mc || []).find(m => m.id == sel);
  f.marca.innerHTML = '<option value="">Sem marca</option>' + l.map(m => `<option value="${m.id}" ${m.id == sel ? 'selected' : ''}>${esc(m.nome)}</option>`).join('') + (at && !l.some(m => m.id == sel) ? `<option value="${at.id}" selected>${esc(at.nome)}</option>` : '') + '<option value="__nova">➕ Criar nova marca…</option>';
  marcaNova();
}
function marcaNova() {
  const f = document.querySelector('#modal form'), on = f.marca.value == '__nova';
  f.nova_marca.hidden = !on; f.nova_marca.required = on; if (on) f.nova_marca.focus();
}
/* ===== PEDIDOS DE PRODUTOS (o que o cliente procurou e você não tem) ===== */
let PR = { f: 'novas' }, PREPROD = null;
const SGT = { novas: ['nova'], avaliando: ['analise'], comprar: ['viavel'], atendidas: ['atendida', 'avisada'], descartadas: ['descartada'] };
const sgKey = t => nz(String(t || '')).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim().split(' ').map(w => w.length > 3 ? w.replace(/s$/, '') : w).join(' ');
const sgChave = x => sgKey(x.produto) || x.id;
const sgVisto = () => { try { return new Date(localStorage.getItem('rs_sg_visto') || 0); } catch (e) { return new Date(0); } };
const sgMarcaVisto = () => { try { localStorage.setItem('rs_sg_visto', new Date().toISOString()); } catch (e) {} };
const sgPend = () => (S.sg || []).filter(x => x.status == 'nova');
const sgNovas = () => sgPend().filter(x => new Date(x.criado_em) > sgVisto());
function sgResumo(lista) {
  const o = {};
  (lista || sgPend()).forEach(x => { const k = sgChave(x); o[k] = o[k] || { n: 0, nome: x.produto.trim() }; o[k].n++; });
  return Object.values(o).sort((a, b) => b.n - a.n).slice(0, 3).map(x => `${x.nome} (${x.n})`).join(', ');
}
function sgGrupos(f) {
  const g = {};
  (S.sg || []).filter(x => SGT[f].includes(x.status)).forEach(x => { const k = sgChave(x); (g[k] = g[k] || { k, l: [] }).l.push(x); });
  const top = o => Object.entries(o).sort((a, b) => b[1] - a[1]).map(e => e[0])[0] || '';
  const prim = (l, c) => { const r = l.find(x => x[c] != null && x[c] !== ''); return r ? r[c] : null; };
  return Object.values(g).map(o => {
    const nomes = {}, cats = {};
    o.l.forEach(x => { const n = x.produto.trim(); nomes[n] = (nomes[n] || 0) + 1; if (x.categoria) cats[x.categoria] = (cats[x.categoria] || 0) + 1; });
    return { ...o, nome: top(nomes), cat: top(cats), n: o.l.length, ult: o.l[0].criado_em, custo: prim(o.l, 'custo_est'), preco: prim(o.l, 'preco_est'), obs: prim(o.l, 'obs'), pessoas: new Set(o.l.map(x => x.telefone || x.nome || x.id)).size };
  }).sort((a, b) => b.n - a.n || new Date(b.ult) - new Date(a.ult));
}
function margemMedia() {
  const l = S.pr.filter(p => p.custo != null && p.preco > 0), t = sum(l, p => p.preco);
  return t ? sum(l, p => p.preco - p.custo) / t : null;
}
function sgCard(x, i, max, antes) {
  const f = PR.f, det = [...new Set(x.l.map(p => (p.detalhes || '').trim()).filter(Boolean))].slice(0, 3);
  const mg = x.preco > 0 && x.custo != null ? (x.preco - x.custo) / x.preco : null;
  const acao = p => !p.telefone ? '' : f == 'atendidas' ? (p.status == 'avisada' ? '<small class="grn">✓ avisada</small>' : `<button class="btn" onclick="sgAvisar('${p.id}')">Avisar que chegou</button>`) : f == 'descartadas' ? '' : `<button class="lnk" onclick="sgZap('${p.id}')">Responder</button>`;
  const botoes = { novas: `<button class="btn" onclick="sgAnalisar('${x.k}')">Analisar se vale comprar</button><button class="btn alt" onclick="sgStatus('${x.k}','descartada')">Descartar</button>`,
    avaliando: `<button class="btn" onclick="sgAnalisar('${x.k}')">Editar análise</button><button class="btn alt" onclick="sgStatus('${x.k}','viavel')">✅ Vou comprar</button><button class="btn alt red" onclick="sgStatus('${x.k}','descartada')">❌ Não viável</button>`,
    comprar: `<button class="btn" onclick="sgCadastrar('${x.k}')">Cadastrar no catálogo</button><button class="btn alt" onclick="sgAnalisar('${x.k}')">Ver análise</button><button class="btn alt" onclick="sgStatus('${x.k}','analise')">Voltar p/ avaliando</button>`,
    atendidas: `<button class="btn alt" onclick="sgStatus('${x.k}','nova')">Reabrir</button>`, descartadas: `<button class="btn alt" onclick="sgStatus('${x.k}','nova')">Reabrir</button>` }[f];
  return `<div class="card"><div class="row"><b>${i + 1}º · ${esc(x.nome)}</b><em class="tag ${x.n >= 3 ? 'bad' : 'wait'}">${x.n} ${x.n == 1 ? 'pedido' : 'pedidos'}</em></div>
  <div class="barra"><i style="width:${Math.max(6, x.n / max * 100)}%"></i></div>
  <small class="blk">${x.cat ? IC[x.cat] + ' ' + x.cat + ' · ' : ''}${x.pessoas} ${x.pessoas == 1 ? 'pessoa' : 'pessoas'} · último pedido em ${new Date(x.ult).toLocaleDateString('pt-BR')}</small>
  ${det.map(d => `<small class="blk">💬 “${esc(d)}”</small>`).join('')}
  ${x.preco > 0 || x.custo != null ? `<small class="blk">📊 Custo ${x.custo != null ? ocv(R(x.custo)) : '—'} · venda ${x.preco > 0 ? R(x.preco) : '—'}${mg != null ? ' · margem ' + ocv(pct(mg)) : ''}</small>` : ''}${x.obs ? `<small class="blk">📝 ${esc(x.obs)}</small>` : ''}
  <details><summary class="lnk">Quem pediu (${x.l.length})</summary>${x.l.map(p => `<div class="row" style="margin-top:6px"><small>${esc(p.nome || 'Sem nome')}${p.telefone ? ' · ' + esc(p.telefone) : ''}${p.status == 'nova' && new Date(p.criado_em) > antes ? ' <em class="tag wait">novo</em>' : ''}</small>${acao(p)}</div>`).join('')}</details>
  <div class="row" style="margin-top:8px">${botoes}</div></div>`;
}
function procuras() {
  const antes = sgVisto(); sgMarcaVisto();
  const g = sgGrupos(PR.f), max = g[0] ? g[0].n : 1, pe = sgGrupos('novas');
  const abas = [['novas', 'Novas'], ['avaliando', 'Avaliando'], ['comprar', 'Vou comprar'], ['atendidas', 'Atendidas'], ['descartadas', 'Descartadas']];
  return `<h1>Pedidos de produtos</h1><p class="mut">Produtos que seus clientes pediram no catálogo e você ainda não tem. Analise se vale comprar, cadastre e avise quem pediu.</p>
  <div class="grid"><div class="card"><small>Aguardando análise</small><b class="blk">${sgPend().length}</b></div><div class="card"><small>Mais pedido</small><b class="blk" style="font-size:1rem">${pe[0] ? esc(pe[0].nome) + ' (' + pe[0].n + ')' : '—'}</b></div></div>
  <div class="row" style="justify-content:flex-start">${abas.map(([k, l]) => `<button class="btn ${PR.f == k ? '' : 'alt'}" onclick="PR.f='${k}';render()">${l} (${sgGrupos(k).length})</button>`).join('')}</div>
  ${g.map((x, i) => sgCard(x, i, max, antes)).join('') || `<p class="mut">${PR.f == 'novas' ? 'Nenhum pedido novo. Quando um cliente pedir algo que não está no catálogo, aparece aqui.' : 'Nada por aqui ainda.'}</p>`}`;
}
async function sgStatus(k, para) {
  const ids = S.sg.filter(x => sgChave(x) == k && SGT[PR.f].includes(x.status)).map(x => x.id);
  const { error } = await db.from('sugestoes').update({ status: para }).in('id', ids);
  if (error) return toast('Erro: ' + error.message);
  await load(); render();
  toast({ descartada: 'Descartado', nova: 'Voltou para Novas', viavel: 'Movido para Vou comprar', analise: 'Movido para Avaliando' }[para]);
}
function sgAnalisar(k) {
  const g = sgGrupos(PR.f).find(x => x.k == k); if (!g) return;
  modal(`<h2>Vale a pena comprar?</h2><p class="mut"><b>${esc(g.nome)}</b> · ${g.n} ${g.n == 1 ? 'pedido' : 'pedidos'} de ${g.pessoas} ${g.pessoas == 1 ? 'pessoa' : 'pessoas'}</p>
  <form onsubmit="event.preventDefault();sgGravar('${k}','analise')">
  <div><small>Quanto você pagaria por unidade (custo, R$)</small>${eyeBtn()}<input class="inp ci" name="custo" type="text" autocomplete="off" inputmode="decimal" value="${g.custo ?? ''}" oninput="sgCalc()"></div>
  <label><small>Por quanto venderia (R$)</small><input class="inp" name="preco" type="number" step="0.01" min="0" inputmode="decimal" value="${g.preco ?? ''}" oninput="sgCalc()"></label>
  <div class="card" id="sgm" data-n="${g.n}"></div>
  <textarea class="inp" name="obs" rows="2" placeholder="Fornecedor, prazo, quantidade mínima...">${esc(g.obs || '')}</textarea>
  <button class="btn w">Salvar análise (continua em Avaliando)</button>
  <button type="button" class="btn w" style="margin-top:8px;background:#15803d" onclick="sgGravar('${k}','viavel')">✅ É viável: vou comprar</button>
  <button type="button" class="btn alt w red" style="margin-top:8px" onclick="sgGravar('${k}','descartada')">❌ Não é viável</button></form>`);
  sgCalc();
}
function sgCalc() {
  const f = document.querySelector('#modal form'), b = $('#sgm'); if (!f || !b) return;
  const c = numOc(f.custo.value), p = +f.preco.value, n = +b.dataset.n || 1;
  if (!(p > 0) || f.custo.value === '') { b.innerHTML = '<small>Informe o custo e o preço de venda para ver a margem.</small>'; return; }
  const lu = p - c, m = lu / p, mm = margemMedia();
  b.innerHTML = `<div class="row"><span>Lucro por unidade</span><b class="ocw ${lu >= 0 ? 'grn' : 'red'}">${ocv(R(lu))}</b></div><div class="row"><span>Margem</span><b class="ocw ${m >= 0.4 ? 'grn' : m >= 0.2 ? '' : 'red'}">${ocv(pct(m))}</b></div>
  <small class="blk">${m >= 0.4 ? '✅ Margem saudável' : m >= 0.2 ? '⚠️ Margem apertada' : '❌ Margem baixa'}${mm != null ? ' · sua margem média hoje: ' : ''}${mm != null ? ocv(pct(mm)) : ''}</small>
  <small class="blk">Se vender 1 para cada pedido (${n}): ${R(n * p)} em vendas e ${ocv(R(n * lu))} de lucro.</small>`;
}
async function sgGravar(k, st) {
  const f = document.querySelector('#modal form'), v = n => f[n].value.trim();
  const ids = S.sg.filter(x => sgChave(x) == k && SGT[PR.f].includes(x.status)).map(x => x.id);
  const d = { status: st, custo_est: numOc(v('custo')), preco_est: v('preco') === '' ? null : +v('preco'), obs: v('obs') || null };
  const { error } = await db.from('sugestoes').update(d).in('id', ids);
  if (error) return toast('Erro: ' + error.message);
  fecha(); PR.f = { analise: 'avaliando', viavel: 'comprar', descartada: 'descartadas' }[st];
  await load(); render(); toast({ analise: 'Análise salva', viavel: 'Marcado para comprar 👍', descartada: 'Marcado como não viável' }[st]);
}
function sgCadastrar(k) {
  const g = sgGrupos(PR.f).find(x => x.k == k); if (!g) return;
  go('catalogo'); PREPROD = { nome: g.nome, categoria: g.cat, preco: g.preco, custo: g.custo, sg: k }; formProd();
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
let VP = { q: '', cat: 'Todos', sub: '', marca: '' };
const vitrineVenda = () => S.pr.length ? `<div class="card"><small>📸 Toque na foto para adicionar (toque de novo para somar mais um)</small>
  <input class="inp" id="vpq" placeholder="Buscar produto ou código SKU" oninput="VP.q=this.value;vpDesenha()" onkeydown="if(event.key=='Enter')event.preventDefault()">
  <div class="fchips" id="vpc"></div><div class="fchips" id="vpm"></div><div class="fchips" id="vps"></div><div class="vpg" id="vpg"></div></div>` : '';
function vpBadges() {
  const g = $('#vpg'); if (!g) return;
  const m = {};
  document.querySelectorAll('#its .it').forEach(r => { const id = r.querySelector('select').value; if (id) m[id] = (m[id] || 0) + (+r.querySelector('[name=quantidade]').value || 0); });
  g.querySelectorAll('.vpt').forEach(t => { const q = m[t.dataset.pid] || 0, b = t.querySelector('.vpb'), n = t.querySelector('.vpm'); t.classList.toggle('on', q > 0); b.textContent = '×' + q; b.hidden = !q; n.hidden = !q; });
}
function vpDesenha() {
  const c = $('#vpc'), g = $('#vpg'); if (!c || !g) return;
  const cats = ['Todos', ...CATS.filter(k => S.pr.some(p => p.categoria == k))], q = nz(VP.q);
  c.innerHTML = cats.map(k => `<button type="button" class="vpcat ${VP.cat == k ? 'on' : ''}" onclick="VP.cat='${k}';VP.sub='';VP.marca='';vpDesenha()">${k}</button>`).join('');
  const sc = VP.cat == 'Todos' ? [] : [...new Set(S.pr.filter(p => p.categoria == VP.cat && p.subcategoria).map(p => p.subcategoria))], vs = $('#vps');
  if (vs) vs.innerHTML = sc.length ? ['', ...sc].map(n => `<button type="button" class="vpcat ${VP.sub == n ? 'on' : ''}" data-s="${esc(n)}" onclick="VP.sub=this.dataset.s;vpDesenha()">${n === '' ? 'Todas' : esc(n)}</button>`).join('') : '';
  const mc = VP.cat == 'Todos' ? [] : S.mc.filter(m => S.pr.some(p => p.categoria == VP.cat && p.marca_id == m.id)), vm = $('#vpm');
  if (vm) vm.innerHTML = mc.length ? [['', 'Todas as marcas'], ...mc.map(m => [m.id, m.nome])].map(([v, t]) => `<button type="button" class="vpcat ${VP.marca == v ? 'on' : ''}" data-m="${v}" onclick="VP.marca=this.dataset.m;vpDesenha()">${esc(t)}</button>`).join('') : '';
  const l = S.pr.filter(p => (VP.cat == 'Todos' || p.categoria == VP.cat) && (!VP.sub || p.subcategoria == VP.sub) && (!VP.marca || p.marca_id == VP.marca) && (!q || nz(p.nome + ' ' + skuDe(p) + ' ' + (p.subcategoria || '') + ' ' + ((marcaDe(p) || {}).nome || '')).includes(q)));
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
  return `<div class="two"><div class="card"><h2>Lucro por categoria ${eyeBtn()}</h2><small>Todas as vendas · margem = lucro ÷ vendido</small>
  ${pc.map(([k, l]) => `<div class="row" style="margin-top:8px"><span>${IC[k]} ${k}<small class="blk">margem ${ocv(pct(l.margem))}</small></span><b class="ocw ${l.lucro >= 0 ? 'grn' : 'red'}">${l.base ? ocv(R(l.lucro)) : '—'}</b></div>`).join('') || '<small class="blk">Sem vendas ainda.</small>'}
  ${avisoCusto(L)}</div>
  <div class="card"><h2>Produtos mais lucrativos</h2>${tp.map(([n, o]) => `<div class="row"><small>${esc(n)}</small><b class="ocw grn">${ocv(R(o.l))}</b></div>`).join('') || '<small>Informe o preço de custo nos produtos para ver o lucro.</small>'}</div></div>`;
}
function lucroRel(vs) {
  const its = vs.flatMap(v => v.itens_venda || []), L = lucroDe(its), pc = lucroPorCat(its), tp = lucroPorProd(its, 8);
  const cts = F.cli ? [] : S.ct.filter(x => (!F.de || x.vencimento >= F.de) && (!F.ate || x.vencimento <= F.ate));
  const cc = sum(cts.filter(x => x.tipo == 'cartao'), x => x.valor), cv = sum(cts.filter(x => x.tipo != 'cartao'), x => x.valor);
  return `<div class="grid"><div class="card"><small>Lucro bruto no período</small><b class="blk ocw ${L.lucro >= 0 ? 'grn' : 'red'}">${ocv(R(L.lucro))}</b></div>
  <div class="card"><small>Margem de lucro</small><b class="blk">${ocv(pct(L.margem))}</b></div></div>${avisoCusto(L)}
  <h2>Lucro por categoria ${eyeBtn()}</h2>${pc.map(([k, l]) => `<div class="card row"><span>${IC[k]} ${k}<small class="blk">vendido ${R(l.total)} · margem ${ocv(pct(l.margem))}</small></span><b class="ocw ${l.lucro >= 0 ? 'grn' : 'red'}">${l.base ? ocv(R(l.lucro)) : '—'}</b></div>`).join('') || '<p class="mut">Sem vendas neste filtro.</p>'}
  <h2>Produtos mais lucrativos</h2>${tp.map(([n, o]) => `<div class="card row"><span>${esc(n)}<small class="blk">${o.q} un.</small></span><b class="ocw grn">${ocv(R(o.l))}</b></div>`).join('') || '<p class="mut">Informe o custo dos produtos para ver o lucro.</p>'}
  ${F.cli ? '' : `<h2>Lucro × contas do período</h2><div class="card"><div class="row"><span>Contas a pagar no período<small class="blk">Cartão ${R(cc)} · À vista ${R(cv)}</small></span><b class="red">${R(cc + cv)}</b></div>
  <div class="row" style="margin-top:8px"><span>Lucro bruto − contas</span><b class="ocw ${L.lucro - cc - cv >= 0 ? 'grn' : 'red'}">${ocv(R(L.lucro - cc - cv))}</b></div>
  <small class="blk">As contas incluem compras de estoque, que já estão no custo dos produtos vendidos. Use como visão de fôlego do caixa.</small></div>`}`;
}
const lucroTag = v => { const l = lucroDe(v.itens_venda || []); return l.base ? `<small class="blk ocw ${l.lucro >= 0 ? 'grn' : 'red'}">Lucro: ${ocv(R(l.lucro))}</small>` : ''; };
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
    nfUrgentes().length && ['🧾', 'Prazo de troca acabando', `${nfUrgentes().length} ${nfUrgentes().length == 1 ? 'nota' : 'notas'} · ${nfForn(nfUrgentes()[0])} (${nfDias(nfUrgentes()[0]) == 0 ? 'vence hoje' : nfDias(nfUrgentes()[0]) + ' dia(s)'})`, "NF.f='prazo';go('notas')", 'bad'],
    sgPend().length && ['🔎', 'Clientes pedindo produtos que você não tem', `${sgPend().length} aguardando análise · ${sgResumo()}`, "PR.f='novas';go('procuras')", 'warn'],
    atr.length && ['🔴', 'Parcelas atrasadas', `${atr.length} · ${R(sum(atr, x => x.falta))}`, "COB.f='atrasadas';go('cobranca')", 'bad'],
    hj.length && ['📅', 'Vencem hoje', `${hj.length} · ${R(sum(hj, x => x.falta))}`, "COB.f='hoje';go('cobranca')", 'warn'],
    ent.length && ['🚚', 'Entregas pendentes', String(ent.length), "H.st='Entrega pendente';go('historico')", ''],
    S.pd.length && ['🛒', 'Pedidos novos do catálogo', String(S.pd.length), "PD.f='novos';go('pedidos')", 'warn'],
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
    <div class="card kpi"><small>LUCRO NO MÊS ${eyeBtn()}</small><b class="ocw ${LM.lucro >= 0 ? 'grn' : 'red'}">${LM.base ? ocv(R(LM.lucro)) : '—'}</b><small>${LM.base ? 'margem ' + ocv(pct(LM.margem)) : 'informe o custo dos produtos'}</small></div>
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
  <div><small>Custo un. (R$, opcional)</small>${eyeBtn()}<input class="inp ci" name="custo" type="text" autocomplete="off" inputmode="decimal" placeholder="0,00"></div>
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
  const itens = [...document.querySelectorAll('.it')].map(r => ({ produto: q(r, 'produto'), categoria: q(r, 'categoria'), quantidade: +q(r, 'quantidade'), preco_unit: +q(r, 'preco'), custo_unit: numOc(q(r, 'custo')) }));
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

/* ===== CATEGORIAS DENTRO DE CADA ÁREA ===== */
const subsDe = a => (S.sc || []).filter(s => s.area == a).map(s => s.nome);
function linhaProd(p) {
  return `<div class="card row">${foto(p)}<b class="grow">${esc(p.nome)}<small class="blk">SKU: ${esc(skuDe(p))}${marcaDe(p) ? ' · ' + esc(marcaDe(p).nome) : ''}${p.n_fotos > 1 ? ' · 📷' + p.n_fotos : ''}${p.tam_consulta ? ' · 📏 consultar' : (p.tamanhos || []).length ? ' · 📏 ' + p.tamanhos.join('/') : ''}${p.custo != null && p.preco > 0 ? ` · custo ${ocv(R(p.custo))} · margem ${ocv(pct((p.preco - p.custo) / p.preco))}` : ''}</small></b><span>${R(p.preco)} ${(S.nf || []).some(n => (n.produtos || []).includes(p.id)) ? `<button class="lnk" onclick="NF.p='${p.id}';NF.f='todas';NF.q='';go('notas')">🧾 NF</button> ` : ''}<button class="lnk" onclick="formProd('${p.id}')">Editar</button> <button class="lnk" onclick="del('produtos','${p.id}')">Excluir</button></span></div>`;
}
function catalogo() {
  const PRL = S.pr.filter(p => !CF.m || (CF.m == '__sem' ? !p.marca_id : p.marca_id == CF.m));
  const area = k => {
    const l = PRL.filter(p => p.categoria == k), nomes = [...new Set([...subsDe(k), ...l.map(p => p.subcategoria).filter(Boolean)])];
    const bloco = (t, arr, vazio) => arr.length || vazio ? `<h3 class="subt">${esc(t)} <small>(${arr.length})</small></h3>` + arr.map(linhaProd).join('') : '';
    return l.length || nomes.length ? `<h2>${IC[k]} ${k}</h2>` + nomes.map(n => bloco(n, l.filter(p => p.subcategoria == n), true)).join('') + bloco(nomes.length ? 'Sem categoria' : 'Produtos', l.filter(p => !p.subcategoria || !nomes.includes(p.subcategoria))) : '';
  };
  return `<div class="row"><h1>Catálogo</h1><span><button class="btn alt" onclick="formMarcas()">🏷️ Marcas</button> <button class="btn alt" onclick="formCats()">🗂️ Categorias</button> <button class="btn" onclick="formProd()">+ Novo produto</button></span></div>
  <div class="card"><small>🔗 Link da vitrine para seus clientes</small><b class="blk" style="word-break:break-all">${LINK()}</b>
  <div class="row" style="margin-top:8px"><button class="btn" onclick="copiaLink()">Copiar link</button><a class="btn alt" target="_blank" href="https://wa.me/?text=${encodeURIComponent('Veja nosso catálogo: ' + LINK())}">Enviar no WhatsApp</a></div></div>
  ${S.mc.length ? `<div class="fchips">${[['', 'Todas as marcas'], ...S.mc.map(m => [m.id, m.nome]), ['__sem', 'Sem marca']].map(([v, t]) => `<button class="vpcat ${CF.m == v ? 'on' : ''}" onclick="CF.m='${v}';render()">${esc(t)}</button>`).join('')}</div>` : ''}
  ${CATS.map(area).join('')}
  ${S.pr.length ? '' : '<p class="mut">Catálogo vazio. Cadastre seus produtos para escolher na hora da venda.</p>'}`;
}
function formCats() {
  modal(`<h2>🗂️ Categorias</h2><p class="mut">Crie categorias dentro de cada área (ex.: Camisas, Bermudas, Shorts). No catálogo do cliente elas aparecem assim que tiverem produtos.</p>
  ${CATS.map(k => `<div class="card"><b>${IC[k]} ${k}</b>
    ${(S.sc || []).filter(s => s.area == k).map(s => { const q = S.pr.filter(p => p.categoria == k && p.subcategoria == s.nome).length; return `<div class="row" style="margin-top:6px"><span>${esc(s.nome)} <small>(${q})</small></span><span><button class="lnk" onclick="renomeiaSub('${s.id}')">Renomear</button><button class="lnk red" onclick="excluiSub('${s.id}')">Excluir</button></span></div>`; }).join('') || '<small class="blk">Nenhuma categoria ainda.</small>'}
    <form class="row" style="margin-top:8px;flex-wrap:nowrap" onsubmit="criaSub(event,'${k}')"><input class="inp" name="n" maxlength="40" placeholder="Nova categoria em ${k}" required style="margin:0"><button class="btn">Criar</button></form></div>`).join('')}`);
}
async function criaSub(e, area) {
  e.preventDefault();
  const n = e.target.n.value.trim().replace(/\s+/g, ' ');
  if (!n) return;
  if (subsDe(area).some(x => nz(x) == nz(n))) return toast('Essa categoria já existe em ' + area);
  const { error } = await db.from('subcategorias').insert({ area, nome: n });
  if (error && !ehDuplicado(error)) return toast('Erro: ' + error.message);
  await load(); render(); formCats(); toast(error ? 'Essa categoria já existia: atualizei a lista' : 'Categoria criada');
}
async function renomeiaSub(id) {
  const s = S.sc.find(x => x.id == id); if (!s) return;
  const n = (prompt('Novo nome da categoria:', s.nome) || '').trim().replace(/\s+/g, ' ');
  if (!n || n == s.nome) return;
  if (subsDe(s.area).some(x => nz(x) == nz(n) && x != s.nome)) return toast('Já existe uma categoria com esse nome');
  let r = await db.from('subcategorias').update({ nome: n }).eq('id', id);
  if (r.error) return toast('Erro: ' + r.error.message);
  await db.from('produtos').update({ subcategoria: n }).eq('categoria', s.area).eq('subcategoria', s.nome);
  await load(); render(); formCats(); toast('Categoria renomeada');
}
async function excluiSub(id) {
  const s = S.sc.find(x => x.id == id); if (!s) return;
  const q = S.pr.filter(p => p.categoria == s.area && p.subcategoria == s.nome).length;
  if (!confirm(`Excluir a categoria "${s.nome}"?${q ? `\n\nOs ${q} produtos continuam no catálogo, só ficam sem categoria.` : ''}`)) return;
  await db.from('produtos').update({ subcategoria: null }).eq('categoria', s.area).eq('subcategoria', s.nome);
  const { error } = await db.from('subcategorias').delete().eq('id', id);
  if (error) return toast('Erro: ' + error.message);
  await load(); render(); formCats(); toast('Categoria excluída');
}
function subOpts(sel) {
  const f = document.querySelector('#modal form'), a = f.categoria.value;
  f.subcategoria.innerHTML = `<option value="">Sem categoria em ${a}</option>` + subsDe(a).map(n => `<option ${n == sel ? 'selected' : ''}>${esc(n)}</option>`).join('') + '<option value="__nova">➕ Criar nova categoria…</option>';
  subNova();
}
function subNova() {
  const f = document.querySelector('#modal form'), on = f.subcategoria.value == '__nova';
  f.nova_sub.hidden = !on; f.nova_sub.required = on; if (on) f.nova_sub.focus();
}
function formProd(id) {
  const p = S.pr.find(x => x.id == id) || (!id && PREPROD ? PREPROD : {});
  const pp = PREPROD; modal(`<h2>${id ? 'Editar' : 'Novo'} produto</h2><form onsubmit="salvaProd(event,'${id || ''}')">
  <input class="inp" name="nome" placeholder="Nome do produto" value="${esc(p.nome)}" required>
  <input class="inp" name="sku" placeholder="Código SKU (vazio = gerar automático)" value="${esc(p.sku)}">
  <select class="inp" name="categoria" onchange="subOpts();marcaOpts()">${opts(CATS)}</select>
  <select class="inp" name="subcategoria" onchange="subNova()"></select>
  <input class="inp" name="nova_sub" maxlength="40" placeholder="Nome da nova categoria (ex: Camisas)" hidden>
  <select class="inp" name="marca" onchange="marcaNova()"></select>
  <input class="inp" name="nova_marca" maxlength="40" placeholder="Nome da nova marca / fornecedor" hidden>
  <input class="inp" name="preco" type="number" step="0.01" min="0" inputmode="decimal" placeholder="Preço de venda (R$)" value="${p.preco ?? ''}" required>
  <div><small>Preço de custo (R$): quanto você pagou</small>${eyeBtn()}<input class="inp ci" name="custo" type="text" autocomplete="off" inputmode="decimal" placeholder="0,00" value="${p.custo ?? ''}"></div>
  <textarea class="inp" name="descricao" rows="5" maxlength="2000" placeholder="Descrição do produto (o que é, como usar, composição, cuidados...). Aparece na tela do produto no catálogo.">${esc(p.descricao)}</textarea>
  ${tamHtml(p)}
  <div class="card"><div class="row"><small>📷 Fotos do produto (até 5): a primeira é a principal</small><small id="ftc"></small></div><div class="fts" id="fts"></div></div>
  <label class="row"><span>Mostrar na vitrine online</span><input type="checkbox" name="vitrine" ${p.vitrine === false ? '' : 'checked'}></label>
  <button class="btn w">Salvar produto</button></form>`);
  PREPROD = pp;
  if (p.categoria) document.querySelector('#modal [name=categoria]').value = p.categoria;
  subOpts(p.subcategoria); marcaOpts(p.marca_id); ftInit(id, p);
}
async function salvaProd(e, id) {
  e.preventDefault();
  const pp = !id && PREPROD ? PREPROD : null;
  const fd = new FormData(e.target), d = { nome: fd.get('nome'), categoria: fd.get('categoria'), preco: +fd.get('preco'), custo: numOc(fd.get('custo')), vitrine: fd.get('vitrine') == 'on', sku: (fd.get('sku') || '').trim() || skuNovo(fd.get('categoria')) };
  let sub = fd.get('subcategoria') || '';
  if (sub == '__nova') {
    sub = (fd.get('nova_sub') || '').trim().replace(/\s+/g, ' ');
    if (sub) { try { sub = await garanteSub(d.categoria, sub); } catch (er) { return toast('Erro: ' + er.message); } }
  }
  d.subcategoria = sub || null;
  let mid = fd.get('marca') || null;
  if (mid == '__nova') {
    const nm = (fd.get('nova_marca') || '').trim().replace(/\s+/g, ' '); mid = null;
    if (nm) {
      const ex = S.mc.find(m => nz(m.nome) == nz(nm));
      if (ex) { mid = ex.id; if (!(ex.areas || []).includes(d.categoria)) await db.from('marcas').update({ areas: [...(ex.areas || []), d.categoria] }).eq('id', ex.id); }
      else {
        const r = await db.from('marcas').insert({ nome: nm, areas: [d.categoria] }).select().single();
        if (r.error && !ehDuplicado(r.error)) return toast('Erro: ' + r.error.message);
        await load();
        const e2 = r.error ? S.mc.find(m => nz(m.nome) == nz(nm)) : r.data;
        if (!e2) return toast('Erro: não consegui criar a marca');
        mid = e2.id;
      }
    }
  }
  d.marca_id = mid;
  const modo = fd.get('tmodo') || 'nenhum';
  d.tamanhos = modo == 'lista' ? fd.getAll('tam').map(t => String(t).replace(/:/g, '')) : [];
  d.tam_consulta = modo == 'consulta';
  d.descricao = (fd.get('descricao') || '').trim() || null;
  if (FTD) { d.foto = FT[0] ? await redimN(FT[0], 420, 0.8) : null; d.n_fotos = FT.length; }
  const SQLDE = { tamanhos: 'atualizacao-fotos-tamanhos.sql', tam_consulta: 'atualizacao-fotos-tamanhos.sql', n_fotos: 'atualizacao-fotos-tamanhos.sql', marca_id: 'atualizacao-marcas.sql', subcategoria: 'atualizacao-categorias.sql', custo: 'atualizacao-lucro.sql', sku: 'atualizacao-inicio.sql', descricao: 'atualizacao-descricao.sql' }, perdidos = [];
  let r0;
  for (let i = 0; i < 8; i++) {
    r0 = id ? await db.from('produtos').update(d).eq('id', id).select('id').single() : await db.from('produtos').insert(d).select('id').single();
    const mc = r0.error && /Could not find the '([a-z_]+)' column/i.exec(r0.error.message || '');
    if (mc && SQLDE[mc[1]] && mc[1] in d) { perdidos.push(mc[1]); delete d[mc[1]]; continue; }
    break;
  }
  if (r0.error) return toast('Erro: ' + r0.error.message);
  if (perdidos.length) alert('Produto salvo, mas o banco ainda não tem estes campos: ' + perdidos.join(', ') + '.\n\nPara guardá-los, rode o arquivo ' + [...new Set(perdidos.map(c => SQLDE[c]))].join(' e ') + ' no Supabase (SQL Editor) e salve o produto de novo.');
  if (FTD && !perdidos.includes('n_fotos')) {
    await db.from('produto_fotos').delete().eq('produto_id', r0.data.id);
    if (FT.length) { const rf = await db.from('produto_fotos').insert(FT.map((url, i) => ({ produto_id: r0.data.id, ordem: i, url }))); if (rf.error) toast('Produto salvo, mas as fotos deram erro: ' + rf.error.message); }
  }
  if (pp) { const ids = S.sg.filter(x => ['nova', 'analise', 'viavel'].includes(x.status) && sgChave(x) == pp.sg).map(x => x.id); if (ids.length) await db.from('sugestoes').update({ status: 'atendida' }).in('id', ids); }
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
  const saldo = recebido - saidas, LP = lucroDe(itens), showL = !OCULTO;
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
${showL ? `<div class="kp" style="margin-top:10px"><div class="${LP.lucro >= 0 ? 'g' : 'r'}"><small>Lucro bruto</small><b>${R(LP.lucro)}</b></div><div><small>Margem de lucro</small><b>${pct(LP.margem)}</b></div><div class="y"><small>Custo dos produtos vendidos</small><b>${R(LP.custo)}</b></div></div>
${LP.total > 0 && LP.cobertura < 0.999 ? `<p style="color:#8a96ad;font-size:10px;margin:6px 0 0">Lucro calculado sobre ${pct(LP.cobertura)} das vendas (as demais não têm custo informado).</p>` : ''}` : ''}
<h2>Vendas por categoria</h2>
${tb(['Categoria', 'Unidades', 'Total'], CATS.map(k => { const l = itens.filter(t => t.categoria == k); return [k, sum(l, t => t.quantidade), R(sum(l, t => t.quantidade * t.preco_unit))]; }))}
<h2>Produtos mais vendidos</h2>
${tb(['Produto', 'Unidades'], top.map(([n, q]) => [esc(n), q]))}
${showL ? `<h2>Lucro por categoria</h2>
${tb(['Categoria', 'Vendido', 'Custo', 'Lucro', 'Margem'], lucroPorCat(itens).map(([k, l]) => [k, R(l.total), R(l.custo), l.base ? R(l.lucro) : '—', l.base ? pct(l.margem) : '—']))}
<h2>Produtos mais lucrativos</h2>
${tb(['Produto', 'Unidades', 'Lucro'], lucroPorProd(itens, 10).map(([n, o]) => [esc(n), o.q, R(o.l)]))}` : ''}
<h2>Previsão de recebimento por mês</h2>
${tb(['Mês', 'Parcelas', 'Valor total', 'Falta receber'], prev)}
<h2>Parcelas em atraso</h2>
${tb(['Cliente', 'Parcela', 'Vencimento', 'Falta receber'], atras.sort((a, b) => a.vencimento < b.vencimento ? -1 : 1).map(x => [esc(x.c.nome), x.numero + 'ª', dt(x.vencimento), R(x.falta)]))}
<h2>Recebimentos no período</h2>
${tb(['Data', 'Cliente', 'Forma', 'Valor'], ps.map(p => [new Date(p.criado_em).toLocaleDateString('pt-BR'), nome(p.cliente_id), esc(p.forma || '—'), R(p.valor)]))}
${F.cli ? '' : `<h2>Contas a pagar</h2>
${tb(['Descrição', 'Forma', 'Vencimento', 'Valor', 'Situação'], [...cts].sort((a, b) => a.vencimento < b.vencimento ? -1 : 1).map(x => [esc(x.descricao) + (x.parcelas_total > 1 ? ` (${x.parcela_num}/${x.parcelas_total})` : ''), esc(x.forma || '—'), dt(x.vencimento), R(x.valor), st(x.pago ? 'Pago' : (x.vencimento < HOJE ? 'Atrasado' : 'A vencer'))]))}`}
<h2>Vendas detalhadas (${vs.length})</h2>
${tb(['Data', 'Cliente', 'Itens', 'Total', ...(showL ? ['Lucro'] : []), 'Situação'], vs.map(v => { const lv = lucroDe(v.itens_venda || []); return [new Date(v.data).toLocaleDateString('pt-BR'), nome(v.cliente_id), v.itens_venda.map(t => t.quantidade + '× ' + esc(t.produto)).join(', '), R(v.total), ...(showL ? [lv.base ? R(lv.lucro) : '—'] : []), st(stVenda(v))]; }))}
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
  ${cardTema()}
  ${cardCatalogo()}
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
  PKEY = ''; PDATES = []; VP = { q: '', cat: 'Todos', sub: '', marca: '' }; vpDesenha();
  if (EDIT) { AUTO = null; return carregaEdicao(); }
  if (PRE) { PEDIDO = PRE.pedido; PRE.itens.forEach(i => { addItem(); fillRow($('#its').lastElementChild, i); }); const pagoPre = PRE.pago; PRE = null; if (pagoPre) { const ff = $('#view form'); ff.pago.value = Number(pagoPre).toFixed(2); ff.forma.value = 'Pix'; } toast(pagoPre ? 'Pedido carregado com o valor do Pix. Confira se o Pix caiu na conta antes de registrar.' : PEDIDO ? 'Pedido carregado. Confira e registre a venda.' : 'Produto adicionado. Escolha o cliente e registre a venda.'); }
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

let PD = { f: 'novos' };
const PDS = { novos: ['novo'], analise: ['analise'], vendidos: ['convertido'], recusados: ['recusado'] };
const pagTxt = p => p.pagamento == 'pix_total' ? `<small class="blk">💸 Pix do valor total: ${R(p.valor_pix)} · confira se caiu na conta${p.pix_txid ? ' (código ' + esc(p.pix_txid) + ')' : ''}</small>`
  : p.pagamento == 'pix_entrada' ? `<small class="blk">💸 Pix de entrada: ${R(p.valor_pix)} · restante ${R(p.total - p.valor_pix)}${p.pix_txid ? ' (código ' + esc(p.pix_txid) + ')' : ''}</small>`
  : p.pagamento == 'combinar' ? '<small class="blk">🤝 Cliente quer combinar o pagamento</small>' : '';
function pedCard(p) {
  const st = p.status, itens = p.itens || [];
  const linha = i => {
    const pr = S.pr.find(x => x.id == i.id);
    const av = !pr ? ' <em class="tag bad">não cadastrado</em>' : Math.abs(Number(pr.preco) - Number(i.preco)) > 0.005 ? ` <em class="tag wait">preço agora ${R(pr.preco)}</em>` : '';
    return `<small class="blk">${i.qtd}× ${esc(i.nome)} — ${R(i.preco)}${av}</small>`;
  };
  return `<div class="card"><div class="row"><b>${esc(p.nome)} ${st == 'analise' ? '<em class="tag wait">Em análise</em>' : ''}</b><b>${R(p.total)}</b></div><small class="blk">${esc(p.telefone || '')} · ${D(p.criado_em)}</small>
  ${pagTxt(p)}${etapaUI(p)}${p.obs ? `<small class="blk">📝 ${esc(p.obs)}</small>` : ''}
  ${itens.map(linha).join('')}
  <div class="row" style="margin-top:8px">${st == 'novo' || st == 'analise' ? `<button class="btn" onclick="virarVenda('${p.id}')">Viável: virar venda</button>${st == 'novo' ? `<button class="btn alt" onclick="pedStatus('${p.id}','analise')">Em análise</button>` : ''}<button class="btn alt red" onclick="pedStatus('${p.id}','recusado')">Não viável</button>` : st == 'recusado' ? `<button class="btn alt" onclick="pedStatus('${p.id}','novo')">Reabrir</button>` : '<small class="grn">✓ virou venda</small>'}
  ${p.telefone ? `<button class="lnk" onclick="pedZap('${p.id}')">WhatsApp</button>` : ''}<button class="lnk red" onclick="del('pedidos','${p.id}')">Excluir</button></div></div>`;
}
function pedidos() {
  const pt = S.pt || [], cont = k => pt.filter(p => PDS[k].includes(p.status)).length, l = pt.filter(p => PDS[PD.f].includes(p.status));
  return `<h1>Pedidos online</h1><p class="mut">Pedidos feitos pelos clientes no catálogo. Confira se os itens estão disponíveis e decida: <b>Viável</b> (vira venda) ou <b>Não viável</b>. O pedido fica guardado em cada lista.</p>
  <div class="row" style="justify-content:flex-start">${[['novos', 'Novos'], ['analise', 'Em análise'], ['vendidos', 'Vendidos'], ['recusados', 'Não viáveis']].map(([k, t]) => `<button class="btn ${PD.f == k ? '' : 'alt'}" onclick="PD.f='${k}';render()">${t} (${cont(k)})</button>`).join('')}</div>
  ${l.map(pedCard).join('') || '<p class="mut">Nenhum pedido nesta lista.</p>'}`;
}
async function pedStatus(id, st) {
  const { error } = await db.from('pedidos').update({ status: st }).eq('id', id);
  if (error) return toast('Erro: ' + error.message);
  PD.f = { analise: 'analise', recusado: 'recusados', novo: 'novos' }[st] || PD.f;
  await load(); render(); toast({ analise: 'Movido para Em análise', recusado: 'Marcado como não viável', novo: 'Pedido reaberto' }[st] || 'Atualizado');
}
function pedZap(id) {
  const p = (S.pt || []).find(x => x.id == id); if (!p) return;
  const t = p.status == 'recusado' ? `Olá, ${p.nome}! Obrigada pelo seu pedido 💜\n\nInfelizmente não conseguimos atender dessa vez, mas já anotei seu interesse para as próximas novidades. Posso te ajudar com outra opção?`
    : p.status == 'convertido' ? `Olá, ${p.nome}! Seu pedido foi confirmado. Obrigada pela compra na Rozivaldo Store! 💜`
    : `Olá, ${p.nome}! Recebi seu pedido de ${R(p.total)} pelo catálogo da Rozivaldo Store 💜\n\nEstou conferindo a disponibilidade e já te retorno!`;
  window.open(zapLink(p, t), '_blank');
}
async function virarVenda(id) {
  const p = S.pt.find(x => x.id == id), d = (p.telefone || '').replace(/\D/g, '');
  let c = S.c.find(x => d && (x.telefone || '').replace(/\D/g, '') == d);
  if (!c) {
    const r = await db.from('clientes').insert({ nome: p.nome, telefone: p.telefone }).select().single();
    if (r.error) return toast('Erro: ' + r.error.message);
    c = r.data; await load();
  }
  PRE = { pedido: id, itens: p.itens.map(i => ({ pid: i.id, produto: i.nome, categoria: i.categoria, qtd: i.qtd, preco: (S.pr.find(x => x.id == i.id) || i).preco })), pago: p.pagamento == 'pix_total' ? p.total : p.pagamento == 'pix_entrada' ? p.valor_pix : 0 };
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
  if (data.session) { await load(); const g = new URLSearchParams(location.search).get('go'); if (['venda', 'cobranca', 'fluxo', 'contas', 'historico', 'clientes', 'dash'].includes(g)) cur = g; render(); const nv = sgNovas(); if (nv.length) setTimeout(() => toast('🔎 ' + nv.length + (nv.length == 1 ? ' novo pedido' : ' novos pedidos') + ' de produto: ' + sgResumo(nv)), 700); }
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
