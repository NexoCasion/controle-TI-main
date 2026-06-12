const BackupComputador = require('../models/BackupComputador');
const Computador = require('../models/Computador');
const Empresa = require('../models/Empresa');
const User = require('../models/User');
const { getBackupStatus } = require('../services/backupStatus');

class BackupComputadorController {
  normalizeApelido(apelidoUsuario) {
    const valor = String(apelidoUsuario || '').trim();

    if (!valor) {
      throw new Error('Informe o apelido do usuario da maquina.');
    }

    return valor;
  }

  normalizeOptionalDate(value) {
    const texto = String(value || '').trim();
    if (!texto) return null;

    const data = new Date(texto);
    if (Number.isNaN(data.getTime())) {
      throw new Error('Data do ultimo backup invalida.');
    }

    return data;
  }

  normalizeResponsavelConferenciaUserId(value) {
    const texto = String(value || '').trim();
    if (!texto) return null;

    const id = Number(texto);
    if (!Number.isInteger(id) || id <= 0) {
      throw new Error('Responsavel pela conferencia invalido.');
    }

    return id;
  }

  async ensureResponsavelAtivo(userId) {
    if (!userId) return null;

    const user = await User.findOne({
      where: {
        id: Number(userId),
        ativo: true,
      },
    });

    if (!user) {
      throw new Error('Responsavel pela conferencia nao encontrado.');
    }

    return user;
  }

  mapRegistro(registro) {
    const status = getBackupStatus({
      ativo: registro.ativo,
      ultimoBackupEm: registro.ultimoBackupEm,
    });

    return {
      id: registro.id,
      computadorId: registro.computadorId,
      apelidoUsuario: registro.apelidoUsuario,
      responsavelConferenciaUserId: registro.responsavelConferenciaUserId,
      ultimoBackupEm: registro.ultimoBackupEm,
      ativo: Boolean(registro.ativo),
      createdAt: registro.createdAt,
      updatedAt: registro.updatedAt,
      status,
      computador: registro.computador
        ? {
            id: registro.computador.id,
            patrimonio: registro.computador.patrimonio,
            setor: registro.computador.setor,
            empresaId: registro.computador.empresaId,
            ativo: registro.computador.ativo,
            status: registro.computador.status,
            empresa: registro.computador.empresa
              ? {
                  id: registro.computador.empresa.id,
                  nome: registro.computador.empresa.nome,
                  sigla: registro.computador.empresa.sigla,
                }
              : null,
          }
        : null,
      responsavelConferencia: registro.responsavelConferencia
        ? {
            id: registro.responsavelConferencia.id,
            nome: registro.responsavelConferencia.nome,
            role: registro.responsavelConferencia.role,
          }
        : null,
    };
  }

  sortRegistros(registros = []) {
    return [...registros].sort((a, b) => {
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

      const patrimonioA = String(a.computador?.patrimonio || '').trim();
      const patrimonioB = String(b.computador?.patrimonio || '').trim();
      return patrimonioA.localeCompare(patrimonioB, 'pt-BR', { numeric: true });
    });
  }

  async getAll({ includeInactive = false } = {}) {
    const registros = await BackupComputador.findAll({
      where: includeInactive ? {} : { ativo: true },
      include: [
        {
          model: Computador,
          as: 'computador',
          include: [{ model: Empresa, as: 'empresa', attributes: ['id', 'nome', 'sigla'] }],
        },
        {
          model: User,
          as: 'responsavelConferencia',
          attributes: ['id', 'nome', 'role', 'ativo'],
          required: false,
        },
      ],
      order: [[{ model: Computador, as: 'computador' }, 'patrimonio', 'ASC']],
    });

    return this.sortRegistros(registros.map((registro) => this.mapRegistro(registro)));
  }

  async getSummary() {
    const registros = await this.getAll();

    const summary = {
      emDia: 0,
      atrasado: 0,
      pendente: 0,
      atrasados: [],
    };

    registros.forEach((registro) => {
      if (registro.status.code === 'EM_DIA') summary.emDia += 1;
      if (registro.status.code === 'ATRASADO') {
        summary.atrasado += 1;
        summary.atrasados.push(registro);
      }
      if (registro.status.code === 'PENDENTE') summary.pendente += 1;
    });

    return summary;
  }

  async ensureComputadorAtivo(computadorId) {
    const computador = await Computador.findByPk(Number(computadorId), {
      include: [{ model: Empresa, as: 'empresa', attributes: ['id', 'nome', 'sigla'] }],
    });

    if (!computador) {
      throw new Error('Computador nao encontrado.');
    }

    if (!computador.ativo || computador.status !== null) {
      throw new Error('Somente computadores ativos podem entrar no controle de backup.');
    }

    return computador;
  }

  async create({ computadorId, apelidoUsuario, responsavelConferenciaUserId, ultimoBackupEm }) {
    const computador = await this.ensureComputadorAtivo(computadorId);
    const apelidoNormalizado = this.normalizeApelido(apelidoUsuario);
    const responsavelId = this.normalizeResponsavelConferenciaUserId(responsavelConferenciaUserId);
    const dataNormalizada = this.normalizeOptionalDate(ultimoBackupEm);

    await this.ensureResponsavelAtivo(responsavelId);

    const existente = await BackupComputador.findOne({
      where: { computadorId: Number(computadorId) },
    });

    if (existente) {
      if (existente.ativo) {
        throw new Error('Esta maquina ja esta cadastrada no controle de backup.');
      }

      existente.apelidoUsuario = apelidoNormalizado;
      existente.responsavelConferenciaUserId = responsavelId;
      existente.ultimoBackupEm = dataNormalizada;
      existente.ativo = true;
      await existente.save();
      return existente;
    }

    const registro = await BackupComputador.create({
      computadorId: computador.id,
      apelidoUsuario: apelidoNormalizado,
      responsavelConferenciaUserId: responsavelId,
      ultimoBackupEm: dataNormalizada,
      ativo: true,
    });

    return registro;
  }

  async update(id, { apelidoUsuario, responsavelConferenciaUserId, ultimoBackupEm }) {
    const registro = await BackupComputador.findByPk(Number(id));
    if (!registro) {
      throw new Error('Registro de backup nao encontrado.');
    }

    await this.ensureComputadorAtivo(registro.computadorId);

    const responsavelId = this.normalizeResponsavelConferenciaUserId(responsavelConferenciaUserId);
    await this.ensureResponsavelAtivo(responsavelId);

    registro.apelidoUsuario = this.normalizeApelido(apelidoUsuario);
    registro.responsavelConferenciaUserId = responsavelId;
    registro.ultimoBackupEm = this.normalizeOptionalDate(ultimoBackupEm);
    await registro.save();

    return registro;
  }

  async registrarAgora(id) {
    const registro = await BackupComputador.findByPk(Number(id));
    if (!registro) {
      throw new Error('Registro de backup nao encontrado.');
    }

    await this.ensureComputadorAtivo(registro.computadorId);

    registro.ultimoBackupEm = new Date();
    await registro.save();

    return registro;
  }

  async desativar(id) {
    const registro = await BackupComputador.findByPk(Number(id));
    if (!registro) {
      throw new Error('Registro de backup nao encontrado.');
    }

    registro.ativo = false;
    await registro.save();

    return registro;
  }
}

module.exports = BackupComputadorController;
