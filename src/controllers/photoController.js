const db = require("../config/database");


// =====================================================
// GET SEARCH OPTIONS
// =====================================================

const getPhotoOptions = async (req, res) => {

    try {

        const { eventId } = req.query;


        if (!eventId) {

            return res.status(400).json({
                message: "Event ID required"
            });

        }


        // Pastikan event ada dan PERSONAL
        const event = await db.query(
            `
            SELECT
                id,
                name,
                type
            FROM events
            WHERE id = $1
            AND status = 'active'
            `,
            [eventId]
        );


        if (event.rows.length === 0) {

            return res.status(404).json({
                message: "Event not found"
            });

        }


        if (event.rows[0].type !== "PERSONAL") {

            return res.status(400).json({
                message: "This event is not a PERSONAL event"
            });

        }


        // Ambil fakultas + prodi dari graduates event tersebut
        const result = await db.query(
            `
            SELECT DISTINCT
                TRIM(faculty) AS faculty,
                TRIM(study_program) AS study_program
            FROM graduates
            WHERE event_id = $1
            AND faculty IS NOT NULL
            AND study_program IS NOT NULL
            ORDER BY
                faculty ASC,
                study_program ASC
            `,
            [eventId]
        );


        return res.json({

            event: event.rows[0],

            options: result.rows

        });


    } catch (error) {

        console.error(
            "GET PHOTO OPTIONS ERROR:",
            error
        );


        return res.status(500).json({
            message: error.message
        });

    }

};



// =====================================================
// SEARCH PHOTO
// =====================================================

const searchPhoto = async (req, res) => {

    try {

        const {
            eventId,
            graduationNumber,
            faculty,
            studyProgram
        } = req.body;


        // -------------------------------------------------
        // VALIDATION
        // -------------------------------------------------

        if (
            !eventId ||
            !graduationNumber ||
            !faculty ||
            !studyProgram
        ) {

            return res.status(400).json({
                message: "Please complete all required fields"
            });

        }


        // -------------------------------------------------
        // CHECK EVENT
        // -------------------------------------------------

        const event = await db.query(
            `
            SELECT
                id,
                name,
                type
            FROM events
            WHERE id = $1
            AND status = 'active'
            `,
            [eventId]
        );


        if (event.rows.length === 0) {

            return res.status(404).json({
                message: "Event not found"
            });

        }


        if (event.rows[0].type !== "PERSONAL") {

            return res.status(400).json({
                message: "This event does not support personal photo search"
            });

        }


        // -------------------------------------------------
        // FIND GRADUATE
        //
        // event
        // + graduation number
        // + faculty
        // + study program
        // -------------------------------------------------

        const graduate = await db.query(
            `
            SELECT *
            FROM graduates
            WHERE event_id = $1
            AND TRIM(graduation_number) = TRIM($2)
            AND LOWER(TRIM(faculty)) = LOWER(TRIM($3))
            AND LOWER(TRIM(study_program)) = LOWER(TRIM($4))
            LIMIT 1
            `,
            [
                eventId,
                graduationNumber,
                faculty,
                studyProgram
            ]
        );


        if (graduate.rows.length === 0) {

            return res.status(404).json({
                message: "Graduate not found"
            });

        }


        const student = graduate.rows[0];


        // -------------------------------------------------
        // GET PHOTOS
        // -------------------------------------------------

        const photos = await db.query(
            `
            SELECT *
            FROM photos
            WHERE graduate_id = $1
            ORDER BY id ASC
            `,
            [student.id]
        );


        // -------------------------------------------------
        // GROUP PHOTOS
        // -------------------------------------------------

        const groupedPhotos = {

            BEBAS: [],

            KUNCIR: [],

            IJAZAH: []

        };


        photos.rows.forEach((photo) => {

            const type =
                String(photo.type)
                    .toUpperCase()
                    .trim();


            if (groupedPhotos[type]) {

                groupedPhotos[type].push(photo);

            }

        });


        // -------------------------------------------------
        // RESPONSE
        // -------------------------------------------------

        return res.json({

            event: event.rows[0],

            student,

            photos: groupedPhotos

        });


    } catch (error) {

        console.error(
            "SEARCH PHOTO ERROR:",
            error
        );


        return res.status(500).json({
            message: error.message
        });

    }

};



module.exports = {

    getPhotoOptions,

    searchPhoto

};