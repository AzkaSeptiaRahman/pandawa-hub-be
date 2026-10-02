const jobs = new Map();

const DONE_TTL_MS = 10 * 60 * 1000;

const setJob = (adminKey, patch) => {
    const current = jobs.get(adminKey) || {
        phase: "idle",
        total: 0,
        processed: 0,
        percent: 0,
        message: "",
        done: false,
        result: null,
        error: null,
        startedAt: Date.now(),
        updatedAt: Date.now()
    };

    const next = {
        ...current,
        ...patch,
        updatedAt: Date.now()
    };

    jobs.set(adminKey, next);
    return next;
};

const startPurgeProgress = (adminKey, total) => setJob(adminKey, {
    phase: "deleting_storage",
    total: total || 0,
    processed: 0,
    percent: 0,
    message: "Deleting photos from storage...",
    done: false,
    result: null,
    error: null,
    startedAt: Date.now()
});

const advancePurgeProgress = (adminKey, processed, total, message) => setJob(adminKey, {
    phase: "deleting_storage",
    total: total || 0,
    processed: processed || 0,
    percent: total > 0 ? Math.min(100, Math.floor((processed / total) * 100)) : 0,
    message: message || `Deleting ${processed}/${total}...`
});

const finishPurgeProgress = (adminKey, result) => setJob(adminKey, {
    phase: "done",
    total: result.photoCount || 0,
    processed: result.photoCount || 0,
    percent: 100,
    message: "Completed",
    done: true,
    result,
    error: null
});

const failPurgeProgress = (adminKey, error) => setJob(adminKey, {
    phase: "error",
    message: error || "Purge failed",
    done: true,
    error: error || "Purge failed"
});

const getPurgeProgress = (adminKey) => {
    const job = jobs.get(adminKey);
    if (!job) return null;
    return { ...job };
};

const sweepPurgeProgress = () => {
    const now = Date.now();
    for (const [key, job] of jobs.entries()) {
        if (job.done && now - job.updatedAt > DONE_TTL_MS) jobs.delete(key);
    }
};

setInterval(sweepPurgeProgress, 60 * 1000).unref();

module.exports = {
    startPurgeProgress,
    advancePurgeProgress,
    finishPurgeProgress,
    failPurgeProgress,
    getPurgeProgress
};
