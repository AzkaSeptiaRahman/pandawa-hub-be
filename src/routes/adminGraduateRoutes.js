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




// ==============================
// MULTER EXCEL UPLOAD
// ==============================

const upload = multer({
    dest:"uploads/excel"
});




// ==============================
// AUTH
// ==============================

router.use(authMiddleware);




// ==============================
// GET GRADUATES
// GET /api/admin/graduates?eventId=1
// ==============================

router.get(
    "/",
    getGraduates
);




// ==============================
// GET GRADUATE OPTIONS
// GET /api/admin/graduates/options
// ==============================

router.get(
    "/options",
    getGraduateOptions
);




// ==============================
// CREATE GRADUATE
// POST /api/admin/graduates
// ==============================

router.post(
    "/",
    createGraduate
);




// ==============================
// UPDATE GRADUATE
// PUT /api/admin/graduates/:id
// ==============================

router.put(
    "/:id",
    updateGraduate
);




// ==============================
// DELETE GRADUATE
// DELETE /api/admin/graduates/:id
// ==============================

router.delete(
    "/:id",
    deleteGraduate
);




// ==============================
// IMPORT EXCEL
// POST /api/admin/graduates/import
//
// FORM DATA:
// event_id
// file
// ==============================

router.post(
    "/import",
    upload.single("file"),
    importExcel
);




module.exports = router;