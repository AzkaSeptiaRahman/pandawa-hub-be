const db = require("../config/database");





// GET ALL EVENTS

const getEvents = async(req,res)=>{


    try{


        const result = await db.query(

            `
            SELECT *

            FROM events

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









// CREATE EVENT


const createEvent = async(req,res)=>{


    try{


        const {

            name,

            title,

            date,

            type,

            thumbnail,

            description


        } = req.body || {};






        if(

            !name ||

            !title ||

            !date ||

            !type

        ){


            return res.status(400).json({

                message:
                "Complete event data required"

            });


        }







        const result = await db.query(

            `
            INSERT INTO events

            (

                name,

                title,

                date,

                type,

                thumbnail,

                description

            )


            VALUES

            ($1,$2,$3,$4,$5,$6)


            RETURNING *

            `,


            [

                name,

                title,

                date,

                type,

                thumbnail || null,

                description || null

            ]

        );







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









// DELETE EVENT


const deleteEvent = async(req,res)=>{


    const {
        id
    } = req.params;




    try{


        const result = await db.query(

            `
            DELETE FROM events

            WHERE id=$1

            RETURNING *

            `,


            [
                id
            ]

        );






        if(result.rows.length === 0){


            return res.status(404).json({

                message:
                "Event not found"

            });


        }







        res.json({

            message:
            "Event deleted",

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









module.exports = {

    getEvents,

    createEvent,

    deleteEvent

};