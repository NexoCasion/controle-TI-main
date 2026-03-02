// src/models/ManutencaoMaterial.js
const Sequelize = require('sequelize');
const database = require('../db/init.js');

const ManutencaoMaterial = database.define('manutencao_materiais', {
  id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true,
  },

  // id do procedimento (manutencaoItems)
  manutencaoItem_id: {
    type: Sequelize.INTEGER,
    allowNull: false,
  },

  // id do material (materiais)
  material_id: {
    type: Sequelize.INTEGER,
    allowNull: false,
  },

  quantidade: {
    type: Sequelize.INTEGER,
    allowNull: false,
    defaultValue: 1,
  },
});

module.exports = ManutencaoMaterial;