// src/models/MaterialMovimento.js
const Sequelize = require('sequelize');
const database = require('../db/init.js');

const MaterialMovimento = database.define('materiais_movimentos', {
  id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true,
  },

  material_id: {
    type: Sequelize.INTEGER,
    allowNull: false,
  },

  // exemplos: 'SAIDA_MANUTENCAO', 'ENTRADA', 'AJUSTE'
  tipo_movimento: {
    type: Sequelize.STRING,
    allowNull: false,
  },

  quantidade: {
    type: Sequelize.INTEGER,
    allowNull: false,
  },

  // referência ao procedimento (manutencaoItems.id) quando aplicável
  referencia_manutencaoItem_id: {
    type: Sequelize.INTEGER,
    allowNull: true,
  },

  // opcional: você pode adicionar depois:
  // observacao: { type: Sequelize.TEXT, allowNull: true },
});

module.exports = MaterialMovimento;