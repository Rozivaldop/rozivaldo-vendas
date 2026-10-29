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
