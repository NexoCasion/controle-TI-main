const Transferencia = require('../models/Transferencia');
const Computador = require('../models/Computador');
const Empresa = require('../models/Empresa');

class TransferenciaController {
  async create(computador, emp_origem, emp_destino, observacao) {
    try {
      const computadorId = Number(computador);
      const empresaOrigemInformada =
        emp_origem === undefined || emp_origem === null || String(emp_origem).trim() === ''
          ? null
          : Number(emp_origem);
      const empresaDestinoId =
        emp_destino === undefined || emp_destino === null || String(emp_destino).trim() === ''
          ? null
          : Number(emp_destino);
      const observacaoFinal = observacao ? String(observacao).trim() : null;

      if (!Number.isInteger(computadorId) || computadorId <= 0) {
        throw new Error('Favor informar o computador.');
      }

      if (!Number.isInteger(empresaDestinoId) || empresaDestinoId < 0) {
        throw new Error('Favor informar a empresa de destino.');
      }

      const pc = await Computador.findByPk(computadorId);

      if (!pc) {
        throw new Error('Computador nÃ£o encontrado.');
      }

      const empresaOrigemAtual = Number(pc.empresaId);

      if (!Number.isInteger(empresaOrigemAtual) || empresaOrigemAtual < 0) {
        throw new Error('Favor informar a empresa de origem.');
      }

      if (empresaDestinoId === empresaOrigemAtual) {
        throw new Error('A empresa de destino deve ser diferente da empresa atual do computador.');
      }

      if (
        empresaOrigemInformada !== null &&
        Number.isInteger(empresaOrigemInformada) &&
        empresaOrigemInformada >= 0 &&
        empresaOrigemInformada !== empresaOrigemAtual
      ) {
        console.warn(
          `Transferencia com emp_origem divergente para computador ${computadorId}. ` +
            `Recebido: ${empresaOrigemInformada}. Atual no banco: ${empresaOrigemAtual}.`
        );
      }

      const transferencia = await Computador.sequelize.transaction(async (transaction) => {
        const transferenciaCriada = await Transferencia.create(
          {
            computador: computadorId,
            emp_destino: empresaDestinoId,
            emp_origem: empresaOrigemAtual,
            observacao: observacaoFinal,
          },
          { transaction }
        );

        await pc.update({ empresaId: empresaDestinoId }, { transaction });

        return transferenciaCriada;
      });

      return transferencia;
    } catch (e) {
      throw new Error('Erro ao criar transferencia: ' + e.message);
    }
  }

  async findByComputador(computadorId) {
    try {
      const transferencias = await Transferencia.findAll({
        where: { computador: computadorId },
        include: [
          { model: Empresa, as: 'origem', attributes: ['id', 'nome'] },
          { model: Empresa, as: 'destino', attributes: ['id', 'nome'] },
        ],
      });

      return transferencias.map((transferencia) => ({
        id: transferencia.id,
        tipo: 'TRANSFERENCIA',
        dataReferencia: transferencia.data,
        dataFim: null,
        descricao:
          transferencia.observacao && String(transferencia.observacao).trim()
            ? transferencia.observacao
            : 'Transferência de unidade',
        origem: transferencia.origem ? transferencia.origem.nome : '-',
        destino: transferencia.destino ? transferencia.destino.nome : '-',
        observacao: transferencia.observacao || '',
      }));
    } catch (error) {
      throw new Error('Erro ao buscar transferencias: ' + error.message);
    }
  }
}

module.exports = TransferenciaController;
