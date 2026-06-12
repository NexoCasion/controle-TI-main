const Sequelize = require('sequelize');

const database = require('../db/init.js');
const Computador = require('../models/Computador');
const Empresa = require('../models/Empresa');
const Manutencao = require('../models/Manutencao');
const Material = require('../models/Material');
const BackupComputador = require('../models/BackupComputador');
const User = require('../models/User');
const EmpresaController = require('./empresa');
const { getBackupStatus } = require('../services/backupStatus');

class DashboardController {
  async getHomeData() {
    const { fn, col, Op, literal } = Sequelize;

    const [
      maquinasAtivas,
      maquinasTotal,
      manutencoesAbertas,
      totalEmpresas,
      empresasRows,
      rankingRows,
      maquinasPorEmpresaRows,
      materiaisDisponiveisPorTipo,
      backupsRows,
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
      BackupComputador.findAll({
        where: { ativo: true },
        include: [
          {
            model: Computador,
            as: 'computador',
            attributes: ['id', 'patrimonio', 'setor', 'empresaId'],
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
          {
            model: User,
            as: 'responsavelConferencia',
            attributes: ['id', 'nome', 'role'],
            required: false,
          },
        ],
        order: [[{ model: Computador, as: 'computador' }, 'patrimonio', 'ASC']],
      }),
    ]);

    const backupsAtivos = (backupsRows || []).map((row) => {
      const status = getBackupStatus({
        ativo: row.ativo,
        ultimoBackupEm: row.ultimoBackupEm,
      });

      return {
        id: Number(row.id),
        apelidoUsuario: row.apelidoUsuario,
        ultimoBackupEm: row.ultimoBackupEm,
        status,
        computador: {
          id: Number(row.computador?.id || 0),
          patrimonio: row.computador?.patrimonio || '',
          setor: row.computador?.setor || '',
          empresa: row.computador?.empresa
            ? {
                id: Number(row.computador.empresa.id),
                nome: row.computador.empresa.nome || 'Sem empresa',
                sigla: row.computador.empresa.sigla || row.computador.empresa.nome || 'Sem empresa',
              }
            : null,
        },
        responsavelConferencia: row.responsavelConferencia
          ? {
              id: Number(row.responsavelConferencia.id),
              nome: row.responsavelConferencia.nome,
            }
          : null,
      };
    });

    const backupSummary = {
      emDia: 0,
      atrasado: 0,
      pendente: 0,
      atrasados: [],
      registros: [],
    };

    backupsAtivos.forEach((item) => {
      if (item.status.code === 'EM_DIA') backupSummary.emDia += 1;
      if (item.status.code === 'ATRASADO') {
        backupSummary.atrasado += 1;
        backupSummary.atrasados.push(item);
      }
      if (item.status.code === 'PENDENTE') backupSummary.pendente += 1;
    });

    backupSummary.registros = [...backupsAtivos].sort((a, b) => {
      const prioridadeA = Number(a.status?.priority || 99);
      const prioridadeB = Number(b.status?.priority || 99);

      if (prioridadeA !== prioridadeB) {
        return prioridadeA - prioridadeB;
      }

      const dataA = a.ultimoBackupEm ? new Date(a.ultimoBackupEm).getTime() : 0;
      const dataB = b.ultimoBackupEm ? new Date(b.ultimoBackupEm).getTime() : 0;

      if (dataA !== dataB) {
        return dataA - dataB;
      }

      return String(a.apelidoUsuario || '').localeCompare(String(b.apelidoUsuario || ''), 'pt-BR');
    });

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
      backupSummary,
    };
  }
}

module.exports = DashboardController;
