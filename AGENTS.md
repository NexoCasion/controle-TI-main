# AGENTS.md

## Contexto do projeto
Sistema de controle TI em:
- Node.js
- Express
- EJS
- Sequelize
- SQLite

Trabalhar sempre em cima do código real existente no repositório, sem inventar estrutura.

## Forma de trabalho
Ao responder ou executar tarefas neste projeto:

- ser objetivo
- localizar primeiro no código real antes de propor mudança
- informar sempre com clareza:
  - arquivo
  - onde localizar
  - o que trocar
  - o que colar
- evitar resposta genérica
- não repetir checklist desnecessário
- se houver dúvida real de regra de negócio, perguntar
- se faltar contexto atualizado, pedir o zip/repositório atual

## Regra principal
Antes de sugerir qualquer alteração:
1. localizar o arquivo real
2. ler o fluxo completo relacionado
3. identificar ids, rotas, controllers, partials e scripts realmente usados
4. só então orientar ou editar

Nunca assumir nome de campo, id de botão, rota ou variável sem conferir no código.

## Estado atual já tratado no projeto
Considere como já trabalhado e não reabrir sem evidência no código:

- fix da transferência pela página ver-pc
- fluxo de troca de peça com peça nova e removida
- recuperação/defeito da peça removida
- cadastro rápido de item removido
- snapshot/histórico da troca melhorado
- modal Condenar máquina existe
- modal Recuperação de Componentes existe
- fluxo Condenar -> Recuperação funciona
- linhas dinâmicas no modal de recuperação existem
- botão de registrar material na linha/card da recuperação já foi feito
- condenarComRecuperacao ajustado para máquinas antigas com em_uso = 0
- Materiais > Detalhes mostra:
  - em uso
  - disponível
  - baixado
  - recuperado
  - itens recuperados
  - itens baixados
- links “Abrir manutenção” em recuperados e baixados implementados
- duplicidade de card da condenação corrigida

## Ponto atual de trabalho
Prioridade atual:
- melhorias da tela ver-pc
- depois:
  - paginação das tabelas de computadores
  - specs com flag (legado string / novo estruturado por peça)
  - ao final, revisar repaginação CSS da home page conforme desenho futuro

## Regras para alterações
Quando alterar algo:

- preservar o padrão já existente do projeto
- preferir correção localizada
- evitar refactor amplo sem necessidade
- não quebrar fluxos já resolvidos
- não duplicar lógica entre view, partial e script
- quando possível, reforçar robustez no backend mesmo que o front já trate o caso
- se houver validação crítica, validar no backend também

## Convenções esperadas
Ao mexer em telas EJS:
- conferir o arquivo principal da página
- conferir partials incluídos
- conferir scripts inline da página
- conferir ids reais dos elementos no HTML antes de usar no JS

Ao mexer em fluxo de formulário:
- conferir:
  - view
  - rota
  - controller
  - model
  - campos enviados no form
- garantir que hidden inputs não sejam a única proteção para regra importante

Ao mexer em transferência:
- conferir origem e destino no backend
- não depender apenas do valor preenchido no front
- sempre validar computador, empresa de origem e empresa de destino conforme o fluxo real

Ao mexer em manutenção:
- verificar se já existe manutenção em aberto
- bloquear ações duplicadas quando aplicável
- usar o endpoint já existente se houver busca por computador

## Formato de resposta preferido
Sempre responder neste formato, quando estiver orientando alteração:

### Arquivo
`caminho/do/arquivo`

### Onde localizar
descrever função, bloco, trecho ou elemento real

### O que trocar
colar somente o trecho antigo exato quando necessário

### O que colar
entregar o trecho final pronto

Se não houver nada para trocar, dizer claramente:
- "no zip atual isso já está aplicado"

## Estratégia de investigação
Para qualquer bug:
1. reproduzir mentalmente o fluxo completo
2. localizar a entrada na view
3. localizar a rota acionada
4. localizar o controller
5. localizar dependências do model
6. só então corrigir

## Evitar
- respostas genéricas
- supor arquivo sem localizar
- sugerir “talvez esteja em X” sem checar
- checklist repetido em toda resposta
- refatoração cosmética fora do escopo
- criar solução nova se o projeto já tiver fluxo semelhante pronto

## Objetivo
Atuar como mantenedor técnico do projeto, trabalhando em cima do repositório real e entregando alterações pontuais, consistentes e prontas para colar.