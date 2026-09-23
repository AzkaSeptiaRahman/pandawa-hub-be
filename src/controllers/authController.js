const db = require("../config/database");

const bcrypt = require("bcrypt");

const jwt = require("jsonwebtoken");




// REGISTER ADMIN

const register = async(req,res)=>{


    try{


        const {
            username,
            password
        } = req.body || {};




        if(!username || !password){

            return res.status(400).json({

                message:"Username and password are required"

            });

        }





        const check = await db.query(

            `
            SELECT *
            FROM admins
            WHERE username=$1
            `,

            [
                username
            ]

        );







        if(check.rows.length > 0){


            return res.status(400).json({

                message:"Username already exists"

            });


        }








        const hashedPassword = await bcrypt.hash(

            password,

            10

        );








        const result = await db.query(

            `
            INSERT INTO admins

            (
                username,
                password
            )

            VALUES

            ($1,$2)

            RETURNING id,username

            `,

            [
                username,
                hashedPassword
            ]

        );








        res.status(201).json({

            message:"Admin created",

            admin:result.rows[0]

        });







    }catch(error){


        console.error(error);


        res.status(500).json({

            message:error.message

        });


    }


};









// LOGIN ADMIN


const login = async(req,res)=>{


    try{


        const {

            username,

            password

        } = req.body || {};






        if(!username || !password){


            return res.status(400).json({

                message:"Username and password are required"

            });


        }








        const result = await db.query(

            `
            SELECT *

            FROM admins

            WHERE username=$1

            `,

            [
                username
            ]

        );








        if(result.rows.length === 0){


            return res.status(401).json({

                message:"Invalid username/password"

            });


        }







        const admin = result.rows[0];







        const match = await bcrypt.compare(

            password,

            admin.password

        );







        if(!match){


            return res.status(401).json({

                message:"Invalid username/password"

            });


        }








        const token = jwt.sign(

            {

                id:admin.id,

                username:admin.username

            },


            process.env.JWT_SECRET,


            {

                expiresIn:"1d"

            }


        );








        res.json({

            token

        });







    }catch(error){


        console.error(error);


        res.status(500).json({

            message:error.message

        });


    }


};







module.exports = {

    register,

    login

};