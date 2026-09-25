const db = require("../config/database");

const bcrypt = require("bcrypt");

const jwt = require("jsonwebtoken");




const {
    validatePassword
} = require("../utils/password");




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




        const passwordError = validatePassword(password);


        if(passwordError){

            return res.status(400).json({

                message:passwordError

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

            message:"Internal server error"

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

            message:"Internal server error"

        });


    }


};







// CHANGE PASSWORD

const changePassword = async(req,res)=>{


    try{


        const {
            currentPassword,
            newPassword
        } = req.body || {};



        if(!currentPassword || !newPassword){

            return res.status(400).json({

                message:"Current and new password are required"

            });

        }



        const passwordError = validatePassword(newPassword);


        if(passwordError){

            return res.status(400).json({

                message:passwordError

            });

        }



        const result = await db.query(

            `
            SELECT *
            FROM admins
            WHERE id=$1
            `,

            [
                req.admin.id
            ]

        );



        if(result.rows.length === 0){

            return res.status(404).json({

                message:"Admin not found"

            });

        }



        const admin = result.rows[0];



        const match = await bcrypt.compare(

            currentPassword,

            admin.password

        );



        if(!match){

            return res.status(401).json({

                message:"Current password is incorrect"

            });

        }



        const hashedPassword = await bcrypt.hash(

            newPassword,

            10

        );



        await db.query(

            `
            UPDATE admins
            SET password=$1
            WHERE id=$2
            `,

            [
                hashedPassword,
                req.admin.id
            ]

        );



        res.json({

            message:"Password updated"

        });



    }catch(error){


        console.error(error);


        res.status(500).json({

            message:"Internal server error"

        });


    }


};





module.exports = {

    register,

    login,

    changePassword

};