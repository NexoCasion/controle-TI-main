// src/models/Material.js
const Sequelize = require('sequelize');
const database = require('../db/init.js');

const Material = database.define('materiais', {
  id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true,
  },

  material: {
    type: Sequelize.STRING,
    allowNull: false,
  },

  tipo: {
    type: Sequelize.STRING,
    allowNull: false,
  },

  marca: {
    type: Sequelize.STRING,
    allowNull: true,
  },

  especificacao: {
    type: Sequelize.STRING,
    allowNull: true,
  },

  quantidade_disponivel: {
    type: Sequelize.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },

  quantidade_em_uso: {
    type: Sequelize.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },

  nf: {
    type: Sequelize.STRING,
    allowNull: true,
  },
});

module.exports = Material;