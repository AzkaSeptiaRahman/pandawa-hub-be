const db = require("../config/database");
const archiver = require("archiver");

const path = require("path");



const downloadPhotos = async(req,res)=>{


    const { graduateId } = req.params;


    try {


        // Ambil data mahasiswa

        const graduate = await db.query(

            `
            SELECT *
            FROM graduates
            WHERE id = $1
            `,

            [
                graduateId
            ]

        );



        if(graduate.rows.length === 0){

            return res.status(404).json({

                message:"Graduate not found"

            });

        }





        // Ambil foto

        const photos = await db.query(

            `
            SELECT *
            FROM photos
            WHERE graduate_id = $1
            ORDER BY type ASC
            `,

            [
                graduateId
            ]

        );





        if(photos.rows.length === 0){


            return res.status(404).json({

                message:"Photos not found"

            });


        }








        const studentName = graduate.rows[0]
            .name
            .replace(/\s+/g,"-");







        res.setHeader(

            "Content-Type",

            "application/zip"

        );



        res.setHeader(

            "Content-Disposition",

            `attachment; filename=${studentName}-photos.zip`

        );







        const archive = archiver(
            "zip",
            {
                zlib:{
                    level:9
                }
            }
        );







        archive.on(
            "error",
            (err)=>{

                throw err;

            }
        );






        archive.pipe(res);








        photos.rows.forEach((photo)=>{


            const filePath = path.join(

                __dirname,

                "../../",

                photo.url

            );





            archive.file(

                filePath,

                {

                    name:
                    `${photo.type}/${photo.id}.jpg`

                }

            );


        });






        await archive.finalize();





    }catch(error){


        console.log(error);


        res.status(500).json({

            message:error.message

        });


    }


};




module.exports = {

    downloadPhotos

};