const database = require('../db/init.js');

const Manutencao = require('../models/Manutencao');
const ManutencaoItem = require('../models/ManutencaoItem');
const Computador = require('../models/Computador');

const Material = require('../models/Material');
const ManutencaoMaterial = require('../models/ManutencaoMaterial');
const MaterialMovimento = require('../models/MaterialMovimento');
const Empresa = require('../models/Empresa');


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
        include: [
          {
            model: Computador,
            as: 'computador',
            include: [
              { model: Empresa, as: 'empresa', attributes: ['nome'] },
            ],
          },
        ],
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

  async addItemManutencao(payload) {
    const {
      manutencaoId,
      descricao,
      tipo = null,
      materialId = null,
      quantidade = 1,
      specs_depois = null,
    } = payload;

    if (!manutencaoId) throw new Error('manutencaoId é obrigatório.');
    if (!descricao || !descricao.trim()) throw new Error('descricao é obrigatória.');

    // 1) Buscar manutenção -> computadorId
    const manutencao = await Manutencao.findByPk(manutencaoId);
    if (!manutencao) throw new Error('Manutenção não encontrada.');

    const computadorId = manutencao.computadorId;
    if (!computadorId) throw new Error('Manutenção sem computador vinculado.');

    // 2) Buscar computador e specs atuais
    const computador = await Computador.findByPk(computadorId);
    if (!computador) throw new Error('Computador não encontrado.');

    const specs_antes = computador.specs_override || computador.specs || null;

    // 3) Se NÃO for troca de peça, salva procedimento simples
    if (tipo !== 'TROCA_PECA') {
      await ManutencaoItem.create({
        manutencaoId,
        descricao: descricao.trim(),
        tipo: tipo || null,
        specs_antes: null,
        specs_depois: null,
        material_snapshot: null,
      });

      return true;
    }

    // ========== TROCA DE PEÇA (transação completa) ==========
    if (!materialId) throw new Error('materialId é obrigatório para TROCA_PECA.');
    const qtd = Number(quantidade) || 1;
    if (qtd <= 0) throw new Error('Quantidade inválida.');

    return await database.transaction(async (t) => {
      // 4) Buscar material e validar estoque (dentro da transação)
      const material = await Material.findByPk(materialId, { transaction: t });
      if (!material) throw new Error('Material não encontrado.');

      if (material.quantidade_disponivel < qtd) {
        throw new Error(`Estoque insuficiente. Disponível: ${material.quantidade_disponivel}`);
      }

      // 5) Definir specs_depois
      const specsDepoisFinal = specs_depois ? String(specs_depois) : specs_antes;

      // 6) Snapshot congelado (histórico)
      const snapshot = [
        material.tipo,
        material.material,
        material.marca ? `Marca: ${material.marca}` : null,
        material.especificacao ? `Spec: ${material.especificacao}` : null,
        material.nf ? `NF: ${material.nf}` : null,
        `Qtd: ${qtd}`,
      ].filter(Boolean).join(' | ');

      // 7) Criar manutencaoItem
      const item = await ManutencaoItem.create({
        manutencaoId,
        descricao: descricao.trim(),
        tipo: 'TROCA_PECA',
        specs_antes,
        specs_depois: specsDepoisFinal,
        material_snapshot: snapshot,
      }, { transaction: t });

      // 8) Vínculo procedimento ↔ material
      await ManutencaoMaterial.create({
        manutencaoItem_id: item.id,
        material_id: material.id,
        quantidade: qtd,
      }, { transaction: t });

      // 9) Atualizar estoque
      material.quantidade_disponivel = material.quantidade_disponivel - qtd;
      material.quantidade_em_uso = material.quantidade_em_uso + qtd;
      await material.save({ transaction: t });

      // 10) Log de movimento
      await MaterialMovimento.create({
        material_id: material.id,
        tipo_movimento: 'SAIDA_MANUTENCAO',
        quantidade: qtd,
        referencia_manutencaoItem_id: item.id,
      }, { transaction: t });

      // 11) Atualizar specs_override do computador
      if (specsDepoisFinal && specsDepoisFinal !== specs_antes) {
        computador.specs_override = specsDepoisFinal;
        await computador.save({ transaction: t });
      }

      return true;
    });
  }

  async getItemManutencao(id) {
    try {
      const manutencaoItemList = await ManutencaoItem.findAll({
        where: { manutencaoId: id },
        include: 'manutencao',
        order: [['createdAt', 'DESC']], // ✅ mais novos primeiro
      });

      const manutencaoJSON = manutencaoItemList.map((item) => ({
        id: item.dataValues.id,
        descricao: item.dataValues.descricao,
        tipo: item.dataValues.tipo,
        material_snapshot: item.dataValues.material_snapshot,
        specs_antes: item.dataValues.specs_antes,
        specs_depois: item.dataValues.specs_depois,
        dataEntrada: item.dataValues.createdAt,
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
