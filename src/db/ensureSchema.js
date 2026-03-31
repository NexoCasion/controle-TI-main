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

async function ensureSchema() {
  await ensureComputadoresColumns();
  await ensureEmpresaColumns();
  await ensureComputadorMateriaisTable();
  await seedEmpresaSiglas();
}

module.exports = ensureSchema;
