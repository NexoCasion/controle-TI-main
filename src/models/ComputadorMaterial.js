const Sequelize = require('sequelize');
const database = require('../db/init.js');

const Computador = require('./Computador');
const Material = require('./Material');

const ComputadorMaterial = database.define('computador_materiais', {
  id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true,
  },
  computador_id: {
    type: Sequelize.INTEGER,
    allowNull: false,
  },
  material_id: {
    type: Sequelize.INTEGER,
    allowNull: false,
  },
  quantidade: {
    type: Sequelize.INTEGER,
    allowNull: false,
    defaultValue: 1,
  },
  categoria: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  origem: {
    type: Sequelize.STRING,
    allowNull: false,
    defaultValue: 'ESTRUTURADO_CSV',
  },
});

Computador.hasMany(ComputadorMaterial, { foreignKey: 'computador_id', as: 'componentes' });
ComputadorMaterial.belongsTo(Computador, { foreignKey: 'computador_id', as: 'computador' });

Material.hasMany(ComputadorMaterial, { foreignKey: 'material_id', as: 'computadoresEmUso' });
ComputadorMaterial.belongsTo(Material, { foreignKey: 'material_id', as: 'material' });

module.exports = ComputadorMaterial;
