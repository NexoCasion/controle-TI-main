const Manutencao = require('../models/Manutencao');
const Computador = require('../models/Computador');
const Empresa = require('../models/Empresa');
const ManutencaoItem = require('../models/ManutencaoItem');

class ManutencaoController {
  async create(descricao, computadorId) {
    if (!computadorId) {
      throw new Error('Não foi informado um computador para registrar a manutenção!');
    }

    const manutencao = await Manutencao.create({
      descricao,
      computadorId,
    });
    const pc = await Computador.findByPk(computadorId);
    if (!pc) throw new Error('Computador não encontrado.');

    if (pc.status !== null && pc.status !== undefined) {
      throw new Error('Este computador está CONDENADO e não pode abrir novas manutenções.');
    }

    return manutencao;
  }

  async findOpened() {
    try {
      const manutencoesList = await Manutencao.findAll({
        where: { dataSaida: null },
      });

      const manutencoesJSON = manutencoesList.map((manutencao) => ({
        id: manutencao.dataValues.id,
        descricao: manutencao.dataValues.descricao,
        computadorId: manutencao.dataValues.computadorId,
        dataEntrada: manutencao.dataValues.dataEntrada,
        dataSaida: manutencao.dataValues.dataSaida,
      }));

      console.log(manutencoesJSON);
      return manutencoesJSON;
    } catch (err) {
      throw new Error(`Erro ao buscar manutenções abertas: ${err.message}`);
    }
  }

  async findAll() {
    try {
      const manutencoesList = await Manutencao.findAll({
        include: [
          {
            model: Computador,
            as: 'computador',
            include: [
              { model: Empresa, as: 'empresa', attributes: ['nome'] }, // Adicione o alias aqui
            ],
          },
        ],
      });
      const manutencoesJSON = manutencoesList.map((manutencao) => ({
        id: manutencao.dataValues.id,
        descricao: manutencao.dataValues.descricao,
        computadorId: manutencao.dataValues.computadorId,
        dataEntrada: manutencao.dataValues.dataEntrada,
        dataSaida: manutencao.dataValues.dataSaida,
        empresa: manutencao.computador.empresa.nome,
        pcName: manutencao.computador.patrimonio,

        // ✅ NOVO (para a tela saber se o PC foi condenado)
        pcStatus: manutencao.computador.status, // aqui fica o ID da manutenção que condenou
        pcCondenado: manutencao.computador.status !== null,
      }));
      return manutencoesJSON;
    } catch (error) {
      throw new Error(`Erro ao listar manutenções: ${error.message}`);
    }
  }

  async findById(id) {
    try {
      const manutencao = await Manutencao.findByPk(id, {
        include: 'computador',
      });

      return manutencao;
    } catch (error) {
      throw new Error('Erro ao buscar manutenções por ID: ' + error.message);
    }
  }

  async findByEmpresa(empresaId) {
    try {
      // const manutencoesList = await Manutencao.findAll({
      //   where: { empresaId: empresaId },
      //   include: "empresa",
      // });
      return;
    } catch (error) {
      throw new Error('Erro ao buscar manutenções by empresa: ' + error.message);
    }
  }

  async findByComputador(id) {
    try {
      const manutencaoList = await Manutencao.findAll({
        where: { computadorId: id },
        include: 'computador',
      });

      const manutencaoJSON = manutencaoList.map((manutencao) => ({
        id: manutencao.dataValues.id,
        descricao: manutencao.dataValues.descricao,
        dataEntrada: manutencao.dataValues.dataEntrada,
        dataSaida: manutencao.dataValues.dataSaida,
        computadorId: manutencao.dataValues.computadorId,
        pcName: manutencao.computador.patrimonio,
        setor: manutencao.computador.setor, // ✅
      }));
      console.log(manutencaoJSON);
      return manutencaoJSON;
    } catch (error) {
      throw new Error('Erro ao buscar computadores: ' + error.message);
    }
  }

  async addItemManutencao(manutencaoId, descricao) {
    try {
      descricao.toString();
      descricao.replace(/[^\w\s]|_\s*$/gi, '');
      const nwDescr = descricao
        .replace(/\\/g, '')
        .replace(/\n/g, ' \\n')
        .replace(/\r/g, '')
        .replace(/\t/g, '')
        .replace(/\f/g, '')
        .replace(/\b/g, '')
        .replace(
          `
      `,
          ''
        )
        .replace('\r\n', '');

      const sanitizedDescricao = JSON.stringify(nwDescr);
      const manutencaoItem = await ManutencaoItem.create({
        descricao: nwDescr,
        manutencaoId: manutencaoId,
      });
    } catch (err) {
      throw new Error('Erro ao adicionar um item dentro de uma manutenção' + err);
    }
  }

  async getItemManutencao(id) {
    try {
      const manutencaoItemList = await ManutencaoItem.findAll({
        where: { manutencaoId: id },
        include: 'manutencao',
      });

      const manutencaoJSON = manutencaoItemList.map((manutencao) => ({
        id: manutencao.dataValues.id,
        descricao: manutencao.dataValues.descricao,
        dataEntrada: manutencao.dataValues.createdAt,
      }));

      return manutencaoJSON;
    } catch (err) {
      throw new Error('Erro ao procurar os itens dentro de uma manutenção' + err);
    }
  }

  async encerrarManutencao(id) {
    try {
      const manutencao = await Manutencao.findByPk(id);
      manutencao.dataSaida = new Date();
      manutencao.save();

      return;
    } catch (err) {
      throw new Error('Erro ao encerrar uma manutenção' + err);
    }
  }
  async condenarMaquina(manutencaoId, motivo) {
    try {
      if (!manutencaoId) throw new Error('manutencaoId não informado.');
      if (!motivo || !motivo.trim()) throw new Error('Motivo é obrigatório.');

      const manutencao = await Manutencao.findByPk(manutencaoId);
      if (!manutencao) throw new Error('Manutenção não encontrada.');

      const pc = await Computador.findByPk(manutencao.computadorId);
      if (!pc) throw new Error('Computador não encontrado.');

      // ✅ irreversível: se já tem status, já foi condenado
      if (pc.status !== null) throw new Error('Este computador já está CONDENADO.');

      // 1) marca pc como condenado
      pc.status = manutencaoId; // ✅ guarda o ID da manutenção que condenou
      pc.ativo = false; // ✅ some da lista de ativos e da contagem
      pc.dataDescarte = new Date();
      pc.motivoDescarte = motivo.trim();
      await pc.save();

      // 2) fecha manutenção
      manutencao.dataSaida = new Date();
      await manutencao.save();

      // 3) (opcional, mas recomendo) salva o motivo também no histórico de procedimentos
      await ManutencaoItem.create({
        manutencaoId: manutencaoId,
        descricao: `⚠️ MÁQUINA CONDENADA — Motivo: ${motivo.trim()}`,
      });

      return;
    } catch (err) {
      throw new Error('Erro ao condenar máquina: ' + err.message);
    }
  }
}

module.exports = ManutencaoController;
