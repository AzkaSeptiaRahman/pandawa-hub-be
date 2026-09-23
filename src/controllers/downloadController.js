const db = require("../config/database");

const archiver = require("archiver");

const {
    getObjectStream
} = require("../config/s3");

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

            "warning",
            (err)=>{

                console.warn(
                    "Archive warning:",
                    err.message
                );

            }

        );

        archive.on(

            "error",
            (err)=>{

                console.error(
                    "Archive error:",
                    err
                );

                if(res.headersSent){

                    res.end();

                }else{

                    res.status(500).json({

                        message:"Failed to build archive"

                    });

                }

            }

        );

        archive.pipe(res);

        // Stream tiap file dari object storage langsung ke dalam ZIP
        // (tanpa menulis ke disk)

        for(const photo of photos.rows){

            try {

                const stream = await getObjectStream(
                    photo.url
                );

                archive.append(

                    stream,

                    {

                        name:
                        `${photo.type}/${photo.id}.jpg`

                    }

                );

            }catch(err){

                console.error(
                    `Skip photo ${photo.id} (key: ${photo.url}):`,
                    err.message
                );

            }

        }

        await archive.finalize();

    }catch(error){

        console.log(error);

        if(res.headersSent){

            res.end();

        }else{

            res.status(500).json({

                message:error.message

            });

        }

    }

};

module.exports = {

    downloadPhotos

};
