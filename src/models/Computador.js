const Sequelize = require('sequelize');
const database = require('../db/init.js');

const Empresa = require('./Empresa');

const Computador = database.define('computadores', {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        allowNull: false,
        primaryKey: true
    },
    patrimonio: {
        type: Sequelize.STRING,
        allowNull: false
    },
    specs: {
        type: Sequelize.STRING,
        allowNull: false
    },
    // Adicionando a chave estrangeira para a tabela Empresa
    empresaId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
            model: Empresa,
            key: 'id'
        }
    },

  setor: {
    type: Sequelize.STRING,
    allowNull: true,
  },
 ativo: {
  type: Sequelize.BOOLEAN,
  allowNull: false,
  defaultValue: true,
},

status: {
  type: Sequelize.INTEGER,
  allowNull: true,
  defaultValue: null,
},

dataDescarte: {
  type: Sequelize.DATE,
  allowNull: true,
},

motivoDescarte: {
  type: Sequelize.STRING,
  allowNull: true,
},


});


Computador.belongsTo(Empresa, { foreignKey: 'empresaId', as: 'empresa' })

module.exports = Computador;
