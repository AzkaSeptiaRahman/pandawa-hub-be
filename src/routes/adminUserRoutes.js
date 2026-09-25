const express = require("express");

const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");

const {
    getAdmins,
    createAdmin,
    updateAdmin,
    deleteAdmin
} = require("../controllers/adminUserController");

// Seluruh endpoint di sini hanya untuk admin yang sudah login.
router.use(authMiddleware);

// ==============================
// LIST ADMINS
// GET /api/admin/users
// ==============================

router.get(
    "/",
    getAdmins
);

// ==============================
// CREATE ADMIN
// POST /api/admin/users
// ==============================

router.post(
    "/",
    createAdmin
);

// ==============================
// UPDATE ADMIN
// PUT /api/admin/users/:id
// ==============================

router.put(
    "/:id",
    updateAdmin
);

// ==============================
// DELETE ADMIN
// DELETE /api/admin/users/:id
// ==============================

router.delete(
    "/:id",
    deleteAdmin
);

module.exports = router;
