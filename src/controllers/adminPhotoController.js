const db = require("../config/database");
const fs = require("fs");
const path = require("path");
const unzipper = require("unzipper");


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
            `/uploads/photos/${req.file.filename}`;


        const result = await db.query(
            `
            INSERT INTO photos
            (
                graduate_id,
                type,
                url
            )
            VALUES ($1,$2,$3)
            RETURNING *
            `,
            [
                graduate_id,
                photoType,
                url
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
            message: error.message
        });

    }

};



// =====================================================
// BULK PHOTO UPLOAD
// =====================================================

const bulkUpload = async (req, res) => {

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
        // OPEN ZIP
        // -------------------------------------------------

        const zip =
            await unzipper.Open.file(
                req.file.path
            );


        const uploadFolder =
            path.join(
                "uploads",
                "photos"
            );


        if (
            !fs.existsSync(uploadFolder)
        ) {

            fs.mkdirSync(
                uploadFolder,
                {
                    recursive: true
                }
            );

        }


        const success = [];
        const failed = [];


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
                path.basename(item.path);


            // skip hidden files
            if (
                filename.startsWith(".")
            ) {

                continue;

            }


            const extension =
                path.extname(filename)
                    .toLowerCase();


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
                path.basename(
                    filename,
                    extension
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


            console.log({

                event_id:
                    String(event_id),

                faculty:
                    String(faculty),

                graduationNumber

            });


            // -------------------------------------------------
            // FIND GRADUATE
            //
            // MATCH:
            // EVENT + FACULTY + GRADUATION NUMBER
            // -------------------------------------------------

            const graduate =
                await db.query(
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
            // CREATE UNIQUE FILENAME
            // -------------------------------------------------

            const safeFilename =
                filename.replace(
                    /[^a-zA-Z0-9._-]/g,
                    "_"
                );


            const saveName =
                `${Date.now()}-${graduateId}-${safeFilename}`;


            const savePath =
                path.join(
                    uploadFolder,
                    saveName
                );


            // -------------------------------------------------
            // SAVE FILE
            // -------------------------------------------------

            await new Promise(
                (resolve, reject) => {

                    item
                        .stream()
                        .pipe(
                            fs.createWriteStream(
                                savePath
                            )
                        )
                        .on(
                            "finish",
                            resolve
                        )
                        .on(
                            "error",
                            reject
                        );

                }
            );


            const url =
                `/uploads/photos/${saveName}`;


            // -------------------------------------------------
            // INSERT PHOTO
            // -------------------------------------------------

            const photoResult =
                await db.query(
                    `
                    INSERT INTO photos
                    (
                        graduate_id,
                        type,
                        url
                    )
                    VALUES ($1,$2,$3)
                    RETURNING *
                    `,
                    [
                        graduateId,
                        type,
                        url
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

        }


        // -------------------------------------------------
        // DELETE TEMP ZIP
        // -------------------------------------------------

        try {

            if (
                req.file.path &&
                fs.existsSync(req.file.path)
            ) {

                fs.unlinkSync(
                    req.file.path
                );

            }

        } catch (cleanupError) {

            console.error(
                "ZIP CLEANUP ERROR:",
                cleanupError
            );

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


        return res.json({

            message:
                "Bulk upload completed",

            total:
                success.length +
                failed.length,

            success_count:
                success.length,

            failed_count:
                failed.length,

            success,

            failed

        });


    } catch (error) {

        console.error(
            "BULK UPLOAD ERROR:",
            error
        );


        return res.status(500).json({

            message:
                error.message

        });

    }

};


module.exports = {

    uploadPhoto,
    bulkUpload

};