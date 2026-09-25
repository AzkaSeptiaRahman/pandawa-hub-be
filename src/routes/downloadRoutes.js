const express = require("express");

const router = express.Router();


const {
    downloadPhotos
} = require("../controllers/downloadController");

const {
    downloadAuth
} = require("../middleware/downloadAuth");



router.get(
    "/:graduateId",
    downloadAuth,
    downloadPhotos
);



module.exports = router;