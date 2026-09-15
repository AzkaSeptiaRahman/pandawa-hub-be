const express = require("express");

const router = express.Router();


const multer = require("multer");


const authMiddleware = require("../middleware/authMiddleware");



const {

    getGraduates,

    createGraduate,

    updateGraduate,

    deleteGraduate,

    importExcel


} = require("../controllers/adminGraduateController");



console.log({

    getGraduates:typeof getGraduates,

    createGraduate:typeof createGraduate,

    updateGraduate:typeof updateGraduate,

    deleteGraduate:typeof deleteGraduate,

    importExcel:typeof importExcel

});



// Excel upload

const upload = multer({

    dest:"uploads/excel"

});








// Semua route graduate wajib login admin

router.use(authMiddleware);








// GET GRADUATES

// GET /api/admin/graduates?eventId=1

router.get(

    "/",

    getGraduates

);








// CREATE GRADUATE

// POST /api/admin/graduates

router.post(

    "/",

    createGraduate

);








// UPDATE GRADUATE

// PUT /api/admin/graduates/:id

router.put(

    "/:id",

    updateGraduate

);








// DELETE GRADUATE

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

    importExcel

};

module.exports = router;