require('dotenv').config();
const express = require('express');
const session = require('express-session');
const SQLiteStoreFactory = require('connect-sqlite3');
const helmet = require('helmet');
const crypto = require('crypto');
const routes = require('./routes');
const path = require('path');
require('express-async-errors');
const database = require('./db/init');
require('./models/Empresa');
require('./models/Computador');
require('./models/Manutencao');
require('./models/ManutencaoItem');
require('./models/Transferencia');
require('./models/Material');
require('./models/ManutencaoMaterial');
require('./models/MaterialMovimento');
require('./models/ComputadorMaterial');
require('./models/User');
const ensureSchema = require('./db/ensureSchema');
const { attachCurrentUser } = require('./middlewares/auth');
const { ensureCsrfToken, csrfProtection } = require('./middlewares/csrf');

const app = express();
const SQLiteStore = SQLiteStoreFactory(session);
const isProduction = process.env.NODE_ENV === 'production';
const configuredSessionSecret = String(process.env.SESSION_SECRET || '').trim();

if (!configuredSessionSecret && isProduction) {
  throw new Error('SESSION_SECRET deve estar configurado em produção.');
}

const sessionSecret =
  configuredSessionSecret || crypto.randomBytes(32).toString('hex');

if (!configuredSessionSecret) {
  console.warn('SESSION_SECRET não configurado. Gerando segredo efêmero para esta execução.');
}

app.use((req, res, next) => {
  // Suponha que você tenha lógica para definir um alerta
  // Definimos como null ou uma string vazia quando não há alerta
  res.locals.alert = null; // ou res.locals.alert = '';
  next();
});

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static('src/public'));
app.use(
  session({
    store: new SQLiteStore({
      db: 'sessions.sqlite',
      dir: path.join(__dirname, 'db'),
    }),
    name: 'controle_ti.sid',
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction ? 'auto' : false,
      maxAge: 1000 * 60 * 60 * 12,
    },
  })
);
app.set('trust proxy', 1);
app.use(ensureCsrfToken);
app.use(attachCurrentUser);
app.use(csrfProtection);
app.use(routes);

//error handler (no async methods)
app.use((err, request, response, next) => {
  console.log('####  Error handler received ############################');
  console.log(err);
  response.sendStatus(500);
});

const PORT = process.env.PORT || 3000;

(async () => {
  try {
    await ensureSchema();
    //     // ✅ Limpa tabelas de backup que podem sobrar quando o Sequelize crasha no SQLite
    // await database.query("DROP TABLE IF EXISTS empresas_backup;");
    // await database.query("DROP TABLE IF EXISTS computadores_backup;");
    // await database.query("DROP TABLE IF EXISTS manutencoes_backup;");
    // await database.query("DROP TABLE IF EXISTS manutencaoItems_backup;");
    // await database.query("DROP TABLE IF EXISTS transferencias_backup;");

    // await database.query("PRAGMA foreign_keys = OFF;");

    // await database.sync({ alter: true }); // <-- ISSO atualiza/cria colunas

    // await database.query("PRAGMA foreign_keys = ON;");

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🔥 Server running at http://localhost:${PORT}`);
      console.log('Senha admin carregada?', !!process.env.ADMIN_CLEAR_PASSWORD);
    });
  } catch (err) {
    console.error('Erro ao sincronizar o banco:', err);
  }
})();
