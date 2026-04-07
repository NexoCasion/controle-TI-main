const bcrypt = require('bcrypt');
const database = require('./init');

async function getTableColumns(tableName) {
  const rows = await database.query(`PRAGMA table_info(${tableName});`, {
    type: database.QueryTypes.SELECT,
  });
  return rows.map((row) => row.name);
}

async function ensureComputadoresColumns() {
  const columns = await getTableColumns('computadores');

  if (!columns.includes('specs_modo')) {
    await database.query(
      "ALTER TABLE computadores ADD COLUMN specs_modo VARCHAR(20) NOT NULL DEFAULT 'LEGADO';"
    );
  }

  if (!columns.includes('specs_estruturadas')) {
    await database.query("ALTER TABLE computadores ADD COLUMN specs_estruturadas TEXT;");
  }
}

async function ensurePatrimonioUniqueIndex() {
  const duplicados = await database.query(
    `
      SELECT TRIM(patrimonio) AS patrimonio, COUNT(*) AS total
      FROM computadores
      GROUP BY TRIM(patrimonio)
      HAVING TRIM(patrimonio) <> '' AND COUNT(*) > 1;
    `,
    { type: database.QueryTypes.SELECT }
  );

  if (duplicados.length) {
    console.warn(
      '[ensureSchema] indice unico de patrimonio nao criado porque existem patrimonios duplicados no banco.'
    );
    return;
  }

  await database.query(
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_computadores_patrimonio_unique ON computadores(TRIM(patrimonio));'
  );
}

async function ensureEmpresaColumns() {
  const columns = await getTableColumns('empresas');

  if (!columns.includes('sigla')) {
    await database.query('ALTER TABLE empresas ADD COLUMN sigla VARCHAR(50);');
  }
}

async function seedEmpresaSiglas() {
  const siglas = {
    'Departamento de TI - Manutenção e Estoque': 'DEPTO TI',
    'Taubaté - Matriz': 'TAU',
    'São José dos Campos': 'SJC',
    'SJC - Dream': 'DREAM',
    'Caçapava': 'CPV',
    'São Mateus': 'SMT',
    'Vila Prudente': 'VPR',
    'Diadema': 'DIA',
    'Ubatuba': 'UBA',
    'São Sebastião': 'SSB',
    'Caraguatatuba': 'CAR',
    'Resende': 'RES',
    'Jacareí': 'JAC',
    'Ilhabela': 'ILHA',
    'Ferraz de Vasconcelos': 'FEV',
    'Ferraz de Vasconcelos ': 'FEV',
  };

  for (const [nome, sigla] of Object.entries(siglas)) {
    await database.query(
      'UPDATE empresas SET sigla = ? WHERE TRIM(nome) = TRIM(?) AND (sigla IS NULL OR TRIM(sigla) = \'\');',
      {
        replacements: [sigla, nome],
      }
    );
  }
}

async function ensureComputadorMateriaisTable() {
  await database.query(`
    CREATE TABLE IF NOT EXISTS computador_materiais (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      computador_id INTEGER NOT NULL REFERENCES computadores(id) ON DELETE CASCADE,
      material_id INTEGER NOT NULL REFERENCES materiais(id) ON DELETE CASCADE,
      quantidade INTEGER NOT NULL DEFAULT 1,
      categoria VARCHAR(255),
      origem VARCHAR(255) NOT NULL DEFAULT 'ESTRUTURADO_CSV',
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function ensureUsersTable() {
  await database.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL DEFAULT 'tecnico',
      ativo TINYINT(1) NOT NULL DEFAULT 1,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await database.query(
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique ON users(LOWER(TRIM(email)));'
  );
}

async function seedAdminUser() {
  const adminPassword = String(process.env.ADMIN_CLEAR_PASSWORD || '').trim();
  if (!adminPassword) {
    console.warn('[ensureSchema] ADMIN_CLEAR_PASSWORD nao definido. Seed do admin ignorado.');
    return;
  }

  const adminEmail = String(process.env.ADMIN_EMAIL || 'admin@universo.local').trim().toLowerCase();
  const adminNome = String(process.env.ADMIN_NAME || 'Administrador').trim();
  const adminRole = String(process.env.ADMIN_ROLE || 'admin').trim();

  const existing = await database.query(
    'SELECT id FROM users WHERE LOWER(TRIM(email)) = LOWER(TRIM(?)) LIMIT 1;',
    {
      replacements: [adminEmail],
      type: database.QueryTypes.SELECT,
    }
  );

  const passwordHash = await bcrypt.hash(adminPassword, 10);

  if (existing.length) {
    await database.query(
      `
        UPDATE users
        SET nome = ?,
            password_hash = ?,
            role = ?,
            ativo = 1,
            updatedAt = CURRENT_TIMESTAMP
        WHERE id = ?;
      `,
      {
        replacements: [adminNome, passwordHash, adminRole, existing[0].id],
      }
    );
    return;
  }

  await database.query(
    `
      INSERT INTO users (nome, email, password_hash, role, ativo, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    `,
    {
      replacements: [adminNome, adminEmail, passwordHash, adminRole],
    }
  );
}

async function ensureSchema() {
  await ensureComputadoresColumns();
  await ensurePatrimonioUniqueIndex();
  await ensureEmpresaColumns();
  await ensureComputadorMateriaisTable();
  await ensureUsersTable();
  await seedEmpresaSiglas();
  await seedAdminUser();
}

module.exports = ensureSchema;
