const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./canil.db', (err) => {
  if (err) console.error('Erro ao abrir banco de dados:', err);
  else console.log('Banco de dados conectado');
});

db.run(`
  CREATE TABLE IF NOT EXISTS leads (
    phone TEXT PRIMARY KEY,
    name TEXT,
    city TEXT,
    interest TEXT,
    last_contact TEXT,
    status TEXT
  )
`);

module.exports = db;