# Login do sistema

## Acesso principal

O usuario principal do sistema e:

- Login: `admin`
- Senha: `SupreW4u`

## Como entrar

1. Inicie o sistema normalmente.
2. Abra a rota `/login`.
3. No campo `Login`, informe `admin`.
4. No campo `Senha`, informe `SupreW4u`.
5. Clique em `Entrar`.

## Como sair

1. No topo do sistema, clique no nome do usuario.
2. No menu dropdown, clique em `Sair`.

## Comportamento de seguranca

- Sem login, qualquer rota interna redireciona para `/login`.
- O sistema usa sessao para manter o usuario autenticado.
- O logout encerra a sessao atual.

## Observacao

O login aceita:

- nome do usuario
- ou email do usuario

No acesso principal, o recomendado e usar `admin`.
