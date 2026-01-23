const Sequelize = require('sequelize');
const database = require('../db/init.js');
 
const Empresa = database.define('empresa', {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        allowNull: false,
        primaryKey: true
    },
    nome: {
        type: Sequelize.STRING,
        allowNull: false
    },

    descricao: {
        type: Sequelize.STRING,
        allowNull: true},

},{timestamps: false
})
 
module.exports = Empresa;