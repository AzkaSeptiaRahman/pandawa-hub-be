const express = require("express");

const router = express.Router();


const {
    register,
    login
} = require("../controllers/authController");


const authMiddleware = require("../middleware/authMiddleware");





router.post(
    "/register",
    register
);



router.post(
    "/login",
    login
);





router.get(

    "/check",

    authMiddleware,

    (req,res)=>{


        res.json({

            message:"Admin verified",

            admin:req.admin

        });


    }

);





module.exports = router;