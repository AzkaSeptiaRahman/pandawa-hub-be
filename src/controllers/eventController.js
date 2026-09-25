const db = require("../config/database");

const {
    resolveObjectUrl
} = require("../config/s3");




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



        const events = await Promise.all(

            result.rows.map(

                async(event)=>({

                    ...event,

                    thumbnail: await resolveObjectUrl(
                        event.thumbnail
                    )

                })

            )

        );



        res.json({

            events

        });



    }catch(error){


        console.error(error);


        res.status(500).json({

            message:"Internal server error"

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

            thumbnail: await resolveObjectUrl(

                event.rows[0].thumbnail

            ),

            media: await Promise.all(

                media.rows.map(

                    async(item)=>({

                        ...item,

                        url: await resolveObjectUrl(
                            item.url
                        )

                    })

                )

            )

        });





    }catch(error){



        console.error(error);



        res.status(500).json({

            message:"Internal server error"

        });


    }


};





module.exports={


    getEvents,

    getEventDetail


};
