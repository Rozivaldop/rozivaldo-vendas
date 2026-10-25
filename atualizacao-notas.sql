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
