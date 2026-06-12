const Sequelize = require('sequelize');
const database = require('../db/init.js');

const Computador = require('./Computador');
const User = require('./User');

const BackupComputador = database.define(
  'backup_computadores',
  {
    id: {
      type: Sequelize.INTEGER,
      autoIncrement: true,
      allowNull: false,
      primaryKey: true,
    },
    computadorId: {
      type: Sequelize.INTEGER,
      allowNull: false,
      unique: true,
      field: 'computador_id',
      references: {
        model: Computador,
        key: 'id',
      },
    },
    apelidoUsuario: {
      type: Sequelize.STRING,
      allowNull: false,
      field: 'apelido_usuario',
    },
    responsavelConferenciaUserId: {
      type: Sequelize.INTEGER,
      allowNull: true,
      field: 'responsavel_conferencia_user_id',
    },
    ultimoBackupEm: {
      type: Sequelize.DATE,
      allowNull: true,
      field: 'ultimo_backup_em',
    },
    ativo: {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    freezeTableName: true,
  }
);

BackupComputador.belongsTo(Computador, { foreignKey: 'computadorId', as: 'computador' });
Computador.hasOne(BackupComputador, { foreignKey: 'computadorId', as: 'backupControle' });
BackupComputador.belongsTo(User, {
  foreignKey: 'responsavelConferenciaUserId',
  as: 'responsavelConferencia',
});

module.exports = BackupComputador;
