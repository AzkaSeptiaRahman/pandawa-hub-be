const db = require("../config/database");
const crypto = require("crypto");
const unzipper = require("unzipper");

const {
    uploadObject,
    deleteObjectSafe
} = require("../config/s3");

const {
    extensionOf,
    removeFileSafe
} = require("../config/upload");

const {
    getBulkProgress,
    startBulkProgress,
    advanceBulkProgress,
    finishBulkProgress,
    failBulkProgress
} = require("../config/bulkProgress");


// =====================================================
// LIST PHOTOS
// =====================================================

const getPhotos = async (req, res) => {

    try {

        const values = [];
        const conditions = [];

        if (req.query.graduateId) {
            values.push(req.query.graduateId);
            conditions.push(`p.graduate_id=$${values.length}`);
        }

        const result = await db.query(
            `
            SELECT p.*, g.name, g.graduation_number
            FROM photos p
            JOIN graduates g ON g.id=p.graduate_id
            ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""}
            ORDER BY p.id DESC
            `,
            values
        );

        return res.json({
            photos: result.rows
        });

    } catch (error) {

        console.error("GET PHOTOS ERROR:", error);

        return res.status(500).json({
            message: "Internal server error"
        });
    }

};


// =====================================================
// SINGLE PHOTO UPLOAD
// =====================================================

const uploadPhoto = async (req, res) => {

    try {

        const {
            graduate_id,
            type
        } = req.body;


        if (!graduate_id || !type || !req.file) {

            return res.status(400).json({
                message: "Graduate, type and file required"
            });

        }


        const photoType =
            String(type).toUpperCase().trim();


        if (
            ![
                "BEBAS",
                "KUNCIR",
                "IJAZAH"
            ].includes(photoType)
        ) {

            return res.status(400).json({
                message: "Invalid photo type"
            });

        }


        const graduate = await db.query(
            `
            SELECT id
            FROM graduates
            WHERE id = $1
            `,
            [graduate_id]
        );


        if (!graduate.rows.length) {

            return res.status(404).json({
                message: "Graduate not found"
            });

        }


        const url =
            `photos/${graduate_id}/${photoType}/${crypto.randomUUID()}${extensionOf(req.file.originalname)}`;

        await uploadObject(
            url,
            req.file.buffer,
            req.file.mimetype
        );


        const result = await db.query(
            `
            INSERT INTO photos
            (
                graduate_id,
                type,
                url,
                filename,
                size
            )
            VALUES ($1,$2,$3,$4,$5)
            RETURNING *
            `,
            [
                graduate_id,
                photoType,
                url,
                req.file.originalname,
                req.file.size
            ]
        );


        return res.json({

            message: "Upload success",

            photo: result.rows[0]

        });


    } catch (error) {

        console.error(
            "SINGLE PHOTO ERROR:",
            error
        );


        return res.status(500).json({
            message:"Internal server error"
        });

    }

};



// =====================================================
// DELETE PHOTO
// =====================================================

const deletePhoto = async (req, res) => {

    try {

        const result = await db.query(
            `
            DELETE FROM photos
            WHERE id=$1
            RETURNING *
            `,
            [req.params.id]
        );

        if (!result.rows.length) {
            return res.status(404).json({
                message: "Photo not found"
            });
        }

        await deleteObjectSafe(result.rows[0].url);

        return res.json({
            message: "Photo deleted",
            photo: result.rows[0]
        });

    } catch (error) {

        console.error("DELETE PHOTO ERROR:", error);

        return res.status(500).json({
            message: "Internal server error"
        });
    }

};


// =====================================================
// BULK PHOTO UPLOAD
// =====================================================

// Hanya satu bulk upload per admin pada satu waktu.
// Mencegah dua ZIP besar diproses bersamaan (boros RAM/disk).
const activeBulkUploads = new Map();

const bulkUpload = async (req, res) => {

    const adminKey =
        req.admin && req.admin.id != null
            ? String(req.admin.id)
            : "unknown";

    if (activeBulkUploads.has(adminKey)) {

        // Request ditolak: file ZIP-nya sudah ditulis ke disk oleh
        // multer, jadi harus dihapus agar tidak jadi sampah.
        if (req.file && req.file.path) {

            await removeFileSafe(req.file.path);

        }

        return res.status(409).json({

            message:
                "Another bulk upload is still running. Please wait until it finishes."

        });

    }

    activeBulkUploads.set(adminKey, Date.now());

    // ZIP ditulis ke disk sementara oleh multer.
    const tempPath =
        req.file && req.file.path
            ? req.file.path
            : null;

    try {

        console.log(
            "POST /api/admin/photos/bulk-upload"
        );


        const {
            event_id,
            faculty
        } = req.body;


        // -------------------------------------------------
        // VALIDATION
        // -------------------------------------------------

        if (!event_id) {

            return res.status(400).json({
                message: "Event required"
            });

        }


        if (!faculty) {

            return res.status(400).json({
                message: "Faculty required"
            });

        }


        if (!req.file) {

            return res.status(400).json({
                message: "ZIP file required"
            });

        }


        // -------------------------------------------------
        // CHECK EVENT
        // -------------------------------------------------

        const eventCheck = await db.query(
            `
            SELECT
                id,
                name,
                type
            FROM events
            WHERE id = $1
            `,
            [event_id]
        );


        if (!eventCheck.rows.length) {

            return res.status(404).json({
                message: "Event not found"
            });

        }


        if (
            eventCheck.rows[0].type !== "PERSONAL"
        ) {

            return res.status(400).json({

                message:
                    "Bulk upload only available for PERSONAL event"

            });

        }


        // -------------------------------------------------
        // OPEN ZIP (dari memory, tidak menyentuh disk)
        // -------------------------------------------------

        const zip =
            await unzipper.Open.file(
                req.file.path
            );


        const success = [];
        const failed = [];
        const skipped = [];

        // Progress: jumlah entri ZIP yang akan diproses.
        const totalEntries = zip.files.filter(
            (entry) =>
                entry.type === "File" &&
                !entry.path.includes("__MACOSX") &&
                !String(
                    entry.path.split("/").pop()
                )
                    .split("\\")
                    .pop()
                    .startsWith(".")
        ).length;

        let processed = 0;

        let totalUncompressed = 0;

        const MAX_UNCOMPRESSED =
            parseInt(
                process.env.BULK_MAX_UNCOMPRESSED ||
                String(500 * 1024 * 1024),
                10
            );


        // -------------------------------------------------
        // TRACK S3 OBJECTS UPLOADED IN THIS RUN
        //
        // Dipakai untuk kompensasi bila transaksi di-rollback,
        // supaya tidak ada objek yatim di object storage.
        // -------------------------------------------------

        const uploadedKeys = [];


        // -------------------------------------------------
        // DEDUPLIKASI DALAM SATU ZIP
        //
        // Kunci: graduate + type. Dua entri dengan nama berbeda
        // tetapi graduate/type yang sama hanya diambil satu.
        // -------------------------------------------------

        const seenInZip = new Set();


        // Seluruh proses dibungkus satu transaksi sehingga
        // kegagalan di tengah tidak meninggalkan data separuh jadi.
        const client = await db.connect();


        try {

            await client.query("BEGIN");


            startBulkProgress(
                adminKey,
                totalEntries
            );


        // -------------------------------------------------
        // PROCESS ZIP
        // -------------------------------------------------

        for (const item of zip.files) {

            if (
                item.type !== "File"
            ) {

                continue;

            }


            // Mac ZIP sometimes creates __MACOSX files
            if (
                item.path.includes("__MACOSX")
            ) {

                continue;

            }


            const filename =
                item.path.split("/").pop()
                    .split("\\").pop();


            // skip hidden files
            if (
                filename.startsWith(".")
            ) {

                continue;

            }


            // Progress: entri ini sedang diproses.
            processed += 1;

            advanceBulkProgress(
                adminKey,
                {
                    total: totalEntries,
                    processed,
                    counters: {
                        success,
                        failed,
                        skipped
                    }
                }
            );


            totalUncompressed +=
                item.uncompressedSize || 0;


            if (
                totalUncompressed >
                MAX_UNCOMPRESSED
            ) {

                throw Object.assign(
                    new Error(
                        "ZIP contents are too large"
                    ),
                    {
                        status: 400
                    }
                );

            }


            const extension =
                (
                    filename.match(/\.[0-9a-z]+$/i) ||
                    [""]
                )[0].toLowerCase();


            if (
                ![
                    ".jpg",
                    ".jpeg",
                    ".png",
                    ".webp"
                ].includes(extension)
            ) {

                failed.push({

                    file: filename,

                    reason:
                        "Unsupported image format"

                });

                continue;

            }


            // -------------------------------------------------
            // PARSE FILENAME
            //
            // BEBAS_0001.jpg
            // KUNCIR_0001.jpg
            // IJAZAH_0001.jpg
            // -------------------------------------------------

            const cleanName =
                filename.slice(
                    0,
                    filename.length - extension.length
                );


            const match =
                cleanName.match(
                    /^(BEBAS|KUNCIR|IJAZAH)_(\d{4})$/i
                );


            if (!match) {

                failed.push({

                    file: filename,

                    reason:
                        "Invalid filename. Example: BEBAS_0001.jpg"

                });

                continue;

            }


            const type =
                match[1]
                    .toUpperCase();


            // IMPORTANT:
            // 0001 tetap 0001
            // 0192 tetap 0192

            const graduationNumber =
                match[2];


            // -------------------------------------------------
            // DEDUPLIKASI: satu graduate hanya boleh punya satu
            // foto per type dalam satu proses upload.
            // -------------------------------------------------

            const dedupKey =
                `${graduationNumber}|${type}`;

            if (seenInZip.has(dedupKey)) {

                skipped.push({

                    file: filename,

                    reason:
                        `Duplicate in ZIP: ${type} ${graduationNumber} already included`

                });

                continue;

            }


            // -------------------------------------------------
            // FIND GRADUATE
            //
            // MATCH:
            // EVENT + FACULTY + GRADUATION NUMBER
            // -------------------------------------------------

            const graduate =
                await client.query(
                    `
                    SELECT
                        id,
                        graduation_number,
                        name,
                        faculty,
                        study_program
                    FROM graduates
                    WHERE event_id = $1
                    AND LOWER(TRIM(faculty))
                        = LOWER(TRIM($2))
                    AND TRIM(graduation_number)
                        = $3
                    LIMIT 1
                    `,
                    [
                        event_id,
                        faculty,
                        graduationNumber
                    ]
                );


            // -------------------------------------------------
            // GRADUATE NOT FOUND
            // -------------------------------------------------

            if (
                !graduate.rows.length
            ) {

                failed.push({

                    file: filename,

                    reason:
                        `Graduate not found: event=${event_id}, faculty=${faculty}, number=${graduationNumber}`

                });

                continue;

            }


            const graduateId =
                graduate.rows[0].id;


            // -------------------------------------------------
            // CEK DUPLIKAT DI DATABASE
            //
            // Foto dengan graduate + type yang sama sudah ada.
            // -------------------------------------------------

            const existing =
                await client.query(
                    `
                    SELECT id
                    FROM photos
                    WHERE graduate_id = $1
                    AND UPPER(TRIM(type)) = $2
                    LIMIT 1
                    `,
                    [
                        graduateId,
                        type
                    ]
                );


            if (existing.rows.length) {

                skipped.push({

                    file: filename,

                    graduate:
                        graduate.rows[0].name,

                    reason:
                        `${type} photo already exists for this graduate`

                });

                continue;

            }


            // -------------------------------------------------
            // UPLOAD KE OBJECT STORAGE
            // -------------------------------------------------

            const buffer =
                await item.buffer();


            const mimetype =
                extension === ".png"
                    ? "image/png"
                    : extension === ".webp"
                        ? "image/webp"
                        : "image/jpeg";


            const url =
                `photos/${graduateId}/${type}/${crypto.randomUUID()}${extension}`;


            await uploadObject(
                url,
                buffer,
                mimetype
            );


            uploadedKeys.push(url);


            // -------------------------------------------------
            // INSERT PHOTO
            // -------------------------------------------------

            const photoResult =
                await client.query(
                    `
                    INSERT INTO photos
                    (
                        graduate_id,
                        type,
                        url,
                        filename,
                        size
                    )
                    VALUES ($1,$2,$3,$4,$5)
                    RETURNING *
                    `,
                    [
                        graduateId,
                        type,
                        url,
                        filename,
                        buffer.length
                    ]
                );


            success.push({

                file:
                    filename,

                graduate_id:
                    graduateId,

                graduate:
                    graduate.rows[0].name,

                graduation_number:
                    graduate.rows[0]
                        .graduation_number,

                faculty:
                    graduate.rows[0]
                        .faculty,

                type,

                photo:
                    photoResult.rows[0]

            });


            seenInZip.add(dedupKey);

        }


        await client.query("COMMIT");


        finishBulkProgress(
            adminKey,
            {
                total: totalEntries,
                success_count: success.length,
                failed_count: failed.length,
                skipped_count: skipped.length
            }
        );


        } catch (transactionError) {


            await client.query("ROLLBACK");


            failBulkProgress(
                adminKey,
                transactionError.message
            );


            // Hapus objek S3 yang sudah terlanjur diunggah,
            // karena baris database-nya dibatalkan.
            console.warn(
                "BULK ROLLBACK: compensating",
                uploadedKeys.length,
                "uploaded object(s)"
            );

            for (const key of uploadedKeys) {

                await deleteObjectSafe(key);

            }


            throw transactionError;


        } finally {


            client.release();


        }


        // -------------------------------------------------
        // RESULT
        // -------------------------------------------------

        console.log(
            "BULK SUCCESS:",
            success.length
        );


        console.log(
            "BULK FAILED:",
            failed.length
        );


        console.log(
            "BULK SKIPPED:",
            skipped.length
        );


        return res.json({

            message:
                "Bulk upload completed",

            total:
                success.length +
                failed.length +
                skipped.length,

            success_count:
                success.length,

            failed_count:
                failed.length,

            skipped_count:
                skipped.length,

            success,

            failed,

            skipped

        });


    } catch (error) {

        console.error(
            "BULK UPLOAD ERROR:",
            error
        );


        failBulkProgress(
            adminKey,
            error.message
        );


        return res.status(error.status || 500).json({

            message:
                error.status
                    ? error.message
                    : "Internal server error"

        });

    } finally {

        // File ZIP sementara selalu dihapus, baik sukses maupun gagal,
        // supaya tidak menumpuk sampah di disk.
        await removeFileSafe(tempPath);

        activeBulkUploads.delete(adminKey);

    }

};


// =====================================================
// BULK UPLOAD STATUS
//
// Dipakai frontend untuk memantau fase pemrosesan
// setelah byte ZIP selesai terkirim.
// =====================================================

const getBulkUploadStatus = (req, res) => {

    const adminKey =
        req.admin && req.admin.id != null
            ? String(req.admin.id)
            : "unknown";

    const job = getBulkProgress(adminKey);

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

    getPhotos,
    uploadPhoto,
    bulkUpload,
    getBulkUploadStatus,
    deletePhoto

};