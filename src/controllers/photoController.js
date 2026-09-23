const db = require("../config/database");

const {
    getPhotoUrl
} = require("../config/s3");

const searchPhoto = async(req,res)=>{

    const {
        eventId,
        graduationNumber,
        faculty,
        studyProgram
    } = req.body;

    try {

        const graduate = await db.query(

            `
            SELECT *
            FROM graduates
            WHERE event_id = $1
            AND graduation_number = $2
            AND faculty = $3
            AND study_program = $4
            `,

            [
                eventId,
                graduationNumber,
                faculty,
                studyProgram
            ]

        );

        if(graduate.rows.length === 0){

            return res.status(404).json({

                message:"Graduate not found"

            });

        }

        const photos = await db.query(

            `
            SELECT *
            FROM photos
            WHERE graduate_id = $1
            ORDER BY id ASC
            `,

            [
                graduate.rows[0].id
            ]

        );

        const groupedPhotos = {

            BEBAS: [],

            KUNCIR: [],

            IJAZAH: []

        };

        // Kolom "url" menyimpan object key di S3,
        // ubah ke URL yang bisa diakses (presigned / public)

        for(const photo of photos.rows){

            if(groupedPhotos[photo.type]){

                groupedPhotos[photo.type].push({

                    ...photo,

                    url: await getPhotoUrl(
                        photo.url
                    )

                });

            }

        }

        res.json({

            student: graduate.rows[0],

            photos: groupedPhotos

        });

    } catch(error){

        res.status(500).json({

            message:error.message

        });

    }

};

module.exports = {

    searchPhoto

};
