const BACKUP_INTERVAL_DAYS = 30;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

const STATUS = {
  EM_DIA: 'EM_DIA',
  ATRASADO: 'ATRASADO',
  PENDENTE: 'PENDENTE',
  DESATIVADO: 'DESATIVADO',
};

const STATUS_META = {
  [STATUS.EM_DIA]: {
    code: STATUS.EM_DIA,
    label: 'Em dia',
    badgeClass: 'bg-success',
    priority: 3,
  },
  [STATUS.ATRASADO]: {
    code: STATUS.ATRASADO,
    label: 'Atrasado',
    badgeClass: 'bg-danger',
    priority: 1,
  },
  [STATUS.PENDENTE]: {
    code: STATUS.PENDENTE,
    label: 'Pendente',
    badgeClass: 'bg-warning text-dark',
    priority: 2,
  },
  [STATUS.DESATIVADO]: {
    code: STATUS.DESATIVADO,
    label: 'Desativado',
    badgeClass: 'bg-secondary',
    priority: 4,
  },
};

function normalizeDate(value) {
  if (!value) return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getDaysSince(dateValue) {
  const date = normalizeDate(dateValue);
  if (!date) return null;

  const diff = Date.now() - date.getTime();
  return Math.floor(diff / DAY_IN_MS);
}

function getBackupStatus(record = {}) {
  if (!record.ativo) {
    return {
      ...STATUS_META[STATUS.DESATIVADO],
      daysSince: getDaysSince(record.ultimoBackupEm),
      isLate: false,
    };
  }

  const daysSince = getDaysSince(record.ultimoBackupEm);

  if (daysSince === null) {
    return {
      ...STATUS_META[STATUS.PENDENTE],
      daysSince: null,
      isLate: false,
    };
  }

  if (daysSince > BACKUP_INTERVAL_DAYS) {
    return {
      ...STATUS_META[STATUS.ATRASADO],
      daysSince,
      isLate: true,
    };
  }

  return {
    ...STATUS_META[STATUS.EM_DIA],
    daysSince,
    isLate: false,
  };
}

module.exports = {
  BACKUP_INTERVAL_DAYS,
  STATUS,
  STATUS_META,
  getBackupStatus,
  getDaysSince,
};
