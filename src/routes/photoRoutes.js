const express = require("express");

const router = express.Router();


const {
    searchPhoto
} = require("../controllers/photoController");


router.post(
    "/search",
    searchPhoto
);


module.exports = router;