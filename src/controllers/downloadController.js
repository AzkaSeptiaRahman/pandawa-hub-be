const db = require("../config/database");

const archiver = require("archiver");

const {
    getObjectStream
} = require("../config/s3");

const FILENAME_REGEX = /\.(jpg|jpeg|png|webp)$/i;

const DOWNLOAD_CONCURRENCY = Math.max(
    1,
    parseInt(process.env.DOWNLOAD_CONCURRENCY || "4", 10) || 4
);

// Baca seluruh isi stream menjadi buffer

const readStream = (stream)=>new Promise((resolve, reject)=>{

    const chunks = [];

    stream.on(
        "data",
        (chunk)=>chunks.push(chunk)
    );

    stream.on(
        "end",
        ()=>resolve(Buffer.concat(chunks))
    );

    stream.on("error", reject);

});

// Jalankan task dengan batas paralel supaya tidak membanjiri
// object storage ketika jumlah foto banyak

const mapWithConcurrency = async(items, limit, task)=>{

    const results = new Array(items.length);

    let next = 0;

    const workers = new Array(
        Math.min(limit, items.length)
    ).fill(null).map(async()=>{

        while(next < items.length){

            const index = next++;

            results[index] = await task(
                items[index],
                index
            );

        }

    });

    await Promise.all(workers);

    return results;

};

// Ukuran pasti ZIP mode "store": 30 byte local header + nama + data,
// 46 byte central directory + nama, 22 byte end-of-central-directory.
// Ukuran sudah diketahui saat streaming sehingga tidak ada data
// descriptor tambahan.

const zipSize = (files)=>files.reduce(

    (total, file)=>total + 76 +
        (2 * Buffer.byteLength(file.name)) +
        file.buffer.length,

    22

);

const downloadPhotos = async(req,res)=>{

    const { graduateId } = req.params;

    try {

        const graduate = await db.query(

            `
            SELECT *
            FROM graduates
            WHERE id = $1
            `,

            [ graduateId ]

        );

        if(graduate.rows.length === 0){

            return res.status(404).json({

                message:"Graduate not found"

            });

        }

        const photos = await db.query(

            `
            SELECT *
            FROM photos
            WHERE graduate_id = $1
            ORDER BY type ASC
            `,

            [ graduateId ]

        );

        if(photos.rows.length === 0){

            return res.status(404).json({

                message:"Photos not found"

            });

        }

        const items = photos.rows.map((photo)=>{

            const match = FILENAME_REGEX.exec(
                photo.filename || ""
            );

            return {

                key: photo.url,

                name: `${photo.type}/${photo.id}${
                    match ? match[0].toLowerCase() : ".jpg"
                }`

            };

        });

        // Ambil semua objek dari object storage secara paralel
        // (dengan batas). Ini bagian paling lama dari proses,
        // jadi berurutan membuat total waktu menumpuk.

        const buffers = await mapWithConcurrency(

            items,
            DOWNLOAD_CONCURRENCY,

            async(item)=>{

                try {

                    return await readStream(
                        await getObjectStream(item.key)
                    );

                }catch(error){

                    console.error(
                        `Skip photo (key: ${item.key}):`,
                        error.message
                    );

                    return null;

                }

            }

        );

        const files = buffers

            .map((buffer, index)=>({

                buffer,

                name: items[index].name

            }))

            .filter((file)=>file.buffer !== null);

        if(files.length === 0){

            return res.status(502).json({

                message:"Failed to fetch photos from storage"

            });

        }

        const studentName = graduate.rows[0]
            .name
            .replace(/\s+/g,"-");

        const asciiName = studentName.replace(/[^\w.-]/g,"_") || "photos";

        const encodedName = encodeURIComponent(
            `${studentName}-photos.zip`
        );

        res.setHeader(

            "Content-Type",

            "application/zip"

        );

        res.setHeader(

            "Content-Disposition",

            `attachment; filename="${asciiName}-photos.zip"; filename*=UTF-8''${encodedName}`

        );

        // ZIP mode "store": JPG sudah terkompresi, jadi kompresi ulang
        // hanya membuang CPU tanpa memperkecil ukuran. Ukuran hasilnya
        // pun deterministik sehingga Content-Length bisa dihitung pasti
        // (browser dapat progress bar, proxy tidak buffering buta).

        const totalSize = zipSize(files);

        if(totalSize < 0xffffffff){

            res.setHeader(
                "Content-Length",
                String(totalSize)
            );

        }

        const archive = archiver(

            "zip",

            {
                store:true
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

        for(const file of files){

            archive.append(

                file.buffer,

                {
                    name: file.name
                }

            );

        }

        await archive.finalize();

    }catch(error){

        console.log(error);

        if(res.headersSent){

            res.end();

        }else{

            res.status(500).json({

                message:"Internal server error"

            });

        }

    }

};

module.exports = {

    downloadPhotos

};
