const multer = require("multer");
const os = require("os");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

// File gambar ditahan di memory lalu diteruskan ke object storage.
// Tidak ada file yang ditulis ke disk untuk upload gambar.

// -----------------------------------------------------------------
// ZIP BULK UPLOAD (disk-based)
//
// Arsip ZIP bisa berukuran beberapa GB. Menahannya di memory akan
// menghabiskan RAM server, jadi arsip ditulis ke disk sementara lalu
// dibaca sebagai file. File temp selalu dihapus setelah diproses.
// -----------------------------------------------------------------

const ZIP_TMP_DIR = path.join(
    os.tmpdir(),
    "pandawa-bulk-zip"
);

const ensureZipTmpDir = () => {
    fs.mkdirSync(ZIP_TMP_DIR, { recursive: true });
};

const zipStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        try {
            ensureZipTmpDir();
            cb(null, ZIP_TMP_DIR);
        } catch (error) {
            cb(error);
        }
    },

    filename: (req, file, cb) => {
        cb(
            null,
            `bulk-${Date.now()}-${crypto.randomUUID()}.zip`
        );
    }
});

// Hapus file temp, abaikan bila sudah tidak ada.
const removeFileSafe = async (filePath) => {
    if (!filePath) {
        return false;
    }

    try {
        await fs.promises.unlink(filePath);
        return true;
    } catch (error) {
        if (error.code !== "ENOENT") {
            console.error(
                `Failed to remove temp file "${filePath}":`,
                error.message
            );
        }
        return false;
    }
};

// Bersihkan sisa file temp dari proses yang gagal/crash sebelumnya.
// Dipanggil saat server start agar disk tidak menumpuk sampah.
const cleanupStaleZipTemps = async (maxAgeMs = 24 * 60 * 60 * 1000) => {
    try {
        ensureZipTmpDir();

        const entries = await fs.promises.readdir(ZIP_TMP_DIR);
        const now = Date.now();
        let removed = 0;

        for (const entry of entries) {
            const full = path.join(ZIP_TMP_DIR, entry);

            try {
                const stat = await fs.promises.stat(full);

                if (now - stat.mtimeMs > maxAgeMs) {
                    await fs.promises.unlink(full);
                    removed += 1;
                }
            } catch (error) {
                // File hilang di tengah iterasi: abaikan.
            }
        }

        return removed;
    } catch (error) {
        console.error(
            "Failed to clean stale ZIP temp files:",
            error.message
        );
        return 0;
    }
};

const ALLOWED_IMAGE_MIMETYPES = [
    "image/jpeg",
    "image/png",
    "image/webp"
];

const imageFilter = (req, file, cb) => {
    if (!ALLOWED_IMAGE_MIMETYPES.includes(file.mimetype)) {
        const error = new Error(
            "Only JPEG, PNG, and WebP images are allowed"
        );

        error.status = 400;

        return cb(error);
    }

    cb(null, true);
};

const createImageUpload = (options = {}) =>
    multer({
        storage: multer.memoryStorage(),

        limits: {
            fileSize:
                options.fileSize || 10 * 1024 * 1024,

            files:
                options.files || 1
        },

        fileFilter: imageFilter
    });

// Arsip kecil (mis. Excel import): ditahan di memory.
// Tanpa filter mimetype, validasi dilakukan di controller.
const createArchiveUpload = (options = {}) =>
    multer({
        storage: multer.memoryStorage(),

        limits: {
            fileSize:
                options.fileSize || 200 * 1024 * 1024,

            files:
                options.files || 1
        }
    });

// Arsip ZIP besar: ditulis ke disk sementara (bukan memory).
const createZipUpload = (options = {}) =>
    multer({
        storage: zipStorage,

        limits: {
            fileSize:
                options.fileSize ||
                parseInt(
                    process.env.BULK_MAX_UPLOAD ||
                    String(5 * 1024 * 1024 * 1024),
                    10
                ),

            files:
                options.files || 1
        }
    });

const extensionOf = (originalname) =>
    (
        String(originalname || "")
            .match(/\.[0-9a-z]+$/i) || [".jpg"]
    )[0].toLowerCase();

module.exports = {
    createImageUpload,
    createArchiveUpload,
    createZipUpload,
    removeFileSafe,
    cleanupStaleZipTemps,
    extensionOf,
    ALLOWED_IMAGE_MIMETYPES,
    ZIP_TMP_DIR
};
