const db = require("../config/database");




// ==========================================
// GET ALL EVENTS CLIENT
// ==========================================

const getEvents = async(req,res)=>{


    try{


        const result = await db.query(

`
SELECT *

FROM events

WHERE status='active'

ORDER BY created_at DESC
`

        );



        res.json({

            events: result.rows

        });



    }catch(error){


        console.error(error);


        res.status(500).json({

            message:error.message

        });


    }


};








// ==========================================
// GET EVENT DETAIL
// ==========================================

const getEventDetail = async(req,res)=>{


    const {
        id
    } = req.params;




    try{


        const event = await db.query(

`
SELECT *

FROM events

WHERE id=$1

`,

        [
            id
        ]

        );





        if(event.rows.length===0){


            return res.status(404).json({

                message:"Event not found"

            });


        }







        const media = await db.query(

`
SELECT *

FROM event_media

WHERE event_id=$1

ORDER BY id ASC

`,

        [
            id
        ]

        );








        res.json({

            ...event.rows[0],

            media:media.rows

        });





    }catch(error){



        console.error(error);



        res.status(500).json({

            message:error.message

        });


    }


};











// ==========================================
// ADMIN GET EVENTS
// ==========================================

const getAdminEvents = async(req,res)=>{


    try{


        const result = await db.query(

`
SELECT *

FROM events

ORDER BY created_at DESC

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
// CREATE EVENT
// ==========================================

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





        let thumbnail=null;





        if(req.file){


            thumbnail =
            `/uploads/events/${req.file.filename}`;


        }









        const result = await db.query(

`
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

($1,$2,$3,$4,$5,$6,$7,$8)

RETURNING *

`,

        [

            name,

            name,

            date,

            thumbnail,

            type,

            slug,

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
// DELETE EVENT
// ==========================================

const deleteEvent = async(req,res)=>{


    try{


        const {
            id
        } = req.params;





        await db.query(

`
DELETE FROM events

WHERE id=$1

`,

        [
            id
        ]

        );






        res.json({

            message:"Event deleted"

        });




    }catch(error){


        console.error(error);



        res.status(500).json({

            message:error.message

        });



    }


};










module.exports={


    getEvents,

    getEventDetail,

    getAdminEvents,

    createEvent,

    deleteEvent


};