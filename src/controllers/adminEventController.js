const db = require("../config/database");




// ==============================
// GET EVENTS
// ==============================

const getEvents = async(req,res)=>{


    try{


        const result =
        await db.query(`

            SELECT *

            FROM events

            ORDER BY id DESC

        `);



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








// ==============================
// EVENT OPTIONS
// ==============================

const getEventOptions = async(req,res)=>{


    try{


        const result =
        await db.query(`

            SELECT

                id,

                name,

                type

            FROM events

            WHERE status='active'

            ORDER BY id DESC

        `);



        res.json(
            result.rows
        );



    }catch(error){


        res.status(500).json({

            message:error.message

        });


    }


};









// ==============================
// CREATE EVENT
// ==============================

const createEvent = async(req,res)=>{


    try{


        const {


            name,

            slug,

            date,

            type,

            description,

            status


        } = req.body;







        if(

            !name ||

            !slug ||

            !type

        ){

            return res.status(400).json({

                message:
                "Name slug type required"

            });

        }








        if(

            type !== "PERSONAL" &&

            type !== "GALLERY"

        ){

            return res.status(400).json({

                message:
                "Invalid event type"

            });

        }







        let thumbnail=null;



        if(req.file){


            thumbnail =
            "/uploads/events/" +
            req.file.filename;


        }








        const check =
        await db.query(`

            SELECT id

            FROM events

            WHERE slug=$1

        `,[

            slug

        ]);








        if(check.rows.length){


            return res.status(400).json({

                message:
                "Slug already exists"

            });


        }









        const result =
        await db.query(`


            INSERT INTO events

            (

                name,

                title,

                date,

                thumbnail,

                type,

                slug,

                description,

                status

            )


            VALUES

            (

                $1,

                $2,

                $3,

                $4,

                $5,

                $6,

                $7,

                $8

            )


            RETURNING *


        `,[



            name,

            name,

            date || null,

            thumbnail,

            type,

            slug,

            description || null,

            status || "active"



        ]);









        res.status(201).json({

            message:
            "Event created",

            event:
            result.rows[0]

        });








    }catch(error){


        console.error(error);


        res.status(500).json({

            message:error.message

        });


    }


};









// ==============================
// UPDATE EVENT
// ==============================

const updateEvent = async(req,res)=>{


    const {

        id

    } = req.params;




    try{


        const {


            name,

            slug,

            date,

            type,

            description,

            status


        } = req.body;





        let thumbnail;


        if(req.file){


            thumbnail =
            "/uploads/events/" +
            req.file.filename;


        }







        const result =
        await db.query(`


            UPDATE events

            SET


                name=$1,

                title=$2,

                date=$3,

                thumbnail=
                COALESCE($4,thumbnail),

                type=$5,

                slug=$6,

                description=$7,

                status=$8



            WHERE id=$9


            RETURNING *



        `,[


            name,

            name,

            date || null,

            thumbnail,

            type,

            slug,

            description || null,

            status || "active",

            id


        ]);









        res.json({

            message:
            "Event updated",

            event:
            result.rows[0]

        });





    }catch(error){


        console.error(error);


        res.status(500).json({

            message:error.message

        });


    }


};









// ==============================
// DELETE EVENT
// ==============================

const deleteEvent = async(req,res)=>{


    try{


        const result =
        await db.query(`

            DELETE FROM events

            WHERE id=$1

            RETURNING *

        `,[

            req.params.id

        ]);





        res.json({

            message:
            "Event deleted",

            event:
            result.rows[0]

        });





    }catch(error){


        res.status(500).json({

            message:error.message

        });


    }


};







module.exports={


    getEvents,

    getEventOptions,

    createEvent,

    updateEvent,

    deleteEvent


};