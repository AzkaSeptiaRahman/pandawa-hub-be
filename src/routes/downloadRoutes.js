const express = require("express");

const router = express.Router();


const {
    downloadPhotos
} = require("../controllers/downloadController");



router.get(
    "/:graduateId",
    downloadPhotos
);



module.exports = router;