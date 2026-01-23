const Transferencia = require("../models/Transferencia");
const Computador = require("../models/Computador");

class TransferenciaController {

    async create(computador, emp_origem, emp_destino, observacao) {
        try {

            // console.log("-----------------")
            // console.log(computador);
            // console.log("-----------------")
            // console.log(emp_origem);
            // console.log("-----------------")
            // console.log(emp_destino);
            // console.log("-----------------")

            if (!emp_origem) throw new Error("Favor informar a empresa de origem.")
            if (!emp_destino) throw new Error("Favor informar a empresa de destino.")
            if (!computador) throw new Error("Favor informar o computador.")

            const transferencia = await Transferencia.create({
                computador: computador,
                emp_destino: emp_destino,
                emp_origem: emp_origem,
                observacao: observacao
            })

            // Atualizar o ID da empresa na tabela Computador
            await Computador.update(
                { empresaId: emp_destino },
                { where: { id: computador } }
            );


            return transferencia;
        } catch (e) {
            throw new Error('Erro ao criar transferencia: ' + e.message)
        }
    }
}

module.exports = TransferenciaController;