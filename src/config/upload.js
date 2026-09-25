const multer = require("multer");

// File gambar ditahan di memory lalu diteruskan ke object storage.
// Tidak ada file yang ditulis ke disk untuk upload gambar.

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

// Untuk arsip ZIP: tanpa filter mimetype gambar,
// validasinya dilakukan di controller.
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

const extensionOf = (originalname) =>
    (
        String(originalname || "")
            .match(/\.[0-9a-z]+$/i) || [".jpg"]
    )[0].toLowerCase();

module.exports = {
    createImageUpload,
    createArchiveUpload,
    extensionOf,
    ALLOWED_IMAGE_MIMETYPES
};
