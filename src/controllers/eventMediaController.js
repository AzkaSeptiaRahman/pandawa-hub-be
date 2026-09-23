const db = require("../config/database");

const path = require("path");





// =================================
// UPLOAD GALLERY
// =================================

const uploadGallery = async(req,res)=>{


    try{


        const {
            event_id
        } = req.body;



        if(!event_id){

            return res.status(400).json({
                message:"Event required"
            });

        }





        if(!req.files || req.files.length===0){

            return res.status(400).json({
                message:"Photos required"
            });

        }





        let uploaded=[];





        for(const file of req.files){


            const url =
            `/uploads/events/${file.filename}`;



            const result =
            await db.query(

`
INSERT INTO event_media

(
event_id,
type,
url
)

VALUES

($1,$2,$3)

RETURNING *
`,

            [
                event_id,
                "gallery",
                url
            ]

            );



            uploaded.push(
                result.rows[0]
            );


        }






        res.json({

            message:"Gallery uploaded",

            media:uploaded

        });




    }catch(error){


        console.error(error);


        res.status(500).json({

            message:error.message

        });


    }


};









// =================================
// ADD YOUTUBE HIGHLIGHT
// =================================

const addHighlight = async(req,res)=>{


    try{


        const {
            event_id,
            title,
            url
        } = req.body;





        if(
            !event_id ||
            !url
        ){

            return res.status(400).json({

                message:"Event and Youtube URL required"

            });

        }





        const videoId =
        extractYoutubeId(url);





        const thumbnail =
        videoId

        ?

        `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`

        :

        null;







        const result =
        await db.query(

`
INSERT INTO event_media

(
event_id,
type,
title,
url,
thumbnail
)

VALUES

($1,$2,$3,$4,$5)

RETURNING *
`,

        [
            event_id,
            "highlight",
            title || "Event Highlight",
            url,
            thumbnail
        ]

        );






        res.json({

            message:"Highlight added",

            media:result.rows[0]

        });




    }catch(error){


        console.error(error);


        res.status(500).json({

            message:error.message

        });


    }


};









// =================================
// DELETE MEDIA
// =================================

const deleteMedia = async(req,res)=>{


    try{


        const {
            id
        } = req.params;




        await db.query(

`
DELETE FROM event_media
WHERE id=$1
`,

        [id]

        );




        res.json({

            message:"Deleted"

        });




    }catch(error){


        res.status(500).json({

            message:error.message

        });


    }


};








function extractYoutubeId(url){


    const regex =
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/;



    const match =
    url.match(regex);



    return match
    ?
    match[1]
    :
    null;


}








module.exports={

    uploadGallery,

    addHighlight,

    deleteMedia

};