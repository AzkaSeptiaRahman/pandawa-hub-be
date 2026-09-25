const db = require("../config/database");

const {
    deleteObjectSafe
} = require("../config/s3");
const XLSX = require("xlsx");



// ==============================
// GET GRADUATES
// ==============================

const getGraduates = async(req,res)=>{


    const {
        eventId,
        page,
        limit,
        search
    } = req.query;



    try{


        if(!eventId){

            return res.status(400).json({

                message:"Event ID required"

            });

        }



        // Pagination opsional. Tanpa "page", perilaku lama dipertahankan
        // (kirim semua) agar tetap kompatibel.
        const paginate = page !== undefined;

        const pageNumber = Math.max(
            parseInt(page, 10) || 1,
            1
        );

        const perPage = Math.min(
            Math.max(parseInt(limit, 10) || 25, 1),
            100
        );

        const term = String(search || "").trim();



        const conditions = ["event_id=$1"];
        const values = [eventId];

        if(term){

            values.push(`%${term}%`);

            const i = values.length;

            conditions.push(
                `(name ILIKE $${i} OR nim ILIKE $${i} OR graduation_number ILIKE $${i})`
            );

        }



        const where = conditions.join(" AND ");



        const totalResult = await db.query(

            `
            SELECT COUNT(*)::int AS total
            FROM graduates
            WHERE ${where}
            `,

            values

        );



        let sql = `
            SELECT

                id,
                event_id,
                nim,
                graduation_number,
                name,
                faculty,
                study_program,
                created_at

            FROM graduates

            WHERE ${where}

            ORDER BY graduation_number ASC
        `;



        if(paginate){

            values.push(perPage);
            const limitIdx = values.length;

            values.push((pageNumber - 1) * perPage);
            const offsetIdx = values.length;

            sql += ` LIMIT $${limitIdx} OFFSET $${offsetIdx}`;

        }



        const result = await db.query(

            sql,

            values

        );



        res.json({

            graduates:result.rows,

            total:totalResult.rows[0].total,

            page:paginate ? pageNumber : 1,

            limit:paginate ? perPage : totalResult.rows[0].total

        });



    }catch(error){


        console.error(error);


        res.status(500).json({

            message:"Internal server error"

        });


    }


};








// ==============================
// CREATE GRADUATE
// ==============================
const createGraduate = async(req,res)=>{


    try{


        const {

            event_id,
            nim,
            graduation_number,
            name,
            faculty,
            study_program


        } = req.body;






        if(

            !event_id ||
            !nim ||
            !graduation_number ||
            !name ||
            !faculty ||
            !study_program

        ){

            return res.status(400).json({

                message:
                "Complete graduate data required"

            });

        }









        const check = await db.query(

            `
            SELECT id

            FROM graduates

            WHERE event_id=$1

            AND nim=$2

            `,

            [

                event_id,

                nim

            ]

        );







        if(check.rows.length){


            return res.status(400).json({

                message:
                "NIM already exists in this event"

            });


        }









        const result = await db.query(

            `
            INSERT INTO graduates

            (
                event_id,
                nim,
                graduation_number,
                name,
                faculty,
                study_program
            )

            VALUES

            ($1,$2,$3,$4,$5,$6)

            RETURNING *

            `,

            [

                event_id,
                nim,
                graduation_number,
                name,
                faculty,
                study_program

            ]

        );








        res.status(201).json({

            message:
            "Graduate created",

            graduate:
            result.rows[0]

        });






    }catch(error){


        console.error(error);


        res.status(500).json({

            message:"Internal server error"

        });


    }


};









// ==============================
// UPDATE GRADUATE
// ==============================

const updateGraduate = async(req,res)=>{


    const {
        id
    } = req.params;



    const {

        nim,
        graduation_number,
        name,
        faculty,
        study_program


    } = req.body;





    try{


        const result = await db.query(

            `
            UPDATE graduates

            SET

                nim=$1,

                graduation_number=$2,

                name=$3,

                faculty=$4,

                study_program=$5


            WHERE id=$6


            RETURNING *

            `,

            [

                nim,
                graduation_number,
                name,
                faculty,
                study_program,
                id

            ]

        );







        if(!result.rows.length){


            return res.status(404).json({

                message:
                "Graduate not found"

            });


        }







        res.json({

            message:
            "Graduate updated",

            graduate:
            result.rows[0]

        });




    }catch(error){


        console.error(error);


        res.status(500).json({

            message:"Internal server error"

        });


    }


};









// ==============================
// DELETE GRADUATE
// ==============================

const deleteGraduate = async(req,res)=>{


    const {
        id
    } = req.params;




    try{


        // Ambil foto dulu agar object storage bisa dibersihkan
        const photos = await db.query(

            `
            SELECT url
            FROM photos
            WHERE graduate_id=$1
            `,

            [
                id
            ]

        );


        const result = await db.query(

            `
            DELETE FROM graduates

            WHERE id=$1

            RETURNING *

            `,

            [
                id
            ]

        );





        if(!result.rows.length){


            return res.status(404).json({

                message:
                "Graduate not found"

            });


        }







        // Hapus foto dari object storage (best effort)
        for(const photo of photos.rows){

            await deleteObjectSafe(
                photo.url
            );

        }




        res.json({

            message:
            "Graduate deleted",

            graduate:
            result.rows[0]

        });





    }catch(error){


        console.error(error);


        res.status(500).json({

            message:"Internal server error"

        });


    }


};









// ==============================
// IMPORT EXCEL
// ==============================

const importExcel = async(req,res)=>{


    try{


        const {
            event_id
        } = req.body;





        if(!event_id){

            return res.status(400).json({

                message:
                "Event required"

            });

        }





        if(!req.file){


            return res.status(400).json({

                message:
                "Excel file required"

            });


        }







        const workbook =
        XLSX.read(
            req.file.buffer,
            { type: "buffer" }
        );



        const sheet =
        workbook.Sheets[
            workbook.SheetNames[0]
        ];



        const rows =
        XLSX.utils.sheet_to_json(
            sheet
        );







        let success=0;

        let failed=[];









        for(const row of rows){



            try{





                if(

                    !row.nim ||

                    !row.graduation_number ||

                    !row.name ||

                    !row.faculty ||

                    !row.study_program

                ){

                    failed.push({

                        row,

                        reason:
                        "Incomplete data"

                    });


                    continue;


                }









                const check =
                await db.query(

                    `
                    SELECT id

                    FROM graduates

                    WHERE event_id=$1

                    AND nim=$2

                    `,

                    [

                        event_id,

                        row.nim

                    ]

                );







                if(check.rows.length){


                    failed.push({

                        row,

                        reason:
                        "Duplicate NIM"

                    });


                    continue;


                }










                await db.query(

                    `
                    INSERT INTO graduates

                    (

                        event_id,

                        nim,

                        graduation_number,

                        name,

                        faculty,

                        study_program

                    )


                    VALUES

                    ($1,$2,$3,$4,$5,$6)

                    `,


                    [

                        event_id,

                        String(row.nim),

                        String(row.graduation_number),

                        row.name,

                        row.faculty,

                        row.study_program


                    ]

                );







                success++;





            }catch(err){


                failed.push({

                    row,

                    reason:
                    err.message

                });


            }



        }









        res.json({

            message:
            "Import completed",

            success,

            failed

        });









    }catch(error){


        console.error(error);


        res.status(500).json({

            message:"Internal server error"

        });


    }


};











// ==============================
// GRADUATE OPTIONS
// ==============================

// ==============================
// DOWNLOAD EXCEL TEMPLATE
// ==============================

const TEMPLATE_HEADERS = [

    "nim",

    "graduation_number",

    "name",

    "faculty",

    "study_program"

];


const TEMPLATE_SAMPLE = [

    "1234567890",

    "0001",

    "Contoh Nama Mahasiswa",

    "Fakultas Ilmu Tarbiyah dan Keguruan",

    "Pendidikan Agama Islam"

];


const TEMPLATE_COLS = [

    { wch: 16 },

    { wch: 20 },

    { wch: 28 },

    { wch: 40 },

    { wch: 32 }

];


const downloadTemplate = (req,res)=>{


    // Sheet pertama hanya berisi header supaya bisa langsung diisi
    // lalu di-import tanpa perlu menghapus baris contoh.
    const dataSheet = XLSX.utils.aoa_to_sheet(

        [

            TEMPLATE_HEADERS

        ]

    );


    dataSheet["!cols"] = TEMPLATE_COLS;


    const exampleSheet = XLSX.utils.aoa_to_sheet(

        [

            TEMPLATE_HEADERS,

            TEMPLATE_SAMPLE

        ]

    );


    exampleSheet["!cols"] = TEMPLATE_COLS;


    const workbook = XLSX.utils.book_new();


    XLSX.utils.book_append_sheet(

        workbook,

        dataSheet,

        "Graduates"

    );


    XLSX.utils.book_append_sheet(

        workbook,

        exampleSheet,

        "Contoh"

    );


    const buffer = XLSX.write(

        workbook,

        {

            type: "buffer",

            bookType: "xlsx"

        }

    );


    res.setHeader(

        "Content-Type",

        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

    );


    res.setHeader(

        "Content-Disposition",

        'attachment; filename="template-graduates.xlsx"'

    );


    res.send(buffer);

};



const getGraduateOptions = async(req,res)=>{


    const {
        eventId
    } = req.query;



    try{


        // Tanpa filter event, perilaku lama dipertahankan (semua graduate).
        // Dengan eventId, hanya graduate milik event itu yang dikembalikan.
        if(eventId){


            const result = await db.query(

                `
                SELECT

                    id,

                    nim,

                    graduation_number,

                    name,

                    faculty,

                    study_program


                FROM graduates

                WHERE event_id = $1

                ORDER BY name ASC
                `,

                [
                    eventId
                ]

            );



            return res.json(
                result.rows
            );


        }





        const result =
        await db.query(

            `
            SELECT

                id,

                nim,

                graduation_number,

                name,

                faculty,

                study_program


            FROM graduates

            ORDER BY name ASC

            `

        );



        res.json(
            result.rows
        );




    }catch(error){


        console.error(error);


        res.status(500).json({

            message:"Internal server error"

        });


    }


};







module.exports = {


    getGraduates,

    createGraduate,

    updateGraduate,

    deleteGraduate,

    importExcel,

    downloadTemplate,

    getGraduateOptions


};