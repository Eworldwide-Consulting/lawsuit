const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, '../../../trivanta.db');
const db = new Database(dbPath, { readonly: true });
const rows = db.prepare("SELECT id,title,description FROM tasks WHERE title LIKE '%doctor appointment notes%'").all();
console.log(JSON.stringify(rows, null, 2));
