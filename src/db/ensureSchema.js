const bcrypt = require('bcrypt');
const database = require('./init');
const {
  decryptUserField,
  encryptUserField,
  hashLookupValue,
  isEncryptedValue,
  normalizeLookupValue,
} = require('../services/userSecurity');

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

  if (!columns.includes('anydesk')) {
    await database.query("ALTER TABLE computadores ADD COLUMN anydesk VARCHAR(255);");
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

  if (!columns.includes('ordem_exibicao')) {
    await database.query('ALTER TABLE empresas ADD COLUMN ordem_exibicao INTEGER NOT NULL DEFAULT 0;');
  }
}

async function normalizeEmpresaDisplayOrder() {
  const empresas = await database.query(
    `
      SELECT id, nome, ordem_exibicao
      FROM empresas
      ORDER BY
        CASE
          WHEN ordem_exibicao IS NULL OR ordem_exibicao <= 0 THEN 1
          ELSE 0
        END ASC,
        ordem_exibicao ASC,
        TRIM(nome) ASC,
        id ASC;
    `,
    { type: database.QueryTypes.SELECT }
  );

  for (let index = 0; index < empresas.length; index += 1) {
    const empresa = empresas[index];
    const novaOrdem = index + 1;

    if (Number(empresa.ordem_exibicao || 0) !== novaOrdem) {
      await database.query(
        'UPDATE empresas SET ordem_exibicao = ? WHERE id = ?;',
        {
          replacements: [novaOrdem, empresa.id],
        }
      );
    }
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
      nome_hash VARCHAR(64),
      email_hash VARCHAR(64),
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL DEFAULT 'tecnico',
      add_computer_default_modal VARCHAR(30) NOT NULL DEFAULT 'structured',
      home_dashboard_preferences TEXT,
      ativo TINYINT(1) NOT NULL DEFAULT 1,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const columns = await getTableColumns('users');

  if (!columns.includes('add_computer_default_modal')) {
    await database.query(
      "ALTER TABLE users ADD COLUMN add_computer_default_modal VARCHAR(30) NOT NULL DEFAULT 'structured';"
    );
  }

  if (!columns.includes('home_dashboard_preferences')) {
    await database.query('ALTER TABLE users ADD COLUMN home_dashboard_preferences TEXT;');
  }

  if (!columns.includes('nome_hash')) {
    await database.query('ALTER TABLE users ADD COLUMN nome_hash VARCHAR(64);');
  }

  if (!columns.includes('email_hash')) {
    await database.query('ALTER TABLE users ADD COLUMN email_hash VARCHAR(64);');
  }

  await database.query(
    'DROP INDEX IF EXISTS idx_users_email_unique;'
  );

  await database.query(
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_users_nome_hash_unique ON users(nome_hash);'
  );

  await database.query(
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_hash_unique ON users(email_hash);'
  );
}

async function protectUsersData() {
  const users = await database.query(
    'SELECT id, nome, email, nome_hash, email_hash FROM users ORDER BY id ASC;',
    {
      type: database.QueryTypes.SELECT,
    }
  );

  for (const user of users) {
    const plainNome = String(decryptUserField(user.nome) || '').trim();
    const plainEmail = normalizeLookupValue(decryptUserField(user.email));
    const nomeHash = hashLookupValue(plainNome);
    const emailHash = hashLookupValue(plainEmail);
    const encryptedNome =
      isEncryptedValue(user.nome) && String(user.nome_hash || '') === nomeHash
        ? user.nome
        : encryptUserField(plainNome);
    const encryptedEmail =
      isEncryptedValue(user.email) && String(user.email_hash || '') === emailHash
        ? user.email
        : encryptUserField(plainEmail);

    await database.query(
      `
        UPDATE users
        SET nome = ?,
            email = ?,
            nome_hash = ?,
            email_hash = ?,
            updatedAt = CURRENT_TIMESTAMP
        WHERE id = ?;
      `,
      {
        replacements: [encryptedNome, encryptedEmail, nomeHash, emailHash, user.id],
      }
    );
  }
}

async function seedAdminUser() {
  const adminPassword = String(process.env.ADMIN_CLEAR_PASSWORD || '').trim();
  const adminPasswordHash = String(process.env.ADMIN_PASSWORD_HASH || '').trim();
  const adminEmail = String(process.env.ADMIN_EMAIL || 'admin@universo.local').trim().toLowerCase();
  const adminNome = String(process.env.ADMIN_NAME || 'admin').trim();
  const adminRole = String(process.env.ADMIN_ROLE || 'admin').trim();

  const existingAdmin = await database.query(
    "SELECT id FROM users WHERE role = 'admin' AND ativo = 1 LIMIT 1;",
    {
      type: database.QueryTypes.SELECT,
    }
  );

  if (existingAdmin.length) {
    return;
  }

  const passwordHash = adminPasswordHash || (adminPassword ? await bcrypt.hash(adminPassword, 10) : '');

  if (!passwordHash) {
    throw new Error(
      'Nenhum usuario admin ativo foi encontrado. Configure ADMIN_CLEAR_PASSWORD ou ADMIN_PASSWORD_HASH para criar o primeiro administrador.'
    );
  }

  await database.query(
    `
      INSERT INTO users (
        nome,
        email,
        nome_hash,
        email_hash,
        password_hash,
        role,
        ativo,
        createdAt,
        updatedAt
      )
      VALUES (?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    `,
    {
      replacements: [
        encryptUserField(adminNome),
        encryptUserField(adminEmail),
        hashLookupValue(adminNome),
        hashLookupValue(adminEmail),
        passwordHash,
        adminRole,
      ],
    }
  );
}

async function ensureSessionsTable() {
  await database.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      sid VARCHAR(255) PRIMARY KEY,
      sess TEXT NOT NULL,
      expires_at DATETIME,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await database.query(
    'CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);'
  );
}

async function ensureSchema() {
  await ensureComputadoresColumns();
  await ensurePatrimonioUniqueIndex();
  await ensureEmpresaColumns();
  await normalizeEmpresaDisplayOrder();
  await ensureComputadorMateriaisTable();
  await ensureUsersTable();
  await ensureSessionsTable();
  await protectUsersData();
  await seedEmpresaSiglas();
  await seedAdminUser();
}

module.exports = ensureSchema;
