// Deletes the database file so the app recreates the full schema on next server start.
// Usage: npm run db:reset
// WARNING: All data will be lost.

const fs = require("fs");
const path = require("path");

const dbPath = process.env.SQLITE_PATH ?? path.join(process.cwd(), "bgmancer.db");

for (const suffix of ["", "-wal", "-shm"]) {
  const file = dbPath + suffix;
  if (fs.existsSync(file)) {
    fs.unlinkSync(file);
    console.log(`Deleted ${file}`);
  }
}

console.log("Database reset. Schema will be recreated on next server start.");
