const Empresa = require('../models/Empresa');

class EmpresaController {
  async create(name, sigla, description) {
    try {
      if (!name) throw new Error('Favor informe um nome.');

      await Empresa.create({
        nome: String(name).trim(),
        sigla: String(sigla || '').trim() || null,
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

  async getAll() {
    try {
      const empresasList = await Empresa.findAll();

      const empresasJSON = empresasList.map((empresa) => ({
        id: empresa.dataValues.id,
        nome: empresa.dataValues.nome,
        sigla: empresa.dataValues.sigla,
        descricao: empresa.dataValues.descricao,
      }));
      return empresasJSON;
    } catch (error) {
      throw new Error('Erro ao buscar empresas: ' + error.message);
    }
  }
}

module.exports = EmpresaController;
