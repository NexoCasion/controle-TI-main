const Empresa = require("../models/Empresa")

const nome = "Taubate"
const descricao = "matriz"

async function c(nome, descricao) {
    return await Empresa.create({ nome, descricao });

}
const result = c(nome, descricao)
console.log(result);