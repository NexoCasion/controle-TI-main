# TODO LIST - APP CONTROLE DE TI

## CURRENT TASKS

- [x] add itens de manutencao na tela de infos da manut.
- [x] listagem de manutencoes - ao filtrar por empresa estava creasheando o sistema. -> foi removida essa funcionalidade devido a nao fazer sentido com o modelo de db que temos no sistema
- [x] add mostrar manutencao encerrada na tela de manutencao e status na tela de listagem de manutencoes

- [x] tela home listagem de manutencoes abertas (na vddd estava listando todas {n + 3 task})
    - add regra de negocio para manutencoes sem data da finalizacao (botao novo modal)
    - rever rota de encerrar manut
    - add data saida // status nessa tabela (verificar a possibilidade de criar um public/script para loadar essas infos)

- [x] criar tela e rota editar-pc (vincular ao botao na pagina de pcs)
    - nessa tela editar-pc, deve-se ser possivel trocar a descricao e transferir o pc para outra empresa
    - analisar como armazenar e cadastrar as transferencias (fazer isso preferencialmente apos arredondadar o sistema)

- [x] botao add manutencao na pagina computador
- [x] listar transferencias no formulario de ver-pc junto as manutencoes em ordem cronologica
- [] paginacao das tabelas de computadores
- [] specs com flag (legado string / novo estruturado por peca)
- [] revisar repaginacao CSS da home page conforme desenho futuro
- [] implementacao de maquina a partir de arquivo CSV que o usuario vai enviar
    - quando essa etapa chegar, perguntar os detalhes antes de executar
    - solicitar o arquivo CSV e a regra exata do que deve ser implementado
- [] comecar a pensar sobre as listagens -> tornar o sistema dinamico

# ajustes tecnicos (gambiarras) - improvement to future
- rota de encerrar manutencao esta GET, o ideal seria PUT (creio eu)
