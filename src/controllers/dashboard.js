const Sequelize = require('sequelize');

const database = require('../db/init.js');
const Computador = require('../models/Computador');
const Empresa = require('../models/Empresa');
const Manutencao = require('../models/Manutencao');
const Material = require('../models/Material');
const EmpresaController = require('./empresa');

class DashboardController {
  normalizeIgnoredDescriptionTerms(value) {
    let source = value;

    if (typeof source === 'string') {
      try {
        source = JSON.parse(source);
      } catch (error) {
        source = value;
      }
    }

    const parsed =
      source && typeof source === 'object' && !Array.isArray(source)
        ? source.rankingIgnoredDescriptions
        : source;

    const rawItems = Array.isArray(parsed)
      ? parsed
      : String(parsed || '')
          .split(/\r?\n|,|;/)
          .map((item) => item.trim());

    const unique = [];

    rawItems
      .map((item) => String(item || '').trim().toLowerCase())
      .filter(Boolean)
      .forEach((item) => {
        if (!unique.includes(item)) unique.push(item);
      });

    return unique.slice(0, 30);
  }

  async getHomeData(homeDashboardPreferences = null) {
    const { fn, col, Op, literal, where } = Sequelize;
    const rankingIgnoredDescriptions = this.normalizeIgnoredDescriptionTerms(
      homeDashboardPreferences
    );
    const rankingWhere = rankingIgnoredDescriptions.length
      ? {
          [Op.and]: rankingIgnoredDescriptions.map((term) =>
            where(
              fn('LOWER', fn('COALESCE', col('manutencoes.descricao'), '')),
              { [Op.notLike]: `%${term}%` }
            )
          ),
        }
      : undefined;

    const [
      maquinasAtivas,
      maquinasTotal,
      manutencoesAbertas,
      totalEmpresas,
      empresasRows,
      rankingRows,
      maquinasPorEmpresaRows,
      materiaisDisponiveisPorTipo,
    ] = await Promise.all([
      Computador.count({ where: { ativo: true } }),
      Computador.count(),
      Manutencao.count({ where: { dataSaida: null } }),
      Empresa.count(),
      Empresa.findAll({
        attributes: ['id', 'nome', 'sigla'],
        order: EmpresaController.getOrderClause(),
      }),
      Manutencao.findAll({
        attributes: [[fn('COUNT', col('manutencoes.id')), 'total']],
        where: rankingWhere,
        include: [
          {
            model: Computador,
            as: 'computador',
            attributes: ['empresaId'],
            required: true,
            include: [
              {
                model: Empresa,
                as: 'empresa',
                attributes: ['id', 'nome', 'sigla'],
                required: true,
              },
            ],
          },
        ],
        group: ['computador.empresaId', 'computador->empresa.id', 'computador->empresa.nome'],
        order: [[literal('total'), 'DESC']],
        raw: false,
      }),
      Computador.findAll({
        attributes: [
          'empresaId',
          [fn('COUNT', col('computadores.id')), 'total'],
        ],
        where: { ativo: true },
        include: [
          {
            model: Empresa,
            as: 'empresa',
            attributes: ['id', 'nome', 'sigla'],
            required: true,
          },
        ],
        group: ['empresaId', 'empresa.id', 'empresa.nome'],
        order: [[literal('total'), 'DESC']],
        raw: false,
      }),
      Material.findAll({
        attributes: ['tipo', [fn('SUM', col('quantidade_disponivel')), 'total']],
        where: {
          quantidade_disponivel: { [Op.gt]: 0 },
        },
        group: ['tipo'],
        order: [[literal('total'), 'DESC'], ['tipo', 'ASC']],
      }),
    ]);

    return {
      maquinasAtivas: Number(maquinasAtivas || 0),
      maquinasTotal: Number(maquinasTotal || 0),
      manutencoesAbertas: Number(manutencoesAbertas || 0),
      totalEmpresas: Number(totalEmpresas || 0),
      empresasFiltro: (empresasRows || []).map((empresa) => ({
        id: Number(empresa.id),
        nomeCompleto: empresa.nome || 'Sem empresa',
        nome: empresa.sigla || empresa.nome || 'Sem empresa',
        isDeptoTi:
          String(empresa.sigla || '').trim().toUpperCase() === 'DEPTO TI' ||
          String(empresa.nome || '').trim().toUpperCase().includes('DEPARTAMENTO DE TI'),
      })),
      rankingEmpresas: (rankingRows || []).map((row) => ({
        empresaId: Number(row.computador?.empresa?.id || row.computador?.empresaId || 0),
        nomeCompleto: row.computador?.empresa?.nome || 'Sem empresa',
        nome: row.computador?.empresa?.sigla || row.computador?.empresa?.nome || 'Sem empresa',
        total: Number(row.get('total') || 0),
      })),
      rankingIgnoredDescriptions,
      maquinasPorEmpresa: (maquinasPorEmpresaRows || []).map((row) => ({
        empresaId: Number(row.empresa?.id || row.empresaId || 0),
        nomeCompleto: row.empresa?.nome || 'Sem empresa',
        nome: row.empresa?.sigla || row.empresa?.nome || 'Sem empresa',
        total: Number(row.get('total') || 0),
      })),
      materiaisDisponiveisPorTipo: (materiaisDisponiveisPorTipo || []).map((row) => ({
        tipo: row.get('tipo'),
        total: Number(row.get('total') || 0),
      })),
    };
  }
}

module.exports = DashboardController;
