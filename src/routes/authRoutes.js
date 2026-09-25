const express = require("express");

const router = express.Router();

const rateLimit = require("express-rate-limit");


const {
    register,
    login,
    changePassword
} = require("../controllers/authController");


const authMiddleware = require("../middleware/authMiddleware");




const loginLimiter = rateLimit({

    windowMs: 15 * 60 * 1000,

    max: 10,

    standardHeaders: true,

    legacyHeaders: false,

    message: {

        message:
        "Too many login attempts, please try again later"

    }

});




// Register juga memakai bcrypt (mahal), jadi dibatasi
// meski endpoint-nya sudah butuh autentikasi admin.
const registerLimiter = rateLimit({

    windowMs: 15 * 60 * 1000,

    max: 20,

    standardHeaders: true,

    legacyHeaders: false,

    message: {

        message:
        "Too many requests, please try again later"

    }

});




router.post(
    "/register",
    authMiddleware,
    registerLimiter,
    register
);



router.post(
    "/login",
    loginLimiter,
    login
);



router.post(
    "/change-password",
    authMiddleware,
    changePassword
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