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
    type: Sequelize.STRING,
    allowNull: false,
  },
  manutencaoId: {
    type: Sequelize.INTEGER,
    allowNull: false,
  },
});

module.exports = ManutencaoItem;
