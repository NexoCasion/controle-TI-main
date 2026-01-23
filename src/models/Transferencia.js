const Sequelize = require('sequelize');
const database = require('../db/init.js');

const Empresa = require('./Empresa');
const Computador = require('./Computador');

const Transferencia = database.define('transferencias', {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        allowNull: false,
        primaryKey: true
    },
    data: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
    },
    observacao: {
        type: Sequelize.STRING,
        allowNull: true
    },
    emp_origem: {
        type: Sequelize.INTEGER,
        references: {
            model: Empresa,
            key: 'id'
        }
    },
    emp_destino: {
        type: Sequelize.INTEGER,
        references: {
            model: Empresa,
            key: 'id'
        }
    },
    computador: {
        type: Sequelize.INTEGER,
        references: {
            model: Computador,
            key: 'id'
        }
    }
}, {
    timestamps: true
});

Transferencia.belongsTo(Computador, { foreignKey: 'computador' });
Transferencia.belongsTo(Empresa, { foreignKey: 'emp_origem', as: 'origem' });
Transferencia.belongsTo(Empresa, { foreignKey: 'emp_destino', as: 'destino' });

module.exports = Transferencia;