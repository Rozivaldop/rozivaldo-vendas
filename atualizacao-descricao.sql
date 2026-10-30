-- Cole no SQL Editor do Supabase e clique em Run
-- Descrição do produto (aparece na tela do produto no catálogo)
alter table produtos add column if not exists descricao text;
notify pgrst, 'reload schema';
