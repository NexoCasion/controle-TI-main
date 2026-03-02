// src/models/ManutencaoItem.js
const Sequelize = require('sequelize');
const database = require('../db/init.js');

const ManutencaoItem = database.define('manutencaoItems', {
  id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true,
  },
  descricao: {
    type: Sequelize.TEXT,
    allowNull: false,
  },
  manutencaoId: {
    type: Sequelize.INTEGER,
    allowNull: false,
  },
  tipo: {
  type: Sequelize.STRING,
  allowNull: true, // mantém compatibilidade com itens antigos
  },
  specs_antes: {
    type: Sequelize.TEXT,
    allowNull: true,
  },
  specs_depois: {
    type: Sequelize.TEXT,
    allowNull: true,
  },
  material_snapshot: {
    type: Sequelize.TEXT,
    allowNull: true,
  },
});

module.exports = ManutencaoItem;
