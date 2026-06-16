const crypto = require('crypto');
const Sequelize = require('sequelize');
const BackupComputador = require('../models/BackupComputador');

class BackupStatusIntegrationService {
  getConfiguredToken() {
    return String(process.env.BACKUP_API_TOKEN || '').trim();
  }

  isAuthorized(authorizationHeader) {
    const expectedToken = this.getConfiguredToken();
    if (!expectedToken) {
      return { ok: false, reason: 'CONFIG_MISSING' };
    }

    const header = String(authorizationHeader || '').trim();
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      return { ok: false, reason: 'TOKEN_INVALID' };
    }

    const receivedToken = String(match[1] || '').trim();
    if (!receivedToken) {
      return { ok: false, reason: 'TOKEN_INVALID' };
    }

    const expectedBuffer = Buffer.from(expectedToken, 'utf8');
    const receivedBuffer = Buffer.from(receivedToken, 'utf8');

    if (expectedBuffer.length !== receivedBuffer.length) {
      return { ok: false, reason: 'TOKEN_INVALID' };
    }

    const ok = crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
    return { ok, reason: ok ? null : 'TOKEN_INVALID' };
  }

  normalizeOptionalString(value, maxLength = null) {
    const texto = String(value || '').trim();
    if (!texto) return null;
    return maxLength ? texto.slice(0, maxLength) : texto;
  }

  normalizeInteger(value, fieldName) {
    if (value === undefined || value === null || String(value).trim() === '') {
      return null;
    }

    const number = Number(value);
    if (!Number.isInteger(number)) {
      throw new Error(`${fieldName} invalido.`);
    }

    return number;
  }

  normalizeStatus(value) {
    const status = String(value || '').trim().toUpperCase();
    if (!status) {
      throw new Error('status nao informado.');
    }

    if (!['SUCESSO', 'FALHA'].includes(status)) {
      throw new Error('status invalido. Use SUCESSO ou FALHA.');
    }

    return status;
  }

  parseDateTime(value) {
    const texto = String(value || '').trim();
    if (!texto) {
      throw new Error('dataHoraFim nao informada.');
    }

    const match = texto.match(
      /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/
    );

    if (!match) {
      throw new Error('dataHoraFim invalida. Use o formato YYYY-MM-DD HH:mm:ss.');
    }

    const [, year, month, day, hour, minute, second = '00'] = match;
    const date = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second)
    );

    if (Number.isNaN(date.getTime())) {
      throw new Error('dataHoraFim invalida.');
    }

    return date;
  }

  async findByPastaBackup(pastaBackup) {
    const normalized = this.normalizeOptionalString(pastaBackup, 255);
    if (!normalized) {
      throw new Error('pastaBackup nao informada.');
    }

    const registro = await BackupComputador.findOne({
      where: Sequelize.where(
        Sequelize.fn('UPPER', Sequelize.fn('TRIM', Sequelize.col('pasta_backup'))),
        normalized.toUpperCase()
      ),
    });

    return {
      registro,
      normalized,
    };
  }

  async receiveStatus(payload = {}) {
    const { registro, normalized } = await this.findByPastaBackup(payload.pastaBackup);

    if (!registro) {
      const error = new Error(`Controle de backup nao encontrado para a pasta "${normalized}".`);
      error.code = 'BACKUP_NOT_FOUND';
      throw error;
    }

    const status = this.normalizeStatus(payload.status);
    const dataHoraFim = this.parseDateTime(payload.dataHoraFim);

    registro.ultimoStatus = status;
    registro.ultimoLogPath = this.normalizeOptionalString(payload.logPath, 500);
    registro.ultimoResultadoDesktop = this.normalizeInteger(
      payload.resultadoDesktop,
      'resultadoDesktop'
    );
    registro.ultimoResultadoDocumentos = this.normalizeInteger(
      payload.resultadoDocumentos,
      'resultadoDocumentos'
    );
    registro.ultimoResultadoFavoritos = this.normalizeInteger(
      payload.resultadoFavoritos,
      'resultadoFavoritos'
    );
    registro.ultimaSincronizacaoEm = new Date();

    if (status === 'SUCESSO') {
      registro.ultimoBackupEm = dataHoraFim;
    }

    await registro.save();

    return {
      id: registro.id,
      computadorId: registro.computadorId,
      pastaBackup: registro.pastaBackup,
      ultimoStatus: registro.ultimoStatus,
      ultimoBackupEm: registro.ultimoBackupEm,
      ultimaSincronizacaoEm: registro.ultimaSincronizacaoEm,
    };
  }
}

module.exports = BackupStatusIntegrationService;
