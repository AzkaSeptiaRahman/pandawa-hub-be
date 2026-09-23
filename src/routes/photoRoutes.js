const express = require("express");

const router = express.Router();

const {
    searchPhoto
} = require("../controllers/photoController");

const {
    upload,
    uploadPhotos
} = require("../controllers/uploadController");

// Upload foto ke object storage
// multipart/form-data:
//   photos[]  : file gambar (maks 20)
//   graduateId: id mahasiswa
//   type      : BEBAS | KUNCIR | IJAZAH

router.post(
    "/upload",
    upload.array(
        "photos",
        20
    ),
    uploadPhotos
);

router.post(
    "/search",
    searchPhoto
);

module.exports = router;
