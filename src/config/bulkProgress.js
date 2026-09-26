// =====================================================
// BULK UPLOAD PROGRESS
//
// Menyimpan progress pemrosesan ZIP di memory, per admin.
// Hanya boleh ada satu upload per admin, jadi admin id
// cukup dipakai sebagai kunci.
//
// Upload byte-nya sendiri dipantau di browser (XHR),
// modul ini melacak fase setelah file diterima server:
// membuka ZIP, mengunggah tiap foto ke storage, insert DB.
// =====================================================

const jobs = new Map();

// Entri "selesai" disimpan sebentar supaya klien yang
// polling terlambat tetap bisa membaca hasil akhirnya.
const DONE_TTL_MS = 2 * 60 * 1000;

const setJob = (adminKey, patch) => {
    const current = jobs.get(adminKey) || {
        phase: "idle",
        total: 0,
        processed: 0,
        percent: 0,
        message: "",
        startedAt: Date.now(),
        updatedAt: Date.now(),
        done: false,
        counters: null
    };

    const next = {
        ...current,
        ...patch,
        updatedAt: Date.now()
    };

    jobs.set(adminKey, next);

    return next;
};

// Dipanggil saat server mulai memproses ZIP.
const startBulkProgress = (adminKey, total) =>
    setJob(adminKey, {
        phase: "processing",
        total: total || 0,
        processed: 0,
        percent: 0,
        message: "Processing ZIP...",
        startedAt: Date.now(),
        done: false,
        counters: null
    });

// Dipanggil saat satu entri ZIP mulai diproses.
// `counters` dipegang by reference (array success/failed/skipped
// milik controller), sehingga angka yang dibaca selalu terbaru
// tanpa perlu snapshot tiap iterasi.
const advanceBulkProgress = (
    adminKey,
    {
        total,
        processed,
        counters
    }
) => {
    const totalCount = total || 0;

    const percent =
        totalCount > 0
            ? Math.min(
                100,
                Math.floor((processed / totalCount) * 100)
            )
            : 0;

    return setJob(adminKey, {
        total: totalCount,
        processed: processed || 0,
        percent,
        counters: counters || null,
        message: `Processing ${processed}/${totalCount}...`
    });
};

const finishBulkProgress = (adminKey, result) => {
    const r = result || {};

    return setJob(adminKey, {
        phase: "done",
        percent: 100,
        processed: r.total || 0,
        total: r.total || 0,
        done: true,
        message: "Completed",
        counters: null,
        result: result || null
    });
};

const failBulkProgress = (adminKey, message) =>
    setJob(adminKey, {
        phase: "error",
        done: true,
        message: message || "Upload failed",
        counters: null
    });

// Bangun payload yang aman dikirim ke klien: counter dihitung
// dari referensi array saat dibaca, jadi selalu konsisten.
const getBulkProgress = (adminKey) => {
    const job = jobs.get(adminKey);

    if (!job) {
        return null;
    }

    const c = job.counters;
    const r = job.result;

    // Saat masih berjalan, counter dibaca dari array by-reference.
    // Setelah selesai, array dilepas, jadi pakai angka dari result.
    const success =
        c && Array.isArray(c.success)
            ? c.success.length
            : (r && r.success_count) || 0;

    const failed =
        c && Array.isArray(c.failed)
            ? c.failed.length
            : (r && r.failed_count) || 0;

    const skipped =
        c && Array.isArray(c.skipped)
            ? c.skipped.length
            : (r && r.skipped_count) || 0;

    return {
        phase: job.phase,
        total: job.total,
        processed: job.processed,
        success,
        failed,
        skipped,
        percent: job.percent,
        message: job.message,
        startedAt: job.startedAt,
        updatedAt: job.updatedAt,
        done: job.done,
        result: job.result || null
    };
};

const clearBulkProgress = (adminKey) => {
    jobs.delete(adminKey);
};

// Buang entri lama agar memory tidak tumbuh terus.
const sweepBulkProgress = () => {
    const now = Date.now();

    for (const [key, job] of jobs.entries()) {
        if (job.done && now - job.updatedAt > DONE_TTL_MS) {
            jobs.delete(key);
        }
    }
};

module.exports = {
    startBulkProgress,
    advanceBulkProgress,
    finishBulkProgress,
    failBulkProgress,
    getBulkProgress,
    clearBulkProgress,
    sweepBulkProgress
};
