const db = require('../db/init');

async function main() {
  const rows = await db.query(
    `
      SELECT TRIM(patrimonio) AS patrimonio,
             GROUP_CONCAT(id, ', ') AS ids,
             COUNT(*) AS total
      FROM computadores
      GROUP BY TRIM(patrimonio)
      HAVING TRIM(patrimonio) <> '' AND COUNT(*) > 1
      ORDER BY total DESC, patrimonio ASC;
    `,
    { type: db.QueryTypes.SELECT }
  );

  if (!rows.length) {
    console.log('Nenhum patrimonio duplicado encontrado.');
    return;
  }

  console.log('Patrimonios duplicados encontrados:\n');

  rows.forEach((row) => {
    console.log(`Patrimonio: ${row.patrimonio}`);
    console.log(`Quantidade: ${row.total}`);
    console.log(`IDs: ${row.ids}`);
    console.log('');
  });
}

main().catch((error) => {
  console.error('Erro ao auditar patrimonios duplicados:', error);
  process.exit(1);
});
