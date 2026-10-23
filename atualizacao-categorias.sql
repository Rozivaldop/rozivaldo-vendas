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
