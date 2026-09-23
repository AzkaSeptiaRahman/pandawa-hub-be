const db = require("../config/database");
const XLSX = require("xlsx");




// ==============================
// GET GRADUATES
// ==============================

const getGraduates = async(req,res)=>{


    const {
        eventId
    } = req.query;



    try{


        if(!eventId){

            return res.status(400).json({

                message:"Event ID required"

            });

        }





        const result = await db.query(

            `
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

            WHERE event_id=$1

            ORDER BY graduation_number ASC

            `,

            [
                eventId
            ]

        );






        res.json({

            graduates:result.rows

        });





    }catch(error){


        console.error(error);


        res.status(500).json({

            message:error.message

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

            message:error.message

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

            message:error.message

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







        res.json({

            message:
            "Graduate deleted",

            graduate:
            result.rows[0]

        });





    }catch(error){


        console.error(error);


        res.status(500).json({

            message:error.message

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
        XLSX.readFile(
            req.file.path
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

            message:error.message

        });


    }


};











// ==============================
// GRADUATE OPTIONS
// ==============================

const getGraduateOptions = async(req,res)=>{


    try{


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


        res.status(500).json({

            message:error.message

        });


    }


};







module.exports = {


    getGraduates,

    createGraduate,

    updateGraduate,

    deleteGraduate,

    importExcel,

    getGraduateOptions


};