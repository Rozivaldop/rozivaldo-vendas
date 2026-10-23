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
