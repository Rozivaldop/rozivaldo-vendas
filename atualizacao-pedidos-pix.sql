-- Cole no SQL Editor do Supabase e clique em Run
-- Pagamento por Pix nos pedidos feitos pelo catálogo
alter table pedidos add column if not exists pagamento text;      -- pix_total, pix_entrada ou combinar
alter table pedidos add column if not exists valor_pix numeric(12,2);
alter table pedidos add column if not exists pix_txid text;
alter table pedidos add column if not exists obs text;
notify pgrst, 'reload schema';
