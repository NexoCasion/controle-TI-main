const Sequelize = require("sequelize");

const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: "./src/db/db.sqlite",

  // ✅ controla os logs do SQL
  logging: process.env.NODE_ENV === "development" ? false : false,
  // se você quiser ligar quando precisar, troque por:
  // logging: process.env.NODE_ENV === "development" ? console.log : false,
});

module.exports = sequelize;
