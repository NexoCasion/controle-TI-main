const Sequelize = require('sequelize');

const database = require('../db/init.js');
const Computador = require('../models/Computador');
const Empresa = require('../models/Empresa');
const Manutencao = require('../models/Manutencao');
const Material = require('../models/Material');

class DashboardController {
  async getHomeData() {
    const { fn, col, Op, literal } = Sequelize;

    const [
      maquinasAtivas,
      maquinasTotal,
      manutencoesAbertas,
      totalEmpresas,
      rankingRows,
      maquinasPorEmpresaRows,
      materiaisDisponiveisPorTipo,
    ] = await Promise.all([
      Computador.count({ where: { ativo: true } }),
      Computador.count(),
      Manutencao.count({ where: { dataSaida: null } }),
      Empresa.count(),
      Manutencao.findAll({
        attributes: [[fn('COUNT', col('manutencoes.id')), 'total']],
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
      rankingEmpresas: (rankingRows || []).map((row) => ({
        nomeCompleto: row.computador?.empresa?.nome || 'Sem empresa',
        nome: row.computador?.empresa?.sigla || row.computador?.empresa?.nome || 'Sem empresa',
        total: Number(row.get('total') || 0),
      })),
      maquinasPorEmpresa: (maquinasPorEmpresaRows || []).map((row) => ({
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
