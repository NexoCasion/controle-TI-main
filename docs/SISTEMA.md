# Documentacao completa do sistema

## 1. Visao geral

Este projeto e um sistema web interno de controle de TI desenvolvido com:

- Node.js
- Express
- EJS
- Sequelize
- SQLite

O sistema foi construido para controlar o ciclo de vida de computadores e componentes, com foco em:

- cadastro e consulta de empresas
- cadastro e consulta de computadores
- manutencoes
- trocas de pecas
- condenacao de maquinas
- controle de materiais
- rastreabilidade de pecas em uso, recuperadas e baixadas
- dashboard inicial com indicadores reais do banco
- autenticacao por login e sessao

Hoje o sistema possui dois conceitos importantes para computadores:

- `LEGADO`: computador antigo, com specs tratadas principalmente como texto
- `ESTRUTURADO`: computador com componentes reais vinculados no banco

O objetivo atual do projeto esta claramente orientado para o modo `ESTRUTURADO`.

---

## 2. Stack e funcionamento tecnico

### Backend

- `Express` para rotas e renderizacao server-side
- `Sequelize` como ORM
- `SQLite` como banco local
- `express-session` com `connect-sqlite3` para sessao
- `helmet` para cabecalhos basicos de seguranca
- `express-rate-limit` na rota de login
- `bcrypt` para hash de senha

### Frontend

- `EJS` para renderizacao das telas
- `Bootstrap 5 beta` para modais, grid e componentes visuais
- JS inline nas views para fluxos dinamicos
- CSS principal em `src/public/css/app.css`

### Inicializacao

Arquivo principal:

- [`C:\Users\Universo Honda\Documents\controle-TI-main\controle-TI-main\src\index.js`](C:\Users\Universo Honda\Documents\controle-TI-main\controle-TI-main\src\index.js)

Fluxo de subida:

1. carrega `.env`
2. configura Express
3. configura seguranca, body parsers e arquivos estaticos
4. configura sessao SQLite
5. injeta `currentUser` em `res.locals`
6. monta as rotas
7. executa `ensureSchema()`
8. sobe o servidor

---

## 3. Estrutura principal de pastas

### Backend

- `src/index.js`
- `src/routes.js`
- `src/controllers/`
- `src/models/`
- `src/services/`
- `src/db/`
- `src/middlewares/`

### Views

- `src/views/pages/`
- `src/views/partials/`

### Frontend

- `src/public/css/`
- `src/public/js/` quando existir

### Documentacao

- `docs/`

---

## 4. Autenticacao e controle de acesso

### Objetivo

Todo o sistema interno e protegido por login. Nenhuma rota funcional deve ser usada sem sessao valida.

### Arquivos principais

- [`C:\Users\Universo Honda\Documents\controle-TI-main\controle-TI-main\src\controllers\auth.js`](C:\Users\Universo Honda\Documents\controle-TI-main\controle-TI-main\src\controllers\auth.js)
- [`C:\Users\Universo Honda\Documents\controle-TI-main\controle-TI-main\src\middlewares\auth.js`](C:\Users\Universo Honda\Documents\controle-TI-main\controle-TI-main\src\middlewares\auth.js)
- [`C:\Users\Universo Honda\Documents\controle-TI-main\controle-TI-main\src\models\User.js`](C:\Users\Universo Honda\Documents\controle-TI-main\controle-TI-main\src\models\User.js)
- [`C:\Users\Universo Honda\Documents\controle-TI-main\controle-TI-main\src\views\pages\login.ejs`](C:\Users\Universo Honda\Documents\controle-TI-main\controle-TI-main\src\views\pages\login.ejs)
- [`C:\Users\Universo Honda\Documents\controle-TI-main\controle-TI-main\src\views\pages\perfil.ejs`](C:\Users\Universo Honda\Documents\controle-TI-main\controle-TI-main\src\views\pages\perfil.ejs)

### Como funciona

- `GET /login`: abre a tela de login
- `POST /login`: autentica o usuario
- `POST /logout`: encerra a sessao
- `router.use(ensureAuth)`: protege todas as rotas abaixo do login

### Sessao

A sessao salva:

```js
req.session.user = {
  id,
  nome,
  role
}
```

### Usuario principal

O seed principal do admin e criado/atualizado por:

- [`C:\Users\Universo Honda\Documents\controle-TI-main\controle-TI-main\src\db\ensureSchema.js`](C:\Users\Universo Honda\Documents\controle-TI-main\controle-TI-main\src\db\ensureSchema.js)

Configuracao atual:

- login recomendado: `admin`
- senha inicial: `SupreW4u`

### Gestao de usuarios

Hoje a tela `/perfil` permite:

- visualizar o usuario logado
- cadastrar novos usuarios
- editar usuarios existentes
- trocar perfil
- ativar/inativar usuarios
- redefinir senha

Somente usuarios com `role = admin` veem a parte de gestao.

---

## 5. Modelos principais do banco

## 5.1 Empresa

Arquivo:

- [`C:\Users\Universo Honda\Documents\controle-TI-main\controle-TI-main\src\models\Empresa.js`](C:\Users\Universo Honda\Documents\controle-TI-main\controle-TI-main\src\models\Empresa.js)

Campos principais:

- `id`
- `nome`
- `sigla`
- `descricao`

Uso:

- representa unidade, loja, matriz ou departamento
- e usada em computadores, manutencoes e dashboard

## 5.2 Computador

Arquivo:

- [`C:\Users\Universo Honda\Documents\controle-TI-main\controle-TI-main\src\models\Computador.js`](C:\Users\Universo Honda\Documents\controle-TI-main\controle-TI-main\src\models\Computador.js)

Campos principais:

- `id`
- `patrimonio`
- `specs`
- `specs_override`
- `specs_modo`
- `specs_estruturadas`
- `empresaId`
- `setor`
- `ativo`
- `status`
- `dataDescarte`
- `motivoDescarte`

Observacoes:

- `patrimonio` deve ser unico
- `specs_modo` pode ser `LEGADO` ou `ESTRUTURADO`
- `status` guarda referencia de condenacao quando a maquina foi condenada

## 5.3 Manutencao

Arquivo:

- [`C:\Users\Universo Honda\Documents\controle-TI-main\controle-TI-main\src\models\Manutencao.js`](C:\Users\Universo Honda\Documents\controle-TI-main\controle-TI-main\src\models\Manutencao.js)

Campos principais:

- `id`
- `dataEntrada`
- `dataSaida`
- `descricao`
- `computadorId`

Regra importante:

- uma maquina nao pode ter mais de uma manutencao aberta ao mesmo tempo

## 5.4 ManutencaoItem

Arquivo:

- [`C:\Users\Universo Honda\Documents\controle-TI-main\controle-TI-main\src\models\ManutencaoItem.js`](C:\Users\Universo Honda\Documents\controle-TI-main\controle-TI-main\src\models\ManutencaoItem.js)

Campos principais:

- `id`
- `descricao`
- `manutencaoId`
- `tipo`
- `specs_antes`
- `specs_depois`
- `material_snapshot`

Uso:

- guarda o historico de procedimentos dentro da manutencao
- registra troca de peca, limpeza, manutencao simples e condenacao

## 5.5 Material

Arquivo:

- [`C:\Users\Universo Honda\Documents\controle-TI-main\controle-TI-main\src\models\Material.js`](C:\Users\Universo Honda\Documents\controle-TI-main\controle-TI-main\src\models\Material.js)

Campos principais:

- `id`
- `material`
- `tipo`
- `marca`
- `especificacao`
- `quantidade_disponivel`
- `quantidade_em_uso`
- `quantidade_baixada`
- `nf`

Uso:

- representa pecas e componentes do estoque

Tipos hoje usados com frequencia:

- `Processador`
- `Memoria`
- `Armazenamento`
- `Fonte`

## 5.6 Transferencia

Arquivo:

- [`C:\Users\Universo Honda\Documents\controle-TI-main\controle-TI-main\src\models\Transferencia.js`](C:\Users\Universo Honda\Documents\controle-TI-main\controle-TI-main\src\models\Transferencia.js)

Campos principais:

- `id`
- `data`
- `observacao`
- `emp_origem`
- `emp_destino`
- `computador`

Uso:

- registra movimentacao de computadores entre empresas/unidades

## 5.7 ComputadorMaterial

Arquivo:

- [`C:\Users\Universo Honda\Documents\controle-TI-main\controle-TI-main\src\models\ComputadorMaterial.js`](C:\Users\Universo Honda\Documents\controle-TI-main\controle-TI-main\src\models\ComputadorMaterial.js)

Uso:

- vinculo entre computador estruturado e seus componentes reais

Campos principais:

- `computador_id`
- `material_id`
- `quantidade`
- `categoria`
- `origem`

## 5.8 MaterialMovimento

Arquivo:

- [`C:\Users\Universo Honda\Documents\controle-TI-main\controle-TI-main\src\models\MaterialMovimento.js`](C:\Users\Universo Honda\Documents\controle-TI-main\controle-TI-main\src\models\MaterialMovimento.js)

Uso:

- trilha de movimentacao de estoque

Exemplos de tipo:

- `ENTRADA_ESTRUTURADO`
- `SAIDA_ESTRUTURADO`
- `SAIDA_MANUTENCAO`
- `ENTRADA_RECUPERACAO`
- `BAIXA`

## 5.9 ManutencaoMaterial

Arquivo:

- [`C:\Users\Universo Honda\Documents\controle-TI-main\controle-TI-main\src\models\ManutencaoMaterial.js`](C:\Users\Universo Honda\Documents\controle-TI-main\controle-TI-main\src\models\ManutencaoMaterial.js)

Uso:

- relaciona materiais usados em um item de manutencao

## 5.10 User

Arquivo:

- [`C:\Users\Universo Honda\Documents\controle-TI-main\controle-TI-main\src\models\User.js`](C:\Users\Universo Honda\Documents\controle-TI-main\controle-TI-main\src\models\User.js)

Campos principais:

- `id`
- `nome`
- `email`
- `password_hash`
- `role`
- `ativo`

---

## 6. Modulos funcionais do sistema

## 6.1 Dashboard / Home

Controller:

- [`C:\Users\Universo Honda\Documents\controle-TI-main\controle-TI-main\src\controllers\dashboard.js`](C:\Users\Universo Honda\Documents\controle-TI-main\controle-TI-main\src\controllers\dashboard.js)

Funcao:

- `getHomeData()`

Entrega:

- total de maquinas ativas
- total de maquinas geral
- total de manutencoes abertas
- total de empresas
- ranking de empresas com mais manutencoes
- maquinas ativas por empresa
- materiais disponiveis por tipo

Detalhes:

- usa dados reais do banco via Sequelize
- a home usa filtros por empresa nos graficos
- `DEPTO TI` pode ser excluido por padrao no grafico de manutencoes por unidade

## 6.2 Empresas

Controller:

- [`C:\Users\Universo Honda\Documents\controle-TI-main\controle-TI-main\src\controllers\empresa.js`](C:\Users\Universo Honda\Documents\controle-TI-main\controle-TI-main\src\controllers\empresa.js)

Permite:

- cadastrar empresa
- listar empresas
- fornecer empresas para selects e filtros

## 6.3 Computadores

Controller:

- [`C:\Users\Universo Honda\Documents\controle-TI-main\controle-TI-main\src\controllers\computador.js`](C:\Users\Universo Honda\Documents\controle-TI-main\controle-TI-main\src\controllers\computador.js)

Permite:

- criar computador legado
- editar computador
- paginar computadores
- buscar computador por id
- descartar e reativar
- importar CSV HWiNFO
- cadastrar estruturado manual
- converter existente para estruturado

Regras importantes:

- patrimonio unico
- computador estruturado recalcula specs a partir dos componentes
- computador legado ainda usa texto livre nas specs

## 6.4 Manutencoes

Controller:

- [`C:\Users\Universo Honda\Documents\controle-TI-main\controle-TI-main\src\controllers\manutencao.js`](C:\Users\Universo Honda\Documents\controle-TI-main\controle-TI-main\src\controllers\manutencao.js)

Permite:

- abrir manutencao
- listar manutencoes
- paginar manutencoes
- ver manutencao
- adicionar procedimentos
- encerrar manutencao
- condenar maquina
- condenar com recuperacao

Regras criticas:

- nao abre manutencao para computador condenado
- nao abre manutencao para maquina `LEGADO`
- nao permite duas manutencoes abertas na mesma maquina
- para maquinas estruturadas, troca de peca e condenacao trabalham sobre componentes reais

## 6.5 Materiais

Controller:

- [`C:\Users\Universo Honda\Documents\controle-TI-main\controle-TI-main\src\controllers\material.js`](C:\Users\Universo Honda\Documents\controle-TI-main\controle-TI-main\src\controllers\material.js)

Permite:

- listar materiais
- paginar materiais
- criar e editar material
- baixar material
- recuperar material
- consultar movimentos
- ver uso por maquina
- ver itens baixados
- ver itens recuperados

## 6.6 Transferencias

Controller:

- [`C:\Users\Universo Honda\Documents\controle-TI-main\controle-TI-main\src\controllers\transferencia.js`](C:\Users\Universo Honda\Documents\controle-TI-main\controle-TI-main\src\controllers\transferencia.js)

Uso:

- mover computador entre unidades
- manter historico de origem e destino

---

## 7. Modo legado x modo estruturado

Esse e um dos conceitos mais importantes do sistema.

### 7.1 Modo LEGADO

- specs armazenadas principalmente como texto
- maquina ainda nao tem composicao real em `computador_materiais`
- manutencao pesada nao deve seguir nesse modo

### 7.2 Modo ESTRUTURADO

- componentes reais vinculados no banco
- estoque e composicao da maquina passam a ser sincronizados
- troca de peca e condenacao ficam consistentes

### 7.3 Conversao de legado para estruturado

Pode acontecer por:

- cadastro manual
- importacao CSV
- conversao a partir de `ver-pc`
- conversao a partir de `manutencao`

Regra atual importante:

- a conversao atualiza a mesma maquina
- nao deve criar um novo computador quando o fluxo e de conversao

---

## 8. Importacao CSV HWiNFO

Arquivo principal:

- [`C:\Users\Universo Honda\Documents\controle-TI-main\controle-TI-main\src\services\hwinfoCsvParser.js`](C:\Users\Universo Honda\Documents\controle-TI-main\controle-TI-main\src\services\hwinfoCsvParser.js)

### O que o parser extrai

- nome/modelo do computador
- processador
- memorias
- armazenamentos
- fonte, quando informada manualmente ou no nome do arquivo
- ID AnyDesk, quando presente no conteudo do CSV

### Padrao de nome do arquivo

O nome do CSV pode seguir:

- `patrimonio-setor.csv`
- `patrimonio-setor-fonte.csv`
- ou formatos com mais hifens no setor, onde a primeira parte e o patrimonio, o miolo vira setor e a ultima parte pode virar fonte

Exemplos:

- `0012-TI.csv`
- `0012-TI-ATX250W.csv`
- `1000-OFICINA-DELL240W.csv`
- `1950-DeptoTI-TESTE-ID.csv`

### Regra de fonte

Se a fonte nao vier no CSV em si, o sistema pode usar:

- campo manual da tela de importacao
- ou a ultima parte do nome do arquivo quando existirem 3 ou mais blocos

### Regra de AnyDesk

Quando o CSV trouxer uma linha como `ID AnyDesk:` ou outro campo equivalente com `AnyDesk` no nome, o valor e salvo em `computadores.anydesk`.

### Regra de armazenamento

Mesmo quando o CSV traz NVMe, SSD ou HDD, o tipo do material e padronizado como:

- `Armazenamento`

E o detalhe `NVMe`, `SSD` etc fica no nome/material ou especificacao.

---

## 9. Service de computador estruturado

Arquivo:

- [`C:\Users\Universo Honda\Documents\controle-TI-main\controle-TI-main\src\services\computadorEstruturadoService.js`](C:\Users\Universo Honda\Documents\controle-TI-main\controle-TI-main\src\services\computadorEstruturadoService.js)

Responsabilidades:

- interpretar specs estruturadas
- vincular materiais ao computador
- criar ou reaproveitar materiais
- sincronizar `specs`, `specs_override` e `specs_estruturadas`
- substituir componente em troca de peca
- importar estrutura por CSV
- estruturar computador manualmente

Em resumo:

esse service e o coracao do modo estruturado.

---

## 10. Regras de negocio mais importantes

## 10.1 Patrimonio unico

Nao pode existir duplicidade de patrimonio entre computadores.

Suporte:

- validacao no backend
- tentativa de indice unico no banco

Observacao:

se o banco ja tiver duplicados antigos, o indice unico nao entra ate a limpeza desses dados.

## 10.2 Uma manutencao aberta por maquina

Uma maquina nao pode ter duas manutencoes abertas ao mesmo tempo.

## 10.3 Maquina condenada

Uma maquina condenada:

- fica inativa
- recebe `status`
- registra motivo e data
- nao deve abrir nova manutencao

## 10.4 Troca de peca estruturada

Na troca estruturada:

- a peca removida precisa existir naquela maquina
- a peca nova precisa ter tipo coerente com a removida
- o estoque e os vinculos estruturados sao atualizados
- o historico da manutencao guarda snapshot da troca

## 10.5 Condenacao com recuperacao

Na condenacao estruturada:

- pode recuperar parte dos componentes
- o restante vira defeito automaticamente
- se nada for selecionado, tudo vira defeito
- em maquina legado, sem estrutura, nao movimenta materiais

## 10.6 Login e permissao

- sem sessao, rotas internas redirecionam para `/login`
- usuario admin gerencia usuarios
- usuario tecnico usa o sistema normal, mas nao gerencia outros usuarios

---

## 11. Rotas principais do sistema

## 11.1 Autenticacao

- `GET /login`
- `POST /login`
- `POST /logout`
- `GET /perfil`
- `POST /perfil/usuarios`
- `POST /perfil/usuarios/:id`

## 11.2 Home

- `GET /`
- `GET /home` -> redireciona para `/`

## 11.3 Empresas

- `GET /register-empresa`
- `POST /register-empresa`
- `GET /empresas`
- `GET /get-empresas`

## 11.4 Computadores

- `GET /computadores`
- `GET /computadores-by-empresa`
- `GET /register-pc`
- `POST /register-pc`
- `GET /ver-pc`
- `GET /editar-pc`
- `POST /editar-pc`
- `POST /descartar-pc`
- `POST /reativar-pc`

## 11.5 Manutencoes

- `GET /manutencoes`
- `GET /manutencoes-data`
- `GET /manutencoes-open`
- `GET /manutencoes-by-computador`
- `GET /register-manutencao`
- `POST /register-manutencao`
- `GET /ver-manutencao`
- `POST /add-item-manutencao`
- `GET /get-itens-manutencao`
- `GET /encerrar-manutencao`
- `POST /condenar-pc`
- `POST /condenar-maquina`
- `POST /condenar-maquina-com-recuperacao`

## 11.6 Estruturado / CSV

- `GET /importar-csv`
- `POST /importar-csv`
- `POST /computadores/estruturado-manual`
- `POST /computadores/:id/estruturado-manual`
- `POST /computadores/:id/importar-hwinfo-csv`
- `GET /computadores/:id/componentes-estruturados`

## 11.7 Materiais

- `GET /materiais-page`
- `GET /materiais`
- `GET /materiais-data`
- `GET /materiais-tipos`
- `POST /materiais`
- `PUT /materiais/:id`
- `POST /materiais/baixar`
- `POST /materiais/recuperar`
- `GET /materiais/:id/movimentos`
- `GET /materiais/:id/uso-por-maquina`
- `GET /materiais/:id/baixados`
- `GET /materiais/:id/recuperados`

## 11.8 Transferencias

- `POST /transferir`

---

## 12. Fluxos operacionais principais

## 12.1 Cadastrar computador estruturado manualmente

1. abrir tela ou modal de cadastro estruturado
2. informar patrimonio, setor, empresa, modelo e componentes
3. salvar
4. o sistema:
   - cria o computador
   - cria/relaciona materiais
   - gera specs estruturadas
   - marca componentes em uso

## 12.2 Importar computador por CSV

1. abrir tela de importacao
2. enviar CSV no padrao HWiNFO
3. opcionalmente informar fonte
4. o sistema:
   - parseia o nome do arquivo
   - extrai patrimonio e setor
   - monta componentes
   - cria ou atualiza o computador estruturado

## 12.3 Converter maquina legado para estruturado

1. abrir `ver-pc` ou `manutencao`
2. iniciar conversao
3. escolher manual ou CSV
4. o sistema atualiza a mesma maquina

## 12.4 Abrir manutencao

1. selecionar computador
2. informar descricao
3. o sistema valida:
   - computador existente
   - nao condenado
   - modo estruturado
   - nenhuma manutencao aberta anterior

## 12.5 Troca de peca

1. abrir manutencao
2. adicionar procedimento `TROCA_PECA`
3. escolher tipo
4. escolher peca removida daquela maquina
5. escolher peca nova do estoque
6. salvar
7. o sistema:
   - baixa a removida do em uso
   - recupera ou baixa a removida
   - tira a nova do disponivel
   - coloca a nova em uso
   - atualiza composicao da maquina
   - atualiza historico

## 12.6 Condenar maquina

1. abrir manutencao
2. clicar em condenar
3. informar motivo
4. opcionalmente selecionar componentes para recuperar
5. salvar
6. o sistema:
   - fecha manutencao
   - marca maquina como condenada
   - movimenta materiais
   - o restante nao recuperado vira defeito

---

## 13. Arquivos tecnicos mais importantes para manutencao futura

### Entrada do sistema

- [`C:\Users\Universo Honda\Documents\controle-TI-main\controle-TI-main\src\index.js`](C:\Users\Universo Honda\Documents\controle-TI-main\controle-TI-main\src\index.js)

### Mapa de rotas

- [`C:\Users\Universo Honda\Documents\controle-TI-main\controle-TI-main\src\routes.js`](C:\Users\Universo Honda\Documents\controle-TI-main\controle-TI-main\src\routes.js)

### Auth

- [`C:\Users\Universo Honda\Documents\controle-TI-main\controle-TI-main\src\controllers\auth.js`](C:\Users\Universo Honda\Documents\controle-TI-main\controle-TI-main\src\controllers\auth.js)
- [`C:\Users\Universo Honda\Documents\controle-TI-main\controle-TI-main\src\middlewares\auth.js`](C:\Users\Universo Honda\Documents\controle-TI-main\controle-TI-main\src\middlewares\auth.js)

### Estruturado / CSV

- [`C:\Users\Universo Honda\Documents\controle-TI-main\controle-TI-main\src\services\computadorEstruturadoService.js`](C:\Users\Universo Honda\Documents\controle-TI-main\controle-TI-main\src\services\computadorEstruturadoService.js)
- [`C:\Users\Universo Honda\Documents\controle-TI-main\controle-TI-main\src\services\hwinfoCsvParser.js`](C:\Users\Universo Honda\Documents\controle-TI-main\controle-TI-main\src\services\hwinfoCsvParser.js)

### Regras de schema e seed

- [`C:\Users\Universo Honda\Documents\controle-TI-main\controle-TI-main\src\db\ensureSchema.js`](C:\Users\Universo Honda\Documents\controle-TI-main\controle-TI-main\src\db\ensureSchema.js)

### Views criticas

- [`C:\Users\Universo Honda\Documents\controle-TI-main\controle-TI-main\src\views\pages\home.ejs`](C:\Users\Universo Honda\Documents\controle-TI-main\controle-TI-main\src\views\pages\home.ejs)
- [`C:\Users\Universo Honda\Documents\controle-TI-main\controle-TI-main\src\views\pages\computador.ejs`](C:\Users\Universo Honda\Documents\controle-TI-main\controle-TI-main\src\views\pages\computador.ejs)
- [`C:\Users\Universo Honda\Documents\controle-TI-main\controle-TI-main\src\views\pages\computadores.ejs`](C:\Users\Universo Honda\Documents\controle-TI-main\controle-TI-main\src\views\pages\computadores.ejs)
- [`C:\Users\Universo Honda\Documents\controle-TI-main\controle-TI-main\src\views\pages\manutencao.ejs`](C:\Users\Universo Honda\Documents\controle-TI-main\controle-TI-main\src\views\pages\manutencao.ejs)
- [`C:\Users\Universo Honda\Documents\controle-TI-main\controle-TI-main\src\views\pages\manutencoes.ejs`](C:\Users\Universo Honda\Documents\controle-TI-main\controle-TI-main\src\views\pages\manutencoes.ejs)
- [`C:\Users\Universo Honda\Documents\controle-TI-main\controle-TI-main\src\views\pages\materiais.ejs`](C:\Users\Universo Honda\Documents\controle-TI-main\controle-TI-main\src\views\pages\materiais.ejs)
- [`C:\Users\Universo Honda\Documents\controle-TI-main\controle-TI-main\src\views\pages\perfil.ejs`](C:\Users\Universo Honda\Documents\controle-TI-main\controle-TI-main\src\views\pages\perfil.ejs)

---

## 14. Variaveis de ambiente relevantes

Arquivo:

- [`C:\Users\Universo Honda\Documents\controle-TI-main\controle-TI-main\.env`](C:\Users\Universo Honda\Documents\controle-TI-main\controle-TI-main\.env)

Variaveis importantes:

- `ADMIN_CLEAR_PASSWORD`
- `ADMIN_EMAIL`
- `ADMIN_NAME`
- `ADMIN_ROLE`
- `SESSION_SECRET`
- `NODE_ENV`
- `PORT` se quiser sobrescrever a porta padrao

---

## 15. Arquivos de banco

### Banco principal

- `src/db/db.sqlite`

### Banco de sessoes

- `src/db/sessions.sqlite`

Observacao:

- o SQLite principal guarda dados do sistema
- o SQLite de sessao guarda a autenticacao dos usuarios logados

---

## 16. Observacoes importantes para manutencao futura

1. O sistema possui historico antigo em `LEGADO` e logica nova em `ESTRUTURADO`.
2. Alteracoes em manutencao devem validar sempre o backend, nao apenas a view.
3. Em qualquer ajuste de troca de peca ou condenacao, conferir:
   - `ComputadorMaterial`
   - `Material`
   - `MaterialMovimento`
   - `ManutencaoItem`
4. O parser de CSV depende do padrao HWiNFO real.
5. Alteracoes em login devem respeitar a protecao global das rotas.
6. O dashboard trabalha com dados reais, sem mock.

---

## 17. Resumo final

Hoje o sistema ja entrega:

- autenticacao com sessao
- dashboard com dados reais
- cadastro e consulta de empresas
- cadastro de computadores
- modo estruturado com componentes reais
- importacao CSV HWiNFO
- manutencao com troca de peca estruturada
- condenacao com recuperacao
- controle de materiais com rastreabilidade
- transferencia de computadores
- gestao basica de usuarios pela tela de perfil

O ponto tecnico mais sensivel do projeto e o ecossistema:

- `Computador`
- `Manutencao`
- `Material`
- `ComputadorMaterial`
- `MaterialMovimento`

Esses arquivos formam o nucleo do sistema.
