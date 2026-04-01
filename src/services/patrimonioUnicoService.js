const database = require('../db/init');

function normalizarPatrimonio(patrimonio) {
  return String(patrimonio || '').trim();
}

async function buscarPatrimonioDuplicado(patrimonio, { excludeId = null, transaction = null } = {}) {
  const patrimonioNormalizado = normalizarPatrimonio(patrimonio);

  if (!patrimonioNormalizado) {
    return null;
  }

  const sql = `
    SELECT id, patrimonio
    FROM computadores
    WHERE TRIM(patrimonio) = ?
      ${excludeId ? 'AND id <> ?' : ''}
    LIMIT 1
  `;

  const replacements = excludeId
    ? [patrimonioNormalizado, Number(excludeId)]
    : [patrimonioNormalizado];

  const rows = await database.query(sql, {
    replacements,
    type: database.QueryTypes.SELECT,
    transaction,
  });

  return rows[0] || null;
}

async function validarPatrimonioUnico(patrimonio, { excludeId = null, transaction = null } = {}) {
  const patrimonioNormalizado = normalizarPatrimonio(patrimonio);

  if (!patrimonioNormalizado) {
    throw new Error('Numero de patrimonio nao fornecido');
  }

  const duplicado = await buscarPatrimonioDuplicado(patrimonioNormalizado, {
    excludeId,
    transaction,
  });

  if (duplicado) {
    throw new Error(`Ja existe um computador com o patrimonio ${patrimonioNormalizado}.`);
  }

  return patrimonioNormalizado;
}

module.exports = {
  normalizarPatrimonio,
  buscarPatrimonioDuplicado,
  validarPatrimonioUnico,
};
