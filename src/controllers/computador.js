const Computador = require('../models/Computador');
const Empresa = require('../models/Empresa');
const { Op, literal } = require('sequelize');
const ComputadorEstruturadoService = require('../services/computadorEstruturadoService');

class ComputadorController {
  mapComputador(computador) {
    return {
      id: computador.dataValues.id,
      patrimonio: computador.dataValues.patrimonio,
      specs: computador.dataValues.specs,
      specs_override: computador.dataValues.specs_override,
      specs_modo: computador.dataValues.specs_modo,
      specs_estruturadas: computador.dataValues.specs_estruturadas,
      setor: computador.dataValues.setor,
      empresaId: computador.dataValues.empresaId,
      ativo: computador.dataValues.ativo,
      status: computador.dataValues.status,
      dataDescarte: computador.dataValues.dataDescarte,
      motivoDescarte: computador.dataValues.motivoDescarte,
      empresa: computador.empresa ? computador.empresa.dataValues : null,
    };
  }

  criarService() {
    return new ComputadorEstruturadoService();
  }

  buildStatusWhere(status = 'ativos') {
    const where = {};

    if (status === 'ativos') {
      where.ativo = true;
      where.status = null;
    }

    if (status === 'descartados') {
      where.ativo = false;
      where.status = { [Op.ne]: null };
    }

    return where;
  }

  buildOrder(sortBy, sortDir) {
    const direction = String(sortDir).toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    if (sortBy === 'specs') return [[literal('COALESCE(specs_override, specs)'), direction]];
    if (sortBy === 'setor') return [['setor', direction]];
    if (sortBy === 'empresa') return [[{ model: Empresa, as: 'empresa' }, 'nome', direction]];

    return [['patrimonio', direction]];
  }

  async create(name, description, empresaId, local) {
    try {
      if (!empresaId) {
        throw new Error('ID da empresa nao fornecido');
      }
      if (!name) {
        throw new Error('Numero de Patrimonio nao fornecido');
      }
      const computador = await Computador.create({
        patrimonio: name,
        specs: description,
        empresaId: empresaId,
        setor: local,
      });
      return computador;
    } catch (error) {
      throw new Error(`Erro ao registrar computador: ${error.message}`);
    }
  }

  async getAll({ status = 'ativos' } = {}) {
    try {
      const where = this.buildStatusWhere(status);

      const computadoresList = await Computador.findAll({
        where,
        include: { model: Empresa, as: 'empresa', attributes: ['nome'] },
      });

      return computadoresList.map((computador) => this.mapComputador(computador));
    } catch (error) {
      throw new Error('Erro ao buscar computadores: ' + error.message);
    }
  }

  async getByEmpresa(empresaId, { status = 'ativos' } = {}) {
    try {
      const where = {
        ...this.buildStatusWhere(status),
        empresaId,
      };

      const computadoresList = await Computador.findAll({
        where,
        include: { model: Empresa, as: 'empresa', attributes: ['nome'] },
      });

      return computadoresList.map((computador) => this.mapComputador(computador));
    } catch (error) {
      throw new Error('Erro ao buscar computadores por empresa: ' + error.message);
    }
  }

  async getPaged({
    empresaId = null,
    status = 'ativos',
    q = '',
    page = 1,
    limit = 20,
    sortBy = 'patrimonio',
    sortDir = 'ASC',
  } = {}) {
    try {
      const where = this.buildStatusWhere(status);
      const busca = String(q || '').trim();
      const pageNumber = Math.max(Number(page) || 1, 1);
      const limitNumber = Math.min(Math.max(Number(limit) || 20, 1), 200);
      const offset = (pageNumber - 1) * limitNumber;

      if (empresaId !== undefined && empresaId !== null && String(empresaId) !== '') {
        where.empresaId = Number(empresaId);
      }

      if (busca) {
        where[Op.or] = [
          { patrimonio: { [Op.like]: `%${busca}%` } },
          { specs: { [Op.like]: `%${busca}%` } },
          { specs_override: { [Op.like]: `%${busca}%` } },
          { setor: { [Op.like]: `%${busca}%` } },
          { '$empresa.nome$': { [Op.like]: `%${busca}%` } },
        ];
      }

      const { rows, count } = await Computador.findAndCountAll({
        where,
        include: [{ model: Empresa, as: 'empresa', attributes: ['nome'] }],
        order: this.buildOrder(sortBy, sortDir),
        limit: limitNumber,
        offset,
        distinct: true,
      });

      return {
        rows: rows.map((computador) => this.mapComputador(computador)),
        total: count,
        page: pageNumber,
        limit: limitNumber,
        totalPages: Math.max(Math.ceil(count / limitNumber), 1),
      };
    } catch (error) {
      throw new Error('Erro ao paginar computadores: ' + error.message);
    }
  }

  async getById(id) {
    try {
      const computador = await Computador.findByPk(id, { include: 'empresa' });

      if (!computador) {
        throw new Error('Computador nao encontrado');
      }
      return computador;
    } catch (error) {
      throw new Error(`Erro ao buscar computador: ${error.message}`);
    }
  }

  async descartar(id, manutencaoId, motivo = null) {
    try {
      const pc = await Computador.findByPk(id);
      if (!pc) throw new Error('Computador nao encontrado.');

      pc.ativo = false;
      pc.status = manutencaoId;
      pc.dataDescarte = new Date();
      pc.motivoDescarte = motivo;

      await pc.save();
      return pc;
    } catch (error) {
      throw new Error('Erro ao descartar computador: ' + error.message);
    }
  }

  async reativar(id) {
    try {
      const pc = await Computador.findByPk(id);
      if (!pc) throw new Error('Computador nao encontrado.');

      pc.ativo = true;
      pc.dataDescarte = null;
      pc.motivoDescarte = null;
      await pc.save();

      return pc;
    } catch (error) {
      throw new Error('Erro ao reativar computador: ' + error.message);
    }
  }

  async update(computador_new) {
    try {
      const computador = await Computador.findByPk(computador_new.id);
      if (!computador) {
        throw new Error('Computador nao encontrado');
      }

      computador.patrimonio = computador_new.patrimonio;
      computador.setor = computador_new.setor;

      if (String(computador.specs_modo || 'LEGADO').toUpperCase() === 'ESTRUTURADO') {
        const resultado = await this.criarService().syncSpecsEstruturadasDoComputador(computador.id);
        computador.specs = resultado.specsText || computador.specs;
        computador.specs_override = resultado.specsText || computador.specs_override;
      } else {
        const specsEditadas = String(computador_new.specs || '').trim();
        computador.specs = specsEditadas;
        computador.specs_override = specsEditadas;
      }

      await computador.save();
      return computador;
    } catch (error) {
      throw new Error(`Erro ao atualizar computador: ${error.message}`);
    }
  }

  async importarHwinfoCsv(computadorId, csvContent) {
    const service = this.criarService();
    return service.importarCsv(Number(computadorId), csvContent);
  }

  async criarEstruturadoManual(payload) {
    const service = this.criarService();
    return service.criarComputadorEstruturadoManual(payload);
  }

  async estruturarManualExistente(computadorId, payload) {
    const service = this.criarService();
    return service.estruturarComputadorExistenteManual(Number(computadorId), payload);
  }

  async criarEstruturadoPorCsv(payload) {
    const service = this.criarService();
    return service.criarComputadorEstruturadoPorCsv(payload);
  }

  async importarHwinfoCsvDeArquivo(computadorId, csvPath) {
    const service = this.criarService();
    return service.importarCsvDeArquivo(Number(computadorId), csvPath);
  }
}

module.exports = ComputadorController;
