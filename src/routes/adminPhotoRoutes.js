const express = require("express");

const router = express.Router();

const multer = require("multer");


const {

    uploadPhoto,

    bulkUpload

} = require("../controllers/adminPhotoController");





const upload =
multer({

    dest:"uploads/temp"

});






// SINGLE

router.post(

    "/upload",

    upload.single("file"),

    uploadPhoto

);






// BULK ZIP

router.post(

    "/bulk-upload",

    upload.single("file"),

    bulkUpload

);





module.exports = router;