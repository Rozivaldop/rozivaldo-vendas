# Rozivaldo Vendas: passo a passo

## Arquivos do projeto
```
rozivaldo-vendas/
├── index.html    (tela do sistema)
├── style.css     (visual)
├── app.js        (funcionamento)
├── config.js     (você vai colar suas chaves aqui)
├── schema.sql    (cria as tabelas no banco)
└── README.md     (este guia)
```
As tabelas são: `clientes`, `vendas`, `itens_venda` (produtos de cada venda, com categoria) e `pagamentos`.

## 1. Criar o banco (Supabase)
1. Acesse **supabase.com** e clique em **Start your project**. Entre com sua conta do GitHub (crie uma em github.com se não tiver) ou com e-mail.
2. Clique em **New project**. Nome: `rozivaldo-vendas`. Crie e **anote a senha do banco**. Região: **South America (São Paulo)**. Clique em **Create new project** e aguarde 2 minutos.
3. No menu da esquerda, clique em **SQL Editor** → **New query**.
4. Abra o arquivo `schema.sql`, copie tudo, cole no editor e clique em **Run**. Deve aparecer "Success".

## 2. Criar seu login
1. Menu esquerdo → **Authentication** → **Users** → **Add user** → **Create new user**.
2. Digite seu e-mail e uma senha forte. Marque **Auto Confirm User**. Clique em **Create user**.
3. Ainda em Authentication, abra **Sign In / Providers** (ou "Providers" → Email) e **desligue "Allow new users to sign up"**. Assim ninguém mais cria conta no seu sistema. Salve.

## 3. Copiar as chaves
1. Menu esquerdo → **Project Settings** (engrenagem) → **API** (ou "Data API").
2. Copie a **Project URL** e a chave **anon public** (também aparece como "Publishable key").
3. Abra `config.js` no Bloco de Notas, troque os dois textos entre aspas pelos valores copiados e salve. Não use a chave `service_role`.

## 4. Colocar no GitHub
1. Em **github.com**, clique em **+** (canto superior) → **New repository**. Nome: `rozivaldo-vendas`. Deixe **Private**. Clique em **Create repository**.
2. Clique no link **uploading an existing file**.
3. Arraste para a página os arquivos `index.html`, `style.css`, `app.js` e `config.js` (pode incluir `schema.sql` e `README.md`). Não arraste a pasta, só os arquivos.
4. Clique em **Commit changes**.

## 5. Publicar na Vercel
1. Acesse **vercel.com** → **Sign Up** → **Continue with GitHub**.
2. Clique em **Add New… → Project**, ache `rozivaldo-vendas` e clique em **Import** (se não aparecer, clique em "Adjust GitHub App Permissions" e libere o repositório).
3. Não mude nada. Clique em **Deploy**.
4. Em cerca de 1 minuto aparece o endereço (algo como `rozivaldo-vendas.vercel.app`). Abra, entre com o e-mail e a senha do passo 2.
5. No celular, abra o endereço e use **Adicionar à tela inicial** para virar um ícone.

## Atualizar o sistema depois
No GitHub, abra o arquivo → lápis (Edit) → altere → **Commit changes**. A Vercel republica sozinha.

## Como usar
- **Clientes → Novo cliente**: cadastra. Tocar no cliente abre a ficha (compras, total comprado, total pago, saldo devedor).
- **Nova venda**: escolha o cliente, adicione os itens (categoria, quantidade, preço) e informe o valor pago agora (vazio = fiado).
- **Receber pagamento** (na ficha): registra a baixa com data e hora e atualiza o saldo.
- **Início**: vendido no mês e no geral, recebido, total a receber e lista de devedores.
