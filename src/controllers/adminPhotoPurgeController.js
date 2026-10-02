const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const db = require("../config/database");

const {
    isStorageKey,
    deleteObject
} = require("../config/s3");

const {
    ZIP_TMP_DIR,
    removeFileSafe
} = require("../config/upload");

const {
    startPurgeProgress,
    advancePurgeProgress,
    finishPurgeProgress,
    failPurgeProgress,
    getPurgeProgress
} = require("../config/photoPurgeProgress");


// Hanya satu purge per admin pada satu waktu.
const activePurges = new Map();

const DELETE_CONCURRENCY = Math.max(
    1,
    parseInt(process.env.PURGE_CONCURRENCY || "8", 10) || 8
);


// =====================================================
// SCOPE RESOLUTION
//
// Lingkup: event + (opsional) fakultas + (opsional) prodi.
// Jika fakultas DAN prodi kosong -> seluruh event.
// Nama program studi tidak unik antar fakultas, jadi fakultas
// wajib ikut menentukan saat prodi dipilih.
// =====================================================

const resolveScope = async ({
    eventId,
    faculty,
    studyProgram
}) => {

    const values = [eventId];
    const conditions = ["g.event_id = $1"];

    if (faculty) {
        values.push(faculty);
        conditions.push(
            `LOWER(TRIM(g.faculty)) = LOWER(TRIM($${values.length}))`
        );
    }

    if (studyProgram) {
        values.push(studyProgram);
        conditions.push(
            `LOWER(TRIM(g.study_program)) = LOWER(TRIM($${values.length}))`
        );
    }

    const graduates = await db.query(
        `
        SELECT
            g.id,
            g.graduation_number,
            g.name,
            g.faculty,
            g.study_program
        FROM graduates g
        WHERE ${conditions.join(" AND ")}
        ORDER BY g.graduation_number ASC
        `,
        values
    );

    const ids = graduates.rows.map((row) => row.id);

    let photos = { rows: [] };

    if (ids.length) {
        photos = await db.query(
            `
            SELECT id, graduate_id, type, url, size
            FROM photos
            WHERE graduate_id = ANY($1)
            ORDER BY graduate_id, type
            `,
            [ids]
        );
    }

    const totalBytes = photos.rows.reduce(
        (total, row) => total + Number(row.size || 0),
        0
    );

    const keys = photos.rows
        .filter((row) => isStorageKey(row.url))
        .map((row) => row.url);

    const scopeParts = [];

    if (studyProgram) {
        scopeParts.push(studyProgram);
    } else if (faculty) {
        scopeParts.push(`ALL study programs in ${faculty}`);
    } else {
        scopeParts.push("ALL graduates in this event");
    }

    return {
        graduateIds: ids,
        graduates: graduates.rows,
        photos: photos.rows,
        keys,
        totalBytes,
        scopeLabel: scopeParts.join(" - ")
    };
};


// Ukuran JSON backup bisa besar, jadi ditulis ke disk lalu
// dihapus lagi setelah purge sukses.

const writeBackupFile = async (jobId, payload) => {

    const filePath = path.join(
        ZIP_TMP_DIR,
        `purge-backup-${jobId}.json`
    );

    await fs.promises.writeFile(
        filePath,
        JSON.stringify(payload),
        "utf8"
    );

    return filePath;
};


const buildBackupPayload = (scope, criteria) => ({

    generated_at: new Date().toISOString(),

    criteria,

    totals: {
        graduates: scope.graduates.length,
        photos: scope.photos.length,
        s3_keys: scope.keys.length,
        bytes: scope.totalBytes
    },

    graduates: scope.graduates,

    photos: scope.photos,

    s3_keys: scope.keys

});


// Hapus objek storage dengan batas paralel.

const deleteKeys = async (keys, onProgress) => {

    const failed = [];

    let deleted = 0;
    let next = 0;

    const workerCount = Math.min(DELETE_CONCURRENCY, keys.length);

    const workers = new Array(workerCount).fill(null).map(async () => {

        while (next < keys.length) {

            const index = next++;
            const key = keys[index];

            try {

                await deleteObject(key);
                deleted += 1;

            } catch (error) {

                console.error(
                    `PURGE DELETE FAILED (${key}):`,
                    error.message
                );

                failed.push({ key, reason: error.message });

            }

            onProgress(deleted, keys.length);

        }

    });

    await Promise.all(workers);

    return { deleted, failed };
};


// =====================================================
// OPTIONS (dropdown fakultas & prodi per event)
// =====================================================

const getPurgeOptions = async (req, res) => {

    const { eventId } = req.query;

    if (!eventId) {
        return res.status(400).json({
            message: "Event required"
        });
    }

    try {

        const result = await db.query(
            `
            SELECT DISTINCT
                faculty,
                study_program
            FROM graduates
            WHERE event_id = $1
            ORDER BY faculty, study_program
            `,
            [eventId]
        );

        const faculties = Array.from(
            new Set(
                result.rows
                    .map((row) => row.faculty)
                    .filter(Boolean)
            )
        ).sort();

        const studyPrograms = Array.from(
            new Set(
                result.rows
                    .map((row) => row.study_program)
                    .filter(Boolean)
            )
        ).sort();

        return res.json({
            faculties,
            study_programs: studyPrograms
        });

    } catch (error) {

        console.error("PURGE OPTIONS ERROR:", error);

        return res.status(500).json({
            message: "Internal server error"
        });

    }

};


// =====================================================
// PREVIEW
//
// Menghitung jumlah graduate, foto, dan total ukuran
// untuk lingkup yang dipilih, TANPA menghapus apa pun.
// =====================================================

const previewPurge = async (req, res) => {

    try {

        const { event_id, faculty, study_program } = req.body;

        if (!event_id) {
            return res.status(400).json({
                message: "Event required"
            });
        }

        const scope = await resolveScope({
            eventId: event_id,
            faculty,
            studyProgram: study_program
        });

        return res.json({

            scope: scope.scopeLabel,

            graduates: scope.graduates.length,

            photos: scope.photos.length,

            total_bytes: scope.totalBytes,

            breakdown: scope.photos.reduce((acc, row) => {

                const type = row.type || "UNKNOWN";

                if (!acc[type]) {
                    acc[type] = { count: 0, bytes: 0 };
                }

                acc[type].count += 1;
                acc[type].bytes += Number(row.size || 0);

                return acc;

            }, {})

        });

    } catch (error) {

        console.error("PURGE PREVIEW ERROR:", error);

        return res.status(500).json({
            message: "Internal server error"
        });

    }

};


// =====================================================
// DOWNLOAD BACKUP (dibuat ulang dari data yang masih ada)
//
// Berguna untuk mengambil daftar data sebelum menghapus, atau
// setelah purge gagal (data masih utuh, jadi bisa diunduh).
// =====================================================

const downloadPurgeBackup = async (req, res) => {

    try {

        const { event_id, faculty, study_program } = req.query;

        if (!event_id) {
            return res.status(400).json({
                message: "Event required"
            });
        }

        const criteria = {
            event_id,
            faculty: faculty || null,
            study_program: study_program || null
        };

        const scope = await resolveScope({
            eventId: event_id,
            faculty,
            studyProgram: study_program
        });

        const payload = buildBackupPayload(scope, criteria);

        const filename = `purge-backup-${
            study_program || faculty || `event-${event_id}`
        }`.replace(/[^\w.-]+/g, "-");

        res.setHeader("Content-Type", "application/json");
        res.setHeader(
            "Content-Disposition",
            `attachment; filename="${filename}.json"`
        );

        return res.send(JSON.stringify(payload, null, 2));

    } catch (error) {

        console.error("PURGE BACKUP ERROR:", error);

        return res.status(500).json({
            message: "Internal server error"
        });

    }

};


// =====================================================
// EXECUTE PURGE (background)
//
// Urutan aman:
//   1. Tulis backup sementara ke disk.
//   2. Hapus SEMUA objek storage dulu.
//   3. Jika ada yang gagal -> batalkan, JANGAN hapus DB,
//      simpan backup, laporkan key yang gagal.
//   4. Jika semua berhasil -> hapus baris DB (transaksi),
//      lalu hapus file backup.
// =====================================================

const runPurge = async (adminKey, criteria) => {

    const jobId = crypto.randomUUID();

    let backupFile = null;

    try {

        const scope = await resolveScope({

            eventId: criteria.event_id,
            faculty: criteria.faculty,
            studyProgram: criteria.study_program

        });

        if (!scope.photos.length) {

            failPurgeProgress(
                adminKey,
                "No photos found for the selected scope"
            );

            return;

        }

        // 1) BACKUP DULU
        backupFile = await writeBackupFile(
            jobId,
            buildBackupPayload(scope, criteria)
        );

        startPurgeProgress(adminKey, scope.keys.length);

        // 2) HAPUS STORAGE
        const { deleted, failed } = await deleteKeys(
            scope.keys,
            (done, total) => {
                advancePurgeProgress(
                    adminKey,
                    done,
                    total,
                    `Deleting photos from storage ${done}/${total}...`
                );
            }
        );

        // 3) ADA YANG GAGAL -> BATALKAN
        if (failed.length) {

            // Tidak ada baris DB yang dihapus, jadi data tetap utuh.
            // Backup sengaja TIDAK dihapus agar admin bisa menelusuri.
            failPurgeProgress(
                adminKey,
                `Storage deletion failed for ${failed.length} object(s). No database rows were deleted.`
            );

            return;

        }

        // 4) HAPUS BARIS DB
        advancePurgeProgress(
            adminKey,
            scope.keys.length,
            scope.keys.length,
            "Removing photo records..."
        );

        const photoIds = scope.photos.map((row) => row.id);

        const client = await db.connect();

        let removed = 0;

        try {

            await client.query("BEGIN");

            const result = await client.query(
                `DELETE FROM photos WHERE id = ANY($1)`,
                [photoIds]
            );

            removed = result.rowCount;

            await client.query("COMMIT");

        } catch (error) {

            await client.query("ROLLBACK");
            throw error;

        } finally {

            client.release();

        }

        // SUKSES -> backup sementara dihapus.
        await removeFileSafe(backupFile);
        backupFile = null;

        finishPurgeProgress(adminKey, {

            scope: scope.scopeLabel,
            graduates: scope.graduates.length,
            photoCount: removed,
            failedCount: 0,
            deletedObjects: deleted,
            totalBytes: scope.totalBytes,
            backupDeleted: true

        });

    } catch (error) {

        console.error("PURGE ERROR:", error);

        failPurgeProgress(
            adminKey,
            error.message || "Purge failed"
        );

    }

    // Backup yang tertinggal (karena gagal) dibersihkan saat
    // server restart lewat cleanupStaleZipTemps().

};


const purgePhotos = async (req, res) => {

    const adminKey =
        req.admin && req.admin.id != null
            ? String(req.admin.id)
            : "unknown";

    if (activePurges.has(adminKey)) {

        return res.status(409).json({
            message:
                "Another purge is still running. Please wait until it finishes."
        });

    }

    const { event_id, faculty, study_program } = req.body;

    if (!event_id) {

        return res.status(400).json({
            message: "Event required"
        });

    }

    const criteria = {
        event_id,
        faculty: faculty || null,
        study_program: study_program || null
    };

    // Cek dulu agar request tanpa foto tidak memulai job kosong.
    let scope;

    try {

        scope = await resolveScope({
            eventId: event_id,
            faculty,
            studyProgram: study_program
        });

    } catch (error) {

        console.error("PURGE PRECHECK ERROR:", error);

        return res.status(500).json({
            message: "Internal server error"
        });

    }

    if (!scope.photos.length) {

        return res.status(400).json({
            message: "No photos found for the selected scope"
        });

    }

    activePurges.set(adminKey, Date.now());

    runPurge(adminKey, criteria)
        .catch((error) => {
            console.error("PURGE BACKGROUND ERROR:", error);
        })
        .finally(() => {
            activePurges.delete(adminKey);
        });

    return res.json({

        message: "Purge started",

        started: true,

        scope: scope.scopeLabel,

        graduates: scope.graduates.length,

        photos: scope.photos.length,

        totalBytes: scope.totalBytes

    });

};


// =====================================================
// STATUS
// =====================================================

const getPurgeStatus = (req, res) => {

    const adminKey =
        req.admin && req.admin.id != null
            ? String(req.admin.id)
            : "unknown";

    const job = getPurgeProgress(adminKey);

    if (!job) {

        return res.json({
            active: false,
            phase: "idle",
            percent: 0
        });

    }

    return res.json({
        active: !job.done,
        ...job
    });

};


module.exports = {

    getPurgeOptions,
    previewPurge,
    downloadPurgeBackup,
    purgePhotos,
    getPurgeStatus

};
