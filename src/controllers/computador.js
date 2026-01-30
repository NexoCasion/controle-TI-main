const Computador = require("../models/Computador");
const Empresa = require("../models/Empresa");
const { Op } = require("sequelize");


class ComputadorController {
  async create(name, description, empresaId, local) {
    try {
      if (!empresaId) {
        throw new Error("ID da empresa não fornecido");
      }
      if (!name) {
        throw new Error("Numero de Patrimonio não fornecido");
      }
      const computador = await Computador.create({ 
        patrimonio: name,
        specs: description,
        empresaId: empresaId,
        setor: local 
      });
      return computador;
    } catch (error) {
      throw new Error(`Erro ao registrar computador: ${error.message}`);
    }
  }

  async getAll({ status = "ativos" } = {}) {
  try {
    const where = {};

    // Ativos: ativo=true e status NULL (não condenado)
    if (status === "ativos") {
      where.ativo = true;
      where.status = null;
    }

    // Descartados/Condenados: ativo=false e status preenchido (guarda id da manutenção)
    if (status === "descartados") {
      where.ativo = false;
      where.status = { [Op.ne]: null };
    }

    // Se quiser "todos"
    if (status === "todos") {
      // sem filtro
    }

    const computadoresList = await Computador.findAll({
      where,
      include: { model: Empresa, as: "empresa", attributes: ["nome"] }
    });

    return computadoresList.map((computador) => ({
      id: computador.dataValues.id,
      patrimonio: computador.dataValues.patrimonio,
      specs: computador.dataValues.specs,
      setor: computador.dataValues.setor,
      empresaId: computador.dataValues.empresaId,
      ativo: computador.dataValues.ativo,
      status: computador.dataValues.status, // <-- ID da manutenção que condenou (ou null)
      dataDescarte: computador.dataValues.dataDescarte,
      motivoDescarte: computador.dataValues.motivoDescarte,
      empresa: computador.empresa ? computador.empresa.dataValues : null,
    }));
  } catch (error) {
    throw new Error("Erro ao buscar computadores: " + error.message);
  }
}



async getByEmpresa(empresaId, { status = "ativos" } = {}) {
  try {
    const where = { empresaId };

    if (status === "ativos") {
      where.ativo = true;
      where.status = null;
    }

    if (status === "descartados") {
      where.ativo = false;
      where.status = { [Op.ne]: null };
    }

    if (status === "todos") {
      // sem filtro adicional
    }

    const computadoresList = await Computador.findAll({
      where,
      include: { model: Empresa, as: "empresa", attributes: ["nome"] },
    });

    return computadoresList.map((computador) => ({
      id: computador.dataValues.id,
      patrimonio: computador.dataValues.patrimonio,
      specs: computador.dataValues.specs,
      setor: computador.dataValues.setor,
      empresaId: computador.dataValues.empresaId,
      ativo: computador.dataValues.ativo,
      status: computador.dataValues.status,
      dataDescarte: computador.dataValues.dataDescarte,
      motivoDescarte: computador.dataValues.motivoDescarte,
      empresa: computador.empresa ? computador.empresa.dataValues : null,
    }));
  } catch (error) {
    throw new Error("Erro ao buscar computadores por empresa: " + error.message);
  }
}



  async getById(id) {
    try {
      const computador = await Computador.findByPk(id, { include: 'empresa' });

      if (!computador) {
        throw new Error('Computador não encontrado');
      }
      return computador
    }
    catch (error) {
      throw new Error(`Erro ao buscar computador: ${error.message}`);
    }
  }
  async descartar(id, manutencaoId, motivo = null) {
  try {
    const pc = await Computador.findByPk(id);
    if (!pc) throw new Error("Computador não encontrado.");

    // irreversível na regra do negócio (a gente pode até manter reativar no código,
    // mas não expor rota/botão)
    pc.ativo = false;
    pc.status = manutencaoId;           // <-- guarda o ID da manutenção que condenou
    pc.dataDescarte = new Date();
    pc.motivoDescarte = motivo;

    await pc.save();
    return pc;
  } catch (error) {
    throw new Error("Erro ao descartar computador: " + error.message);
  }
}


  async reativar(id) {
    try {
      const pc = await Computador.findByPk(id);
      if (!pc) throw new Error("Computador não encontrado.");

      pc.ativo = true;
      pc.dataDescarte = null;
      pc.motivoDescarte = null;
      await pc.save();

      return pc;
    } catch (error) {
      throw new Error("Erro ao reativar computador: " + error.message);
    }
  }

  async update(computador_new) {
    try {
      const computador = await Computador.findByPk(computador_new.id);
      if (!computador) {
        throw new Error('Computador não encontrado');
      }
      console.log(computador_new)
      computador.patrimonio = computador_new.patrimonio;
      computador.specs = computador_new.specs;
      computador.setor = computador_new.setor; 
      computador.save();
      return computador;
    } catch (error) {
      throw new Error(`Erro ao atualizar computador: ${error.message}`);
    }
  }


}


module.exports = ComputadorController;