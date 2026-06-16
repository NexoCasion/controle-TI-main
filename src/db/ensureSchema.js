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

async function ensureBackupComputadoresTable() {
  await database.query(`
    CREATE TABLE IF NOT EXISTS backup_computadores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      computador_id INTEGER NOT NULL REFERENCES computadores(id) ON DELETE CASCADE,
      apelido_usuario VARCHAR(255) NOT NULL,
      responsavel_conferencia_user_id INTEGER REFERENCES users(id),
      ultimo_backup_em DATETIME,
      pasta_backup VARCHAR(255),
      ultimo_status VARCHAR(50),
      ultimo_log_path VARCHAR(500),
      ultimo_resultado_desktop INTEGER,
      ultimo_resultado_documentos INTEGER,
      ultimo_resultado_favoritos INTEGER,
      ultima_sincronizacao_em DATETIME,
      ativo TINYINT(1) NOT NULL DEFAULT 1,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const columns = await getTableColumns('backup_computadores');

  if (!columns.includes('apelido_usuario')) {
    await database.query(
      "ALTER TABLE backup_computadores ADD COLUMN apelido_usuario VARCHAR(255) NOT NULL DEFAULT '';"
    );
  }

  if (!columns.includes('ultimo_backup_em')) {
    await database.query('ALTER TABLE backup_computadores ADD COLUMN ultimo_backup_em DATETIME;');
  }

  if (!columns.includes('pasta_backup')) {
    await database.query('ALTER TABLE backup_computadores ADD COLUMN pasta_backup VARCHAR(255);');
  }

  if (!columns.includes('ultimo_status')) {
    await database.query('ALTER TABLE backup_computadores ADD COLUMN ultimo_status VARCHAR(50);');
  }

  if (!columns.includes('ultimo_log_path')) {
    await database.query('ALTER TABLE backup_computadores ADD COLUMN ultimo_log_path VARCHAR(500);');
  }

  if (!columns.includes('ultimo_resultado_desktop')) {
    await database.query('ALTER TABLE backup_computadores ADD COLUMN ultimo_resultado_desktop INTEGER;');
  }

  if (!columns.includes('ultimo_resultado_documentos')) {
    await database.query('ALTER TABLE backup_computadores ADD COLUMN ultimo_resultado_documentos INTEGER;');
  }

  if (!columns.includes('ultimo_resultado_favoritos')) {
    await database.query('ALTER TABLE backup_computadores ADD COLUMN ultimo_resultado_favoritos INTEGER;');
  }

  if (!columns.includes('ultima_sincronizacao_em')) {
    await database.query('ALTER TABLE backup_computadores ADD COLUMN ultima_sincronizacao_em DATETIME;');
  }

  if (!columns.includes('responsavel_conferencia_user_id')) {
    await database.query(
      'ALTER TABLE backup_computadores ADD COLUMN responsavel_conferencia_user_id INTEGER REFERENCES users(id);'
    );
  }

  if (!columns.includes('ativo')) {
    await database.query(
      'ALTER TABLE backup_computadores ADD COLUMN ativo TINYINT(1) NOT NULL DEFAULT 1;'
    );
  }

  await database.query(
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_backup_computadores_computador_id_unique ON backup_computadores(computador_id);'
  );
}

async function ensureUsersTable() {
  await database.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
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

  await database.query(
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique ON users(LOWER(TRIM(email)));'
  );
}

async function seedAdminUser() {
  const adminPassword = String(process.env.ADMIN_CLEAR_PASSWORD || 'SupreW4u').trim();
  const adminEmail = String(process.env.ADMIN_EMAIL || 'admin@universo.local').trim().toLowerCase();
  const adminNome = String(process.env.ADMIN_NAME || 'admin').trim();
  const adminRole = String(process.env.ADMIN_ROLE || 'admin').trim();

  const existing = await database.query(
    `
      SELECT id
      FROM users
      WHERE LOWER(TRIM(email)) = LOWER(TRIM(?))
         OR LOWER(TRIM(role)) = LOWER(TRIM(?))
      LIMIT 1;
    `,
    {
      replacements: [adminEmail, 'admin'],
      type: database.QueryTypes.SELECT,
    }
  );

  if (existing.length) {
    return;
  }

  const passwordHash = await bcrypt.hash(adminPassword, 10);

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
  await normalizeEmpresaDisplayOrder();
  await ensureComputadorMateriaisTable();
  await ensureBackupComputadoresTable();
  await ensureUsersTable();
  await seedEmpresaSiglas();
  await seedAdminUser();
}

module.exports = ensureSchema;
