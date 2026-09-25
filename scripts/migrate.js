// ======================================================
// APPLY DATABASE SCHEMA
//
// Membuat seluruh tabel yang dibutuhkan aplikasi dari
// db/schema.sql. Aman dijalankan berulang kali:
//
//   - 0 tabel ada    -> schema diterapkan
//   - 5 tabel lengkap -> dilewati (sudah termigrasi)
//   - sebagian ada    -> berhenti dengan pesan jelas
//
// Pemakaian:
//   node scripts/migrate.js
//   npm run migrate
// ======================================================

require("dotenv").config();

const fs = require("fs");
const path = require("path");

const db = require("../src/config/database");

const SCHEMA_FILE = path.join(__dirname, "..", "db", "schema.sql");

const TABLES = [
    "admins",
    "events",
    "graduates",
    "photos",
    "event_media"
];

async function main() {
    if (!fs.existsSync(SCHEMA_FILE)) {
        console.error(`Schema file not found: ${SCHEMA_FILE}`);
        process.exit(1);
    }

    const existing = await db.query(
        `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema='public'
        AND table_name = ANY($1)
        `,
        [TABLES]
    );

    const present = existing.rows.map((row) => row.table_name);

    if (present.length === TABLES.length) {
        console.log(
            `Schema already applied (${present.length}/${TABLES.length} tables). Nothing to do.`
        );

        process.exit(0);
    }

    if (present.length > 0) {
        console.error(
            `Refusing to continue: partial schema detected (${present.length}/${TABLES.length}).`
        );

        console.error(`Present: ${present.join(", ")}`);
        console.error(
            "Periksa database secara manual sebelum mengulang migrasi."
        );

        process.exit(1);
    }

    const sql = fs.readFileSync(SCHEMA_FILE, "utf8");

    const client = await db.connect();

    try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query("COMMIT");

        console.log(`Schema applied: ${TABLES.length} tables created.`);
    } catch (error) {
        await client.query("ROLLBACK");

        console.error("Migration failed:", error.message);

        process.exit(1);
    } finally {
        client.release();
    }

    process.exit(0);
}

main().catch((error) => {
    console.error("Migration failed:", error.message);
    process.exit(1);
});
