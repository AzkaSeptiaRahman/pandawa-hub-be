const express = require("express");

const router = express.Router();


const {

    getPhotos,

    uploadPhoto,

    bulkUpload,

    deletePhoto

} = require("../controllers/adminPhotoController");


const authMiddleware =
require("../middleware/authMiddleware");

const {
    createImageUpload,
    createArchiveUpload
} = require("../config/upload");




// Single image: ditahan di memory lalu diupload ke object storage
const imageUpload =
    createImageUpload({
        fileSize: 10 * 1024 * 1024,
        files: 1
    });


// ZIP arsip bulk upload
const zipUpload =
    createArchiveUpload({
        fileSize: 200 * 1024 * 1024,
        files: 1
    });





// AUTH

router.use(authMiddleware);





// LIST PHOTOS

router.get(

    "/",

    getPhotos

);



// SINGLE

router.post(

    "/upload",

    imageUpload.single("file"),

    uploadPhoto

);






// BULK ZIP

router.post(

    "/bulk-upload",

    zipUpload.single("file"),

    bulkUpload

);




// DELETE SINGLE PHOTO

router.delete(

    "/:id",

    deletePhoto

);





module.exports = router;
