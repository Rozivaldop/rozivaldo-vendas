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
