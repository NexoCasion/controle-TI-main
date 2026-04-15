const Empresa = require('../models/Empresa');

class EmpresaController {
  static getOrderClause() {
    return [
      ['ordem_exibicao', 'ASC'],
      ['nome', 'ASC'],
      ['id', 'ASC'],
    ];
  }

  async getNextDisplayOrder() {
    const ultimaEmpresa = await Empresa.findOne({
      order: [['ordem_exibicao', 'DESC'], ['id', 'DESC']],
    });

    return Number(ultimaEmpresa?.ordem_exibicao || 0) + 1;
  }

  async create(name, sigla, description) {
    try {
      if (!name) throw new Error('Favor informe um nome.');

      await Empresa.create({
        nome: String(name).trim(),
        sigla: String(sigla || '').trim() || null,
        ordem_exibicao: await this.getNextDisplayOrder(),
        descricao: String(description || '').trim() || null,
      });
    } catch (error) {
      throw new Error('Erro ao criar empresa: ' + error.message);
    }
  }

  async update(id, name, sigla, description) {
    try {
      if (!id) throw new Error('ID da empresa nao informado.');
      if (!name) throw new Error('Favor informe um nome.');

      const empresa = await Empresa.findByPk(Number(id));
      if (!empresa) throw new Error('Empresa nao encontrada.');

      empresa.nome = String(name).trim();
      empresa.sigla = String(sigla || '').trim() || null;
      empresa.descricao = String(description || '').trim() || null;

      await empresa.save();
      return empresa;
    } catch (error) {
      throw new Error('Erro ao atualizar empresa: ' + error.message);
    }
  }

  async moveDisplayOrder(id, direction) {
    try {
      const empresaId = Number(id);
      if (!empresaId) throw new Error('ID da empresa nao informado.');

      const normalizedDirection = String(direction || '').trim().toLowerCase();
      if (!['up', 'down'].includes(normalizedDirection)) {
        throw new Error('Direcao de ordenacao invalida.');
      }

      const empresas = await Empresa.findAll({
        order: EmpresaController.getOrderClause(),
      });

      const currentIndex = empresas.findIndex((empresa) => Number(empresa.id) === empresaId);
      if (currentIndex < 0) throw new Error('Empresa nao encontrada.');

      const targetIndex = normalizedDirection === 'up' ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= empresas.length) {
        return;
      }

      const [empresaMovida] = empresas.splice(currentIndex, 1);
      empresas.splice(targetIndex, 0, empresaMovida);

      for (let index = 0; index < empresas.length; index += 1) {
        const empresa = empresas[index];
        const novaOrdem = index + 1;

        if (Number(empresa.ordem_exibicao || 0) !== novaOrdem) {
          empresa.ordem_exibicao = novaOrdem;
          await empresa.save();
        }
      }
    } catch (error) {
      throw new Error('Erro ao reordenar empresa: ' + error.message);
    }
  }

  async saveDisplayOrder(ids) {
    try {
      const orderedIds = Array.isArray(ids)
        ? ids.map((id) => Number(id)).filter((id) => Number.isFinite(id))
        : [];

      if (!orderedIds.length) {
        throw new Error('Lista de empresas para ordenacao nao informada.');
      }

      const empresas = await Empresa.findAll({
        order: EmpresaController.getOrderClause(),
      });

      if (empresas.length !== orderedIds.length) {
        throw new Error('A lista enviada nao corresponde ao total de empresas cadastradas.');
      }

      const empresasById = new Map(
        empresas.map((empresa) => [Number(empresa.id), empresa])
      );

      for (const id of orderedIds) {
        if (!empresasById.has(id)) {
          throw new Error('Lista de empresas invalida para ordenacao.');
        }
      }

      for (let index = 0; index < orderedIds.length; index += 1) {
        const empresa = empresasById.get(orderedIds[index]);
        const novaOrdem = index + 1;

        if (Number(empresa.ordem_exibicao || 0) !== novaOrdem) {
          empresa.ordem_exibicao = novaOrdem;
          await empresa.save();
        }
      }
    } catch (error) {
      throw new Error('Erro ao salvar ordenacao das empresas: ' + error.message);
    }
  }

  async getAll() {
    try {
      const empresasList = await Empresa.findAll({
        order: EmpresaController.getOrderClause(),
      });

      const empresasJSON = empresasList.map((empresa) => ({
        id: empresa.dataValues.id,
        nome: empresa.dataValues.nome,
        sigla: empresa.dataValues.sigla,
        ordem_exibicao: Number(empresa.dataValues.ordem_exibicao || 0),
        descricao: empresa.dataValues.descricao,
      }));
      return empresasJSON;
    } catch (error) {
      throw new Error('Erro ao buscar empresas: ' + error.message);
    }
  }
}

module.exports = EmpresaController;
