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
            SELECT *

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


        console.log(
            "GRADUATE BODY:",
            req.body
        );



        const {

            event_id,

            graduation_number,

            name,

            faculty,

            study_program,

            email


        } = req.body || {};







        if(

            !event_id ||

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
            SELECT *

            FROM graduates

            WHERE event_id=$1

            AND graduation_number=$2

            `,

            [

                event_id,

                graduation_number

            ]

        );





        if(check.rows.length > 0){


            return res.status(400).json({

                message:
                "Graduation number already exists"

            });


        }







        const result = await db.query(

            `
            INSERT INTO graduates

            (

                event_id,

                graduation_number,

                name,

                faculty,

                study_program,

                email

            )


            VALUES

            ($1,$2,$3,$4,$5,$6)


            RETURNING *

            `,


            [

                event_id,

                graduation_number,

                name,

                faculty,

                study_program,

                email || null

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

        name,

        faculty,

        study_program,

        email


    } = req.body || {};







    try{


        const result = await db.query(

            `
            UPDATE graduates

            SET

                name=$1,

                faculty=$2,

                study_program=$3,

                email=$4


            WHERE id=$5


            RETURNING *

            `,


            [

                name,

                faculty,

                study_program,

                email || null,

                id

            ]

        );







        if(result.rows.length === 0){


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








        if(result.rows.length === 0){


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


        if(!req.file){


            return res.status(400).json({

                message:
                "Excel file required"

            });


        }







        const workbook = XLSX.readFile(

            req.file.path

        );







        const sheet = workbook.Sheets[

            workbook.SheetNames[0]

        ];







        const rows = XLSX.utils.sheet_to_json(

            sheet

        );






        let inserted = 0;







        for(const row of rows){



            await db.query(

                `
                INSERT INTO graduates

                (

                    event_id,

                    graduation_number,

                    name,

                    faculty,

                    study_program,

                    email

                )


                VALUES

                ($1,$2,$3,$4,$5,$6)

                `,


                [

                    row.event_id,

                    row.graduation_number,

                    row.name,

                    row.faculty,

                    row.study_program,

                    row.email || null

                ]

            );



            inserted++;


        }








        res.json({

            message:
            "Import success",

            total:
            inserted

        });







    }catch(error){


        console.error(error);


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

    importExcel


};