const db = require("../config/database");


const getEventDetail = async(req,res)=>{


    const { id } = req.params;


    try {


        const event = await db.query(
            `
            SELECT *
            FROM events
            WHERE id = $1
            `,
            [id]
        );



        if(event.rows.length === 0){

            return res.status(404).json({
                message:"Event not found"
            });

        }





        const media = await db.query(
            `
            SELECT *
            FROM event_media
            WHERE event_id = $1
            `,
            [id]
        );





        res.json({

            ...event.rows[0],

            media: media.rows

        });



    }catch(error){


        res.status(500).json({
            message:error.message
        });


    }


};



module.exports = {
    getEventDetail
};