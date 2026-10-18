-- Rozivaldo Vendas: cole TUDO isto no SQL Editor do Supabase e clique em Run

create table clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  telefone text,
  endereco text,
  observacoes text,
  criado_em timestamptz default now()
);

create table vendas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  data timestamptz default now(),
  total numeric(12,2) not null check (total >= 0)
);

create table itens_venda (
  id uuid primary key default gen_random_uuid(),
  venda_id uuid not null references vendas(id) on delete cascade,
  produto text not null,
  categoria text not null check (categoria in ('Masculino','Feminino','Lingerie','Sexshop')),
  quantidade int not null default 1 check (quantidade > 0),
  preco_unit numeric(12,2) not null check (preco_unit >= 0)
);

create table pagamentos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  venda_id uuid references vendas(id) on delete cascade,
  valor numeric(12,2) not null check (valor > 0),
  forma text default 'Dinheiro',
  criado_em timestamptz default now()
);

-- Segurança: só quem fez login enxerga ou altera os dados
do $$
declare t text;
begin
  foreach t in array array['clientes','vendas','itens_venda','pagamentos'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy acesso_logado on %I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;
