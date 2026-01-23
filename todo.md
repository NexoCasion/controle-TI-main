# TODO LIST - APP CONTROLE DE TI

## CURRENT TASKS

- [x] add itens de manutenção na tela de infos da manut.
- [x] listagem de manutencoes - ao filtrar por empresa está creasheando o sistema. -> foi removida essa funcionalidade devido a nao fazer sentido com o modelo de db que temos no sistema
- [x] add mostrar manutencao encerrada na tela de manutencao e status na tela de listagem de manutencoes 

- [x] tela home listagem de manutencoes abertas (na vddd esta listando todas {n + 3 task})
    -  add regra de neogcio para manutencoes sem data da finalizacao (botao novo modal)
    - rever rota de encerrar manut
    - add data saida // status nessa tabela (verificar a possibilidade de criar um public/script para loadar essas infos) 

- [] criar tela e rota editar-pc (vincular ao botao na pagina de pcs) **doing now** 
    - nessa tela editar-pc, deve-se ser possivel trocar a descrição e transferir o pc para outra empresa
    - analisar como armazenar e cadastrar as transferencias (fazer isso preferencialmente apos arredondadar o sistema)

- [] começar a pensar sobre as listagens -> tornar o sistema dinâmico
- []   botao add manutencao na pagina computador 

# ajustes tecnicos (gambiarras) - improvement to future
- rota de encerrar manutencao está GET, o ideal seria PUT (creio eu)

### LISTAR TRANSFERENCIAS NO FORMULARIO DE VER-PC JUNTO AS MANUTENCOES EM ORDEM CRONOLOGICA
. modificar a rota que serve o array atual para montar um array com a duas Entidades. 
. observar a ordem cronologica para disposicao e as rotas diferentes em botoes de ver mais
