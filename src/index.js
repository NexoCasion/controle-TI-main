require('dotenv').config();
const express = require('express');
const routes = require('./routes');
const path = require('path');
require('express-async-errors');
require('dotenv').config();
const database = require('./db/init');
require('./models/Empresa');
require('./models/Computador');
require('./models/Manutencao');
require('./models/ManutencaoItem');
require('./models/Transferencia');
require('./models/Material');
require('./models/ManutencaoMaterial');
require('./models/MaterialMovimento');

const app = express();

app.use((req, res, next) => {
  // Suponha que você tenha lógica para definir um alerta
  // Definimos como null ou uma string vazia quando não há alerta
  res.locals.alert = null; // ou res.locals.alert = '';
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
(app.use(routes), app.set('views', path.join(__dirname, 'views')));
app.set('view engine', 'ejs');
app.use(express.static('src/public'));

//error handler (no async methods)
app.use((err, request, response, next) => {
  console.log('####  Error handler received ############################');
  console.log(err);
  response.sendStatus(500);
});

const PORT = process.env.PORT || 3000;

(async () => {
  try {
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


