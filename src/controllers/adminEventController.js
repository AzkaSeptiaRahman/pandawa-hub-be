const db = require("../config/database");
const crypto = require("crypto");

const {
    uploadObject,
    deleteObjectSafe,
    resolveObjectUrl
} = require("../config/s3");

const {
    extensionOf
} = require("../config/upload");





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

            message:"Internal server error"

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
        `events/${crypto.randomUUID()}${extensionOf(req.file.originalname)}`;

        await uploadObject(
            thumbnail,
            req.file.buffer,
            req.file.mimetype
        );

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

            message:"Internal server error"

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

        slug,

        type,

        status,

        description


    } = req.body;





    let thumbnail = null;





    if(req.file){


        thumbnail =

        `events/${crypto.randomUUID()}${extensionOf(req.file.originalname)}`;


        await uploadObject(

            thumbnail,

            req.file.buffer,

            req.file.mimetype

        );


    }









    try{



        // Thumbnail lama diambil dulu supaya objeknya bisa
        // dibersihkan dari storage setelah penggantian berhasil.
        const previous = await db.query(

            `
            SELECT thumbnail
            FROM events
            WHERE id=$1
            `,

            [

                id

            ]

        );



        const result = await db.query(


            `
            UPDATE events

            SET

                name=COALESCE($1,name),

                title=COALESCE($2,title),

                date=COALESCE($3,date),

                description=COALESCE($4,description),

                slug=COALESCE($7,slug),

                type=COALESCE($8,type),

                status=COALESCE($9,status),

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

                id,

                slug || null,

                type || null,

                status || null

            ]


        );





        if(result.rows.length===0){


            // Event tidak ada: thumbnail yang barusan diunggah
            // dibatalkan supaya tidak jadi objek yatim.
            if(thumbnail){

                await deleteObjectSafe(thumbnail);

            }


            return res.status(404).json({

                message:"Event not found"

            });


        }





        // Ganti thumbnail: hapus objek lama yang sudah tidak dipakai.
        if(
            thumbnail &&
            previous.rows.length &&
            previous.rows[0].thumbnail &&
            previous.rows[0].thumbnail !== thumbnail
        ){

            await deleteObjectSafe(
                previous.rows[0].thumbnail
            );

        }





        res.json({

            message:"Event updated",

            event:result.rows[0]

        });




    }catch(error){


        console.error(error);


        // Update gagal: jangan tinggalkan thumbnail baru di storage.
        if(thumbnail){

            await deleteObjectSafe(thumbnail);

        }



        res.status(500).json({

            message:"Internal server error"

        });


    }


};









// ==========================================
// DELETE EVENT
// ==========================================

const deleteEvent = async(req,res)=>{


    const {id}=req.params;


    try{


        // Kumpulkan object yang harus dihapus dari storage
        const media = await db.query(

            `
            SELECT url
            FROM event_media
            WHERE event_id=$1
            `,

            [id]

        );


        const event = await db.query(

            `
            SELECT thumbnail
            FROM events
            WHERE id=$1
            `,

            [id]

        );


        await db.query(

            `
            DELETE FROM events

            WHERE id=$1

            `,

            [id]

        );



        // Hapus object setelah row terhapus (best effort)
        const keys = [

            ...media.rows.map(
                (row)=>row.url
            ),

            event.rows.length
                ? event.rows[0].thumbnail
                : null

        ].filter(Boolean);


        for(const key of keys){

            await deleteObjectSafe(
                key
            );

        }



        res.json({

            message:"Event deleted"

        });



    }catch(error){


        res.status(500).json({

            message:"Internal server error"

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

            `events/gallery/${crypto.randomUUID()}${extensionOf(file.originalname)}`;


            await uploadObject(

                url,

                file.buffer,

                file.mimetype

            );





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

            message:"Internal server error"

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

            message:"Internal server error"

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


        // Ambil dulu agar object storage bisa dibersihkan
        const existing = await db.query(

            `
            SELECT url
            FROM event_media
            WHERE id=$1
            `,

            [

                id

            ]

        );



        await db.query(

            `
            DELETE FROM event_media

            WHERE id=$1

            `,

            [

                id

            ]

        );



        if(existing.rows.length){

            await deleteObjectSafe(

                existing.rows[0].url

            );

        }





        res.json({

            message:"Media deleted"

        });





    }catch(error){


        res.status(500).json({

            message:"Internal server error"

        });


    }


};









// ==========================================
// UPDATE MEDIA
// ==========================================

const updateMedia = async(req,res)=>{


    const {

        id

    } = req.params;


    const {

        title

    } = req.body;



    try{


        if(title === undefined){


            return res.status(400).json({

                message:"Title is required"

            });


        }



        const result = await db.query(

            `
            UPDATE event_media

            SET title=$2

            WHERE id=$1

            RETURNING *
            `,

            [

                id,

                title

            ]

        );



        if(!result.rows.length){


            return res.status(404).json({

                message:"Media not found"

            });


        }



        res.json({

            message:"Media updated",

            data:result.rows[0]

        });





    }catch(error){


        console.error(error);


        res.status(500).json({

            message:"Internal server error"

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

    updateMedia,

    deleteMedia


};