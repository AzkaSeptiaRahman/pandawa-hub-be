const crypto = require("crypto");

const multer = require("multer");

const db = require("../config/database");

const {
    uploadObject
} = require("../config/s3");

const ALLOWED_TYPES = [

    "BEBAS",

    "KUNCIR",

    "IJAZAH"

];

const ALLOWED_MIMETYPES = [

    "image/jpeg",

    "image/png",

    "image/webp"

];

// File ditampung di memory lalu diupload ke object storage

const upload = multer({

    storage: multer.memoryStorage(),

    limits: {

        fileSize: 10 * 1024 * 1024, // 10 MB per file

        files: 20

    },

    fileFilter: (
        req,
        file,
        cb
    )=>{

        if(!ALLOWED_MIMETYPES.includes(
            file.mimetype
        )){

            return cb(
                new Error("Only JPEG, PNG, and WebP images are allowed")
            );

        }

        cb(
            null,
            true
        );

    }

});

const uploadPhotos = async(
    req,
    res
)=>{

    try {

        const files = req.files || [];

        const {
            graduateId,
            type
        } = req.body;

        // Validasi input

        if(files.length === 0){

            return res.status(400).json({

                message:"No files uploaded"

            });

        }

        if(!graduateId || !type){

            return res.status(400).json({

                message:"graduateId and type are required"

            });

        }

        if(!ALLOWED_TYPES.includes(
            type
        )){

            return res.status(400).json({

                message:`type must be one of: ${ALLOWED_TYPES.join(", ")}`

            });

        }

        // Pastikan mahasiswa ada

        const graduate = await db.query(

            `
            SELECT id
            FROM graduates
            WHERE id = $1
            `,

            [
                graduateId
            ]

        );

        if(graduate.rows.length === 0){

            return res.status(404).json({

                message:"Graduate not found"

            });

        }

        // Upload tiap file ke S3 lalu simpan ke database

        const saved = [];

        for(const file of files){

            const ext = (
                file.originalname
                .match(/\.[0-9a-z]+$/i) || [".jpg"]
            )[0].toLowerCase();

            const key = `photos/${graduateId}/${type}/${crypto.randomUUID()}${ext}`;

            await uploadObject(
                key,
                file.buffer,
                file.mimetype
            );

            const result = await db.query(

                `
                INSERT INTO photos (graduate_id, type, url)
                VALUES ($1, $2, $3)
                RETURNING *
                `,

                [
                    graduateId,

                    type,

                    key
                ]

            );

            saved.push(
                result.rows[0]
            );

        }

        res.status(201).json({

            message:"Upload success",

            photos: saved

        });

    }catch(error){

        console.error(
            error
        );

        res.status(500).json({

            message:error.message

        });

    }

};

module.exports = {

    upload,

    uploadPhotos

};
