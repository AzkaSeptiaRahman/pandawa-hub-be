const express = require("express");

const router = express.Router();

const {
    getPhotoOptions,
    searchPhoto
} = require("../controllers/photoController");

// =====================================================
// GET SEARCH OPTIONS
// =====================================================

router.get(
    "/options",
    getPhotoOptions
);


// =====================================================
// SEARCH STUDENT PHOTO
// =====================================================

router.post(
    "/search",
    searchPhoto
);

module.exports = router;