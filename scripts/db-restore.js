// Restores the database from a .db backup file.
// Usage: npm run db:restore [-- path/to/backup.db]
//        If no path is given, uses the most recently modified file in backups/.
//
// WARNING: The current database will be replaced entirely.

const path = require("path");
const fs = require("fs");

const backupsDir = path.join(process.cwd(), "backups");

let backupPath = process.argv[2];

if (!backupPath) {
  if (!fs.existsSync(backupsDir)) {
    console.error("No backups/ directory found. Run db:snapshot first.");
    process.exit(1);
  }
  const files = fs
    .readdirSync(backupsDir)
    .filter((f) => f.endsWith(".db"))
    .map((f) => ({
      name: f,
      mtime: fs.statSync(path.join(backupsDir, f)).mtimeMs,
    }))
    .sort((a, b) => b.mtime - a.mtime);

  if (files.length === 0) {
    console.error("No .db backup files found in backups/.");
    process.exit(1);
  }

  backupPath = path.join(backupsDir, files[0].name);
  console.log(`Using latest backup: ${files[0].name}`);
}

if (!fs.existsSync(backupPath)) {
  console.error(`Backup file not found: ${backupPath}`);
  process.exit(1);
}

const dbPath = process.env.SQLITE_PATH ?? path.join(process.cwd(), "bgmancer.db");

fs.copyFileSync(backupPath, dbPath);

console.log(`Restored from: ${path.relative(process.cwd(), backupPath)}`);
console.log(`→ ${path.relative(process.cwd(), dbPath)}`);
