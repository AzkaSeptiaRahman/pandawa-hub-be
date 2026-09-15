const express = require("express");

const router = express.Router();

const multer = require("multer");

const authMiddleware =
require("../middleware/authMiddleware");



const {

    getGraduates,

    createGraduate,

    updateGraduate,

    deleteGraduate,

    importExcel,

    getGraduateOptions


} = require("../controllers/adminGraduateController");





console.log({

    getGraduates: typeof getGraduates,

    createGraduate: typeof createGraduate,

    updateGraduate: typeof updateGraduate,

    deleteGraduate: typeof deleteGraduate,

    importExcel: typeof importExcel,

    getGraduateOptions: typeof getGraduateOptions

});









const upload = multer({

    dest:"uploads/excel"

});









// aktifkan kalau CMS sudah pakai login
router.use(authMiddleware);









// GET ALL GRADUATES

// GET /api/admin/graduates

router.get(

    "/",

    getGraduates

);








// GET OPTIONS FOR PHOTO UPLOAD

// GET /api/admin/graduates/options

router.get(

    "/options",

    getGraduateOptions

);








// CREATE

// POST /api/admin/graduates

router.post(

    "/",

    createGraduate

);








// UPDATE

// PUT /api/admin/graduates/:id

router.put(

    "/:id",

    updateGraduate

);








// DELETE

// DELETE /api/admin/graduates/:id

router.delete(

    "/:id",

    deleteGraduate

);








// IMPORT EXCEL

// POST /api/admin/graduates/import

router.post(

    "/import",

    upload.single("file"),

    importExcel

);



module.exports = {

    getGraduates,

    createGraduate,

    updateGraduate,

    deleteGraduate,

    importExcel,

    getGraduateOptions

};




module.exports = router;