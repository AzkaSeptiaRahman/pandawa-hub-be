// ======================================================
// RESET CONTENT DATA (fresh start)
//
// Menghapus seluruh data konten: events, graduates,
// event_media, dan photos — termasuk objek di object
// storage. Akun admin TIDAK dihapus.
//
// Pemakaian:
//   node scripts/resetData.js --yes
//
// Tanpa flag --yes, script hanya menampilkan ringkasan
// dan tidak mengubah apa pun.
// ======================================================

require("dotenv").config();

const db = require("../src/config/database");

const { deleteObjectSafe, isStorageKey } = require("../src/config/s3");

async function collectKeys() {
    const keys = [];

    const photos = await db.query("SELECT url FROM photos");

    for (const row of photos.rows) {
        keys.push(row.url);
    }

    const media = await db.query("SELECT url FROM event_media");

    for (const row of media.rows) {
        keys.push(row.url);
    }

    const events = await db.query("SELECT thumbnail FROM events");

    for (const row of events.rows) {
        keys.push(row.thumbnail);
    }

    // Hanya nilai yang benar-benar object key (bukan URL lama
    // /uploads/... atau http(s)://) yang dihapus dari storage.
    return keys.filter((key) => key && isStorageKey(key));
}

async function summary() {
    const counts = {};

    for (const table of ["events", "graduates", "event_media", "photos"]) {
        const result = await db.query(
            `SELECT COUNT(*)::int AS total FROM ${table}`
        );

        counts[table] = result.rows[0].total;
    }

    const admins = await db.query("SELECT COUNT(*)::int AS total FROM admins");

    return { counts, admins: admins.rows[0].total };
}

async function main() {
    const confirmed = process.argv.includes("--yes");

    const { counts, admins } = await summary();

    console.log("Current data:");
    console.log(`  events      : ${counts.events}`);
    console.log(`  graduates   : ${counts.graduates}`);
    console.log(`  event_media : ${counts.event_media}`);
    console.log(`  photos      : ${counts.photos}`);
    console.log(`  admins      : ${admins} (tidak akan dihapus)`);

    if (!confirmed) {
        console.log("");
        console.log("Dry run. Tambahkan --yes untuk benar-benar menghapus:");
        console.log("  node scripts/resetData.js --yes");
        process.exit(0);
    }

    const keys = await collectKeys();

    console.log("");
    console.log(`Deleting ${keys.length} object(s) from storage...`);

    for (const key of keys) {
        await deleteObjectSafe(key);
    }

    // Urutan mengikuti foreign key: anak dulu, lalu induk.
    await db.query(
        "TRUNCATE TABLE photos, event_media, graduates, events RESTART IDENTITY CASCADE"
    );

    console.log("Content data cleared. Admin accounts untouched.");
    console.log("Storage objects removed:", keys.length);

    process.exit(0);
}

main().catch((error) => {
    console.error("Reset failed:", error.message);
    process.exit(1);
});
