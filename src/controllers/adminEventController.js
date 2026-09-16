const db = require("../config/database");





// ==========================================
// GET ALL EVENTS
// ==========================================

const getEvents = async(req,res)=>{

    try{

        const result = await db.query(

            `
            SELECT *
            FROM events
            ORDER BY id DESC
            `

        );


        res.json({

            events:result.rows

        });


    }catch(error){

        console.error(error);

        res.status(500).json({

            message:error.message

        });

    }

};









// ==========================================
// EVENT OPTIONS
// ==========================================

const getEventOptions = async(req,res)=>{

    try{


        const result = await db.query(

            `
            SELECT
                id,
                name,
                type
            FROM events
            WHERE status='active'
            ORDER BY id DESC
            `

        );



        res.json(result.rows);



    }catch(error){


        res.status(500).json({

            message:error.message

        });


    }

};









// ==========================================
// CREATE EVENT
// ==========================================

const createEvent = async(req,res)=>{


    const {

        name,

        slug,

        date,

        type,

        description,

        status


    } = req.body;



    let thumbnail = null;



    if(req.file){

        thumbnail =
        "/uploads/events/" + req.file.filename;

    }




    try{


        const result = await db.query(

            `
            INSERT INTO events

            (
                name,
                title,
                slug,
                date,
                type,
                thumbnail,
                description,
                status
            )


            VALUES

            ($1,$2,$3,$4,$5,$6,$7,$8)

            RETURNING *

            `,

            [

                name,

                name,

                slug,

                date,

                type,

                thumbnail,

                description,

                status

            ]

        );




        res.json({

            message:"Event created",

            event:result.rows[0]

        });



    }catch(error){


        console.error(error);


        res.status(500).json({

            message:error.message

        });


    }


};









// ==========================================
// UPDATE EVENT + THUMBNAIL
// ==========================================

const updateEvent = async(req,res)=>{


    const {

        id

    } = req.params;





    const {

        name,

        title,

        date,

        description


    } = req.body;





    let thumbnail = null;





    if(req.file){


        thumbnail =

        "/uploads/events/" +

        req.file.filename;


    }









    try{



        const result = await db.query(


            `
            UPDATE events

            SET

                name=$1,

                title=$2,

                date=$3,

                description=$4,

                thumbnail=

                COALESCE($5,thumbnail)


            WHERE id=$6


            RETURNING *

            `,



            [

                name,

                title,

                date,

                description,

                thumbnail,

                id

            ]


        );





        if(result.rows.length===0){


            return res.status(404).json({

                message:"Event not found"

            });


        }






        res.json({

            message:"Event updated",

            event:result.rows[0]

        });




    }catch(error){


        console.error(error);



        res.status(500).json({

            message:error.message

        });


    }


};









// ==========================================
// DELETE EVENT
// ==========================================

const deleteEvent = async(req,res)=>{


    const {id}=req.params;


    try{


        await db.query(

            `
            DELETE FROM events

            WHERE id=$1

            `,

            [id]

        );



        res.json({

            message:"Event deleted"

        });



    }catch(error){


        res.status(500).json({

            message:error.message

        });


    }


};









// ==========================================
// UPLOAD GALLERY
// ==========================================

const uploadGallery = async(req,res)=>{


    const {

        event_id


    } = req.body;





    try{


        const files = req.files || [];



        let uploaded=[];





        for(const file of files){


            const url =

            "/uploads/events/gallery/" +

            file.filename;





            const result = await db.query(

                `
                INSERT INTO event_media

                (

                    event_id,

                    type,

                    title,

                    url

                )


                VALUES

                ($1,$2,$3,$4)

                RETURNING *

                `,

                [

                    event_id,

                    "gallery",

                    "Gallery Photo",

                    url

                ]

            );




            uploaded.push(

                result.rows[0]

            );


        }







        res.json({

            message:"Gallery uploaded",

            data:uploaded

        });





    }catch(error){


        console.error(error);



        res.status(500).json({

            message:error.message

        });


    }


};









// ==========================================
// ADD HIGHLIGHT
// ==========================================

const addHighlight = async(req,res)=>{


    const {

        event_id,

        title,

        url


    } = req.body;






    try{


        const result = await db.query(

            `
            INSERT INTO event_media

            (

                event_id,

                type,

                title,

                url

            )


            VALUES

            ($1,$2,$3,$4)


            RETURNING *

            `,


            [

                event_id,

                "highlight",

                title,

                url

            ]


        );





        res.json({

            message:"Highlight added",

            data:result.rows[0]

        });





    }catch(error){


        console.error(error);



        res.status(500).json({

            message:error.message

        });


    }


};









// ==========================================
// DELETE MEDIA
// ==========================================

const deleteMedia = async(req,res)=>{


    const {

        id

    } = req.params;



    try{


        await db.query(

            `
            DELETE FROM event_media

            WHERE id=$1

            `,

            [

                id

            ]

        );





        res.json({

            message:"Media deleted"

        });





    }catch(error){


        res.status(500).json({

            message:error.message

        });


    }


};









module.exports = {


    getEvents,

    getEventOptions,

    createEvent,

    updateEvent,

    deleteEvent,

    uploadGallery,

    addHighlight,

    deleteMedia


};