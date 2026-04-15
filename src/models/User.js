const Sequelize = require('sequelize');
const database = require('../db/init.js');

const User = database.define('users', {
  id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true,
  },
  nome: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  email: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  password_hash: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  role: {
    type: Sequelize.STRING,
    allowNull: false,
    defaultValue: 'tecnico',
  },
  add_computer_default_modal: {
    type: Sequelize.STRING,
    allowNull: false,
    defaultValue: 'structured',
  },
  home_dashboard_preferences: {
    type: Sequelize.TEXT,
    allowNull: true,
  },
  ativo: {
    type: Sequelize.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
});

module.exports = User;
