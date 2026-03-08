// Creates a bit-perfect backup of the database using SQLite's native Backup API.
// Usage: npm run db:snapshot [-- --name my-backup]
//        Creates: backups/<name|timestamp>.db

const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const dbPath =
  process.env.SQLITE_PATH ?? path.join(process.cwd(), "bgmancer.db");

if (!fs.existsSync(dbPath)) {
  console.error(`Database not found at ${dbPath}`);
  process.exit(1);
}

const nameArg = process.argv.indexOf("--name");
const backupName =
  nameArg !== -1 && process.argv[nameArg + 1]
    ? process.argv[nameArg + 1]
    : new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

const backupsDir = path.join(process.cwd(), "backups");
fs.mkdirSync(backupsDir, { recursive: true });

const destPath = path.join(backupsDir, `${backupName}.db`);

const db = new Database(dbPath, { readonly: true });

db.backup(destPath)
  .then(() => {
    db.close();
    console.log(`Backup saved → ${path.relative(process.cwd(), destPath)}`);
  })
  .catch((err) => {
    db.close();
    console.error("Backup failed:", err.message);
    process.exit(1);
  });
