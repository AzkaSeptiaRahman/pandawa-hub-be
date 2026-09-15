const db = require("../config/database");




// ===============================
// UPLOAD PHOTO
// ===============================

const uploadPhoto = async(req,res)=>{


    console.log("=== PHOTO UPLOAD DEBUG ===");

    console.log(
        "BODY:",
        req.body
    );

    console.log(
        "FILE:",
        req.file
    );



    try{


        const {

            graduate_id,

            type

        } = req.body || {};





        if(

            !graduate_id ||

            !type ||

            !req.file

        ){

            return res.status(400).json({

                message:
                "Graduate, type and file required"

            });

        }







        const url =

        `/uploads/photos/${req.file.filename}`;







        const result = await db.query(

            `
            INSERT INTO photos

            (

                graduate_id,

                url,

                type,

                filename

            )


            VALUES

            ($1,$2,$3,$4)


            RETURNING *

            `,


            [

                graduate_id,

                url,

                type,

                req.file.filename

            ]

        );







        res.status(201).json({

            message:
            "Photo uploaded",

            photo:
            result.rows[0]

        });







    }catch(error){


        console.error(error);


        res.status(500).json({

            message:
            error.message

        });


    }


};









// ===============================
// GET PHOTOS BY GRADUATE
// ===============================

const getGraduatePhotos = async(req,res)=>{


    const {

        graduateId

    } = req.params;




    try{


        const result = await db.query(

            `
            SELECT *

            FROM photos

            WHERE graduate_id=$1

            ORDER BY created_at DESC

            `,

            [

                graduateId

            ]

        );







        const photos = {


            BEBAS:[],

            KUNCIR:[],

            IJAZAH:[]


        };






        result.rows.forEach(photo=>{


            if(
                photos[photo.type]
            ){

                photos[photo.type].push(photo);

            }


        });







        res.json(photos);






    }catch(error){


        console.error(error);


        res.status(500).json({

            message:
            error.message

        });


    }


};









// ===============================
// DELETE PHOTO
// ===============================

const deletePhoto = async(req,res)=>{


    const {

        id

    } = req.params;





    try{


        const result = await db.query(

            `
            DELETE FROM photos

            WHERE id=$1

            RETURNING *

            `,

            [

                id

            ]

        );







        if(result.rows.length===0){


            return res.status(404).json({

                message:
                "Photo not found"

            });


        }








        res.json({

            message:
            "Photo deleted",

            photo:
            result.rows[0]

        });







    }catch(error){


        console.error(error);


        res.status(500).json({

            message:
            error.message

        });


    }


};









module.exports = {


    uploadPhoto,

    getGraduatePhotos,

    deletePhoto


};