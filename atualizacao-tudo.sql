-- ============================================================
-- ROZIVALDO STORE: ATUALIZAÇÃO COMPLETA DO BANCO
-- Cole TUDO no SQL Editor do Supabase e clique em Run.
-- Pode rodar quantas vezes quiser: não apaga dados e só cria o que falta.
-- ============================================================

-- ---------- atualizacao-catalogo.sql ----------
-- Cole no SQL Editor do Supabase e clique em Run
-- 1) Corrige o erro "coluna vitrine não encontrada"
alter table produtos add column if not exists vitrine boolean not null default true;

-- 2) Tabela de pedidos feitos pelos clientes no catálogo online
create table if not exists pedidos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  telefone text,
  itens jsonb not null default '[]',
  total numeric(12,2) not null default 0,
  status text not null default 'novo',
  criado_em timestamptz default now()
);
alter table pedidos enable row level security;
drop policy if exists acesso_logado on pedidos;
create policy acesso_logado on pedidos for all to authenticated using (true) with check (true);
drop policy if exists cliente_envia on pedidos;
create policy cliente_envia on pedidos for insert to anon with check (status = 'novo');

-- 3) Catálogo público: visitantes só enxergam produtos marcados para a vitrine
alter table produtos enable row level security;
drop policy if exists acesso_logado on produtos;
create policy acesso_logado on produtos for all to authenticated using (true) with check (true);
drop policy if exists vitrine_publica on produtos;
create policy vitrine_publica on produtos for select to anon using (vitrine = true);

notify pgrst, 'reload schema';

-- ---------- atualizacao-inicio.sql ----------
-- Cole no SQL Editor do Supabase e clique em Run
alter table produtos add column if not exists sku text;
alter table produtos add column if not exists criado_em timestamptz default now();
update produtos set sku = 'RS' || upper(substr(replace(id::text, '-', ''), 1, 8)) where sku is null;
notify pgrst, 'reload schema';

-- ---------- atualizacao-recebimentos-contas.sql ----------
-- Cole no SQL Editor do Supabase e clique em Run

-- 1) Recebimento amarrado a uma venda (se a venda for excluída, o recebimento some junto)
alter table pagamentos add column if not exists ref_venda_id uuid references vendas(id) on delete cascade;

-- 2) Contas a pagar com forma de pagamento (cartão, Pix, dinheiro...) e parcelas
alter table contas add column if not exists forma text;
alter table contas add column if not exists tipo text;
alter table contas add column if not exists parcela_num int not null default 1;
alter table contas add column if not exists parcelas_total int not null default 1;
alter table contas add column if not exists grupo uuid;

notify pgrst, 'reload schema';

-- ---------- atualizacao-lucro.sql ----------
-- Cole no SQL Editor do Supabase e clique em Run
alter table produtos add column if not exists custo numeric(12,2);
alter table itens_venda add column if not exists custo_unit numeric(12,2);
notify pgrst, 'reload schema';

-- ---------- atualizacao-sugestoes.sql ----------
-- Cole no SQL Editor do Supabase e clique em Run
-- Pedidos de produtos que o cliente não encontrou no catálogo
create table if not exists sugestoes (
  id uuid primary key default gen_random_uuid(),
  produto text not null check (char_length(produto) between 2 and 120),
  categoria text check (categoria is null or char_length(categoria) <= 30),
  detalhes text check (detalhes is null or char_length(detalhes) <= 500),
  nome text check (nome is null or char_length(nome) <= 80),
  telefone text check (telefone is null or char_length(telefone) <= 20),
  status text not null default 'nova',
  criado_em timestamptz default now()
);
alter table sugestoes enable row level security;
drop policy if exists acesso_logado on sugestoes;
create policy acesso_logado on sugestoes for all to authenticated using (true) with check (true);
drop policy if exists cliente_sugere on sugestoes;
create policy cliente_sugere on sugestoes for insert to anon with check (status = 'nova');
notify pgrst, 'reload schema';

-- ---------- atualizacao-sugestoes2.sql ----------
-- Cole no SQL Editor do Supabase e clique em Run
-- Análise de viabilidade dos produtos que os clientes pediram
alter table sugestoes add column if not exists custo_est numeric(12,2);
alter table sugestoes add column if not exists preco_est numeric(12,2);
alter table sugestoes add column if not exists obs text;
notify pgrst, 'reload schema';

-- ---------- atualizacao-categorias.sql ----------
-- Cole no SQL Editor do Supabase e clique em Run
-- Categorias dentro de cada área (Masculino, Feminino, Lingerie, Sexshop)
create table if not exists subcategorias (
  id uuid primary key default gen_random_uuid(),
  area text not null check (area in ('Masculino','Feminino','Lingerie','Sexshop')),
  nome text not null check (char_length(nome) between 1 and 40),
  criado_em timestamptz default now()
);
create unique index if not exists subcategorias_unica on subcategorias (area, lower(nome));
alter table subcategorias enable row level security;
drop policy if exists acesso_logado on subcategorias;
create policy acesso_logado on subcategorias for all to authenticated using (true) with check (true);
drop policy if exists catalogo_publico on subcategorias;
create policy catalogo_publico on subcategorias for select to anon using (true);

alter table produtos add column if not exists subcategoria text;
notify pgrst, 'reload schema';

-- ---------- atualizacao-marcas.sql ----------
-- Cole no SQL Editor do Supabase e clique em Run
-- Marcas / fornecedores (com logo) e vínculo com os produtos
create table if not exists marcas (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(nome) between 1 and 40),
  logo text,
  areas text[] not null default '{}',
  criado_em timestamptz default now()
);
create unique index if not exists marcas_unica on marcas (lower(nome));
alter table marcas enable row level security;
drop policy if exists acesso_logado on marcas;
create policy acesso_logado on marcas for all to authenticated using (true) with check (true);
drop policy if exists catalogo_publico on marcas;
create policy catalogo_publico on marcas for select to anon using (true);

alter table produtos add column if not exists marca_id uuid references marcas(id) on delete set null;

-- Suas marcas (as logos são os arquivos marca-*.png enviados junto ao site)
insert into marcas (nome, logo, areas) values
  ('Crosby',      'marca-crosby.png',      '{Masculino}'),
  ('Sarru',       'marca-sarru.png',       '{Masculino,Feminino}'),
  ('Del Rayssa',  'marca-delrayssa.png',   '{Lingerie}'),
  ('Diamantes',   'marca-diamantes.png',   '{Lingerie}'),
  ('Intt',        'marca-intt.png',        '{Sexshop}'),
  ('Hot Flowers', 'marca-hotflowers.png',  '{Sexshop}')
on conflict do nothing;

notify pgrst, 'reload schema';

-- ---------- atualizacao-fotos-tamanhos.sql ----------
-- Cole no SQL Editor do Supabase e clique em Run
-- Várias fotos por produto (até 5) e tamanhos disponíveis
alter table produtos add column if not exists tamanhos text[] not null default '{}';
alter table produtos add column if not exists tam_consulta boolean not null default false;
alter table produtos add column if not exists n_fotos int not null default 0;

create table if not exists produto_fotos (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid not null references produtos(id) on delete cascade,
  ordem int not null default 0,
  url text not null,
  criado_em timestamptz default now()
);
create index if not exists produto_fotos_prod on produto_fotos (produto_id, ordem);
alter table produto_fotos enable row level security;
drop policy if exists acesso_logado on produto_fotos;
create policy acesso_logado on produto_fotos for all to authenticated using (true) with check (true);
drop policy if exists catalogo_publico on produto_fotos;
create policy catalogo_publico on produto_fotos for select to anon
  using (exists (select 1 from produtos p where p.id = produto_id and p.vitrine = true));

notify pgrst, 'reload schema';

-- ---------- atualizacao-notas.sql ----------
-- Cole no SQL Editor do Supabase e clique em Run
-- Notas fiscais de compra (escaneadas) com prazo de troca por fornecedor

-- 1) Prazo de troca e CNPJ no cadastro da marca/fornecedor
alter table marcas add column if not exists prazo_troca int check (prazo_troca is null or prazo_troca between 0 and 365);
alter table marcas add column if not exists cnpj text;

-- 2) Tabela das notas
create table if not exists notas (
  id uuid primary key default gen_random_uuid(),
  marca_id uuid references marcas(id) on delete set null,
  fornecedor text,
  numero text,
  chave text,
  data_compra date not null,
  prazo_dias int not null default 7 check (prazo_dias between 0 and 365),
  valor numeric(12,2),
  itens text,
  produtos uuid[] not null default '{}',
  arquivos jsonb not null default '[]',
  thumb text,
  resolvida boolean not null default false,
  obs text,
  criado_em timestamptz default now()
);
create index if not exists notas_data on notas (data_compra);
alter table notas enable row level security;
drop policy if exists acesso_logado on notas;
create policy acesso_logado on notas for all to authenticated using (true) with check (true);

-- 3) Armazenamento PRIVADO dos arquivos (só quem fez login acessa)
insert into storage.buckets (id, name, public) values ('notas', 'notas', false) on conflict (id) do nothing;
drop policy if exists notas_arquivos on storage.objects;
create policy notas_arquivos on storage.objects for all to authenticated
  using (bucket_id = 'notas') with check (bucket_id = 'notas');

notify pgrst, 'reload schema';

-- ---------- atualizacao-pedidos-pix.sql ----------
-- Cole no SQL Editor do Supabase e clique em Run
-- Pagamento por Pix nos pedidos feitos pelo catálogo
alter table pedidos add column if not exists pagamento text;      -- pix_total, pix_entrada ou combinar
alter table pedidos add column if not exists valor_pix numeric(12,2);
alter table pedidos add column if not exists pix_txid text;
alter table pedidos add column if not exists obs text;
notify pgrst, 'reload schema';

-- ---------- atualizacao-catalogo-virtual.sql ----------
-- Cole no SQL Editor do Supabase e clique em Run
-- Catálogo virtual: anúncios editáveis, textos/contatos, etapas do pedido e "Acompanhar pedido"

-- 1) Anúncios (banners) editáveis
create table if not exists anuncios (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (char_length(titulo) <= 80),
  subtitulo text check (subtitulo is null or char_length(subtitulo) <= 140),
  texto_botao text check (texto_botao is null or char_length(texto_botao) <= 30),
  imagem text,
  cor_fundo text not null default '#111111',
  cor_texto text not null default '#ffffff',
  link_tipo text not null default 'nenhum',
  link_valor text,
  ordem int not null default 0,
  ativo boolean not null default true,
  inicio date,
  fim date,
  criado_em timestamptz default now()
);
alter table anuncios enable row level security;
drop policy if exists acesso_logado on anuncios;
create policy acesso_logado on anuncios for all to authenticated using (true) with check (true);
drop policy if exists anuncios_publico on anuncios;
create policy anuncios_publico on anuncios for select to anon
  using (ativo and (inicio is null or inicio <= current_date) and (fim is null or fim >= current_date));

-- 2) Textos e contatos do catálogo (faixa do topo, WhatsApp, Instagram, horário, endereço)
create table if not exists configuracoes (
  chave text primary key,
  valor text
);
alter table configuracoes enable row level security;
drop policy if exists acesso_logado on configuracoes;
create policy acesso_logado on configuracoes for all to authenticated using (true) with check (true);
drop policy if exists config_publica on configuracoes;
create policy config_publica on configuracoes for select to anon using (true);
insert into configuracoes (chave, valor) values
  ('faixa_texto', 'CATÁLOGO VIRTUAL · ROZIVALDO STORE'),
  ('faixa_ativa', 'true')
on conflict (chave) do nothing;

-- 3) Etapas do pedido (você define o passo a passo)
create table if not exists etapas_pedido (
  id uuid primary key default gen_random_uuid(),
  ordem int not null default 0,
  nome text not null check (char_length(nome) <= 50),
  descricao text
);
alter table etapas_pedido enable row level security;
drop policy if exists acesso_logado on etapas_pedido;
create policy acesso_logado on etapas_pedido for all to authenticated using (true) with check (true);
insert into etapas_pedido (ordem, nome, descricao)
select * from (values
  (1, 'Pedido recebido', 'Recebemos o seu pedido e já estamos conferindo.'),
  (2, 'Pagamento confirmado', 'Pagamento confirmado. Obrigada!'),
  (3, 'Separando suas peças', 'Estamos separando e embalando o seu pedido.'),
  (4, 'Enviado ou pronto para retirada', 'Seu pedido saiu para entrega ou está pronto para retirada.'),
  (5, 'Entregue', 'Pedido entregue. Esperamos que você ame!')
) v(ordem, nome, descricao)
where not exists (select 1 from etapas_pedido);

-- 4) Pedidos: código de acompanhamento e etapa atual
alter table pedidos add column if not exists codigo text;
alter table pedidos add column if not exists etapa_id uuid references etapas_pedido(id) on delete set null;
alter table pedidos add column if not exists etapa_em timestamptz;
update pedidos set codigo = 'RS' || upper(substr(md5(id::text), 1, 8)) where codigo is null;
create unique index if not exists pedidos_codigo_unico on pedidos (upper(codigo)) where codigo is not null;

create table if not exists historico_pedido (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references pedidos(id) on delete cascade,
  etapa_id uuid,
  etapa_nome text,
  nota text,
  em timestamptz default now()
);
create index if not exists historico_pedido_ped on historico_pedido (pedido_id, em);
alter table historico_pedido enable row level security;
drop policy if exists acesso_logado on historico_pedido;
create policy acesso_logado on historico_pedido for all to authenticated using (true) with check (true);

-- 5) Consulta segura: o cliente só vê o pedido se informar o CÓDIGO e o WHATSAPP corretos
create or replace function acompanhar_pedido(p_codigo text, p_telefone text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare ped pedidos%rowtype; tel text; pos int;
begin
  select * into ped from pedidos where upper(codigo) = upper(trim(p_codigo)) limit 1;
  if not found then return null; end if;
  tel := regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g');
  if length(tel) < 8 or right(regexp_replace(coalesce(ped.telefone, ''), '\D', '', 'g'), 8) <> right(tel, 8) then return null; end if;
  select coalesce((select t.rn from (select id, row_number() over (order by ordem) rn from etapas_pedido) t where t.id = ped.etapa_id), 1) into pos;
  return jsonb_build_object(
    'codigo', ped.codigo,
    'nome', split_part(coalesce(ped.nome, ''), ' ', 1),
    'total', ped.total,
    'pagamento', ped.pagamento,
    'valor_pix', ped.valor_pix,
    'criado_em', ped.criado_em,
    'status', ped.status,
    'etapa_pos', pos,
    'itens', coalesce(ped.itens, '[]'::jsonb),
    'etapas', (select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'nome', e.nome, 'descricao', e.descricao) order by e.ordem), '[]'::jsonb) from etapas_pedido e),
    'historico', (select coalesce(jsonb_agg(jsonb_build_object('etapa_id', h.etapa_id, 'etapa_nome', h.etapa_nome, 'nota', h.nota, 'em', h.em) order by h.em), '[]'::jsonb) from historico_pedido h where h.pedido_id = ped.id)
  );
end $$;
revoke all on function acompanhar_pedido(text, text) from public;
grant execute on function acompanhar_pedido(text, text) to anon, authenticated;

notify pgrst, 'reload schema';

-- ---------- atualizacao-descricao.sql ----------
-- Cole no SQL Editor do Supabase e clique em Run
-- Descrição do produto (aparece na tela do produto no catálogo)
alter table produtos add column if not exists descricao text;
notify pgrst, 'reload schema';
