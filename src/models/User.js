const Sequelize = require('sequelize');
const database = require('../db/init.js');
const {
  decryptUserField,
  encryptUserField,
  hashLookupValue,
  normalizeLookupValue,
} = require('../services/userSecurity');

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
    get() {
      return decryptUserField(this.getDataValue('nome'));
    },
    set(value) {
      const normalized = String(value || '').trim();
      this.setDataValue('nome', encryptUserField(normalized));
      this.setDataValue('nome_hash', hashLookupValue(normalized));
    },
  },
  email: {
    type: Sequelize.STRING,
    allowNull: false,
    get() {
      return decryptUserField(this.getDataValue('email'));
    },
    set(value) {
      const normalized = normalizeLookupValue(value);
      this.setDataValue('email', encryptUserField(normalized));
      this.setDataValue('email_hash', hashLookupValue(normalized));
    },
  },
  nome_hash: {
    type: Sequelize.STRING(64),
    allowNull: false,
  },
  email_hash: {
    type: Sequelize.STRING(64),
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
