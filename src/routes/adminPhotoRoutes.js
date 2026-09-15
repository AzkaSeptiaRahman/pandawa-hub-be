const express = require("express");

const router = express.Router();


const authMiddleware =
require("../middleware/authMiddleware");


const upload =
require("../middleware/uploadPhoto");



const {

    uploadPhoto,

    getGraduatePhotos,

    deletePhoto

} = require("../controllers/adminPhotoController");






router.use(authMiddleware);






router.post(

    "/upload",

    upload.single("file"),

    (req,res,next)=>{


        console.log(
            "MULTER CHECK BODY:",
            req.body
        );


        console.log(
            "MULTER CHECK FILE:",
            req.file
        );


        next();


    },

    uploadPhoto

);







router.get(

    "/graduate/:graduateId",

    getGraduatePhotos

);







router.delete(

    "/:id",

    deletePhoto

);







module.exports = router;