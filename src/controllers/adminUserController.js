const db = require("../config/database");

const bcrypt = require("bcrypt");

const {
    validatePassword
} = require("../utils/password");

const SALT_ROUNDS = 10;

const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 50;

// Username dipakai sebagai identitas login, jadi dibatasi ke
// karakter yang tidak membingungkan (tanpa spasi/karakter kontrol).
const USERNAME_PATTERN = /^[A-Za-z0-9._-]+$/;

const validateUsername = (username) => {
    if (typeof username !== "string") {
        return "Username is required";
    }

    const trimmed = username.trim();

    if (trimmed.length < USERNAME_MIN_LENGTH) {
        return `Username must be at least ${USERNAME_MIN_LENGTH} characters`;
    }

    if (trimmed.length > USERNAME_MAX_LENGTH) {
        return `Username must be at most ${USERNAME_MAX_LENGTH} characters`;
    }

    if (!USERNAME_PATTERN.test(trimmed)) {
        return "Username may only contain letters, numbers, dot, underscore and dash";
    }

    return null;
};

// Cek duplikat tanpa membedakan huruf besar/kecil, supaya
// "Admin" dan "admin" tidak bisa hidup berdampingan dan
// membingungkan saat login.
const findUsernameOwner = async (username, exceptId) => {
    const result = await db.query(
        `
        SELECT id
        FROM admins
        WHERE LOWER(username) = LOWER($1)
        AND ($2::int IS NULL OR id <> $2)
        `,
        [username, exceptId ?? null]
    );

    return result.rows[0] || null;
};

const countAdmins = async () => {
    const result = await db.query(
        `
        SELECT COUNT(*)::int AS total
        FROM admins
        `
    );

    return result.rows[0].total;
};

// ==============================
// PUBLIC SHAPE
//
// Password hash tidak pernah keluar dari API.
// ==============================

const toPublicAdmin = (row, currentId) => ({
    id: row.id,
    username: row.username,
    created_at: row.created_at,
    is_self: String(row.id) === String(currentId)
});

// ==============================
// LIST ADMINS
// GET /api/admin/users
// ==============================

const getAdmins = async (req, res) => {
    try {
        const result = await db.query(
            `
            SELECT id, username, created_at
            FROM admins
            ORDER BY id ASC
            `
        );

        res.json({
            users: result.rows.map((row) => toPublicAdmin(row, req.admin.id))
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Internal server error"
        });
    }
};

// ==============================
// CREATE ADMIN
// POST /api/admin/users
// ==============================

const createAdmin = async (req, res) => {
    try {
        const { username, password } = req.body || {};

        const usernameError = validateUsername(username);

        if (usernameError) {
            return res.status(400).json({
                message: usernameError
            });
        }

        const passwordError = validatePassword(password);

        if (passwordError) {
            return res.status(400).json({
                message: passwordError
            });
        }

        const cleanUsername = username.trim();

        if (await findUsernameOwner(cleanUsername)) {
            return res.status(409).json({
                message: "Username already exists"
            });
        }

        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        const result = await db.query(
            `
            INSERT INTO admins
            (
                username,
                password
            )
            VALUES
            ($1,$2)
            RETURNING id,username,created_at
            `,
            [cleanUsername, hashedPassword]
        );

        res.status(201).json({
            message: "Admin created",
            user: toPublicAdmin(result.rows[0], req.admin.id)
        });

    } catch (error) {
        // Unique index tetap jadi pengaman terakhir kalau ada
        // dua request create bersamaan.
        if (error.code === "23505") {
            return res.status(409).json({
                message: "Username already exists"
            });
        }

        console.error(error);

        res.status(500).json({
            message: "Internal server error"
        });
    }
};

// ==============================
// UPDATE ADMIN
// PUT /api/admin/users/:id
//
// Field opsional: username dan/atau password.
// ==============================

const updateAdmin = async (req, res) => {
    try {
        const { id } = req.params;
        const { username, password } = req.body || {};

        if (!username && !password) {
            return res.status(400).json({
                message: "Nothing to update"
            });
        }

        const existing = await db.query(
            `
            SELECT id, username, created_at
            FROM admins
            WHERE id=$1
            `,
            [id]
        );

        if (existing.rows.length === 0) {
            return res.status(404).json({
                message: "Admin not found"
            });
        }

        let cleanUsername = null;

        if (username) {
            const usernameError = validateUsername(username);

            if (usernameError) {
                return res.status(400).json({
                    message: usernameError
                });
            }

            cleanUsername = username.trim();

            if (await findUsernameOwner(cleanUsername, id)) {
                return res.status(409).json({
                    message: "Username already exists"
                });
            }
        }

        let hashedPassword = null;

        if (password) {
            const passwordError = validatePassword(password);

            if (passwordError) {
                return res.status(400).json({
                    message: passwordError
                });
            }

            hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
        }

        // COALESCE: field yang tidak dikirim tidak ikut berubah.
        const result = await db.query(
            `
            UPDATE admins
            SET
                username = COALESCE($1, username),
                password = COALESCE($2, password)
            WHERE id=$3
            RETURNING id,username,created_at
            `,
            [cleanUsername, hashedPassword, id]
        );

        res.json({
            message: "Admin updated",
            user: toPublicAdmin(result.rows[0], req.admin.id)
        });

    } catch (error) {
        if (error.code === "23505") {
            return res.status(409).json({
                message: "Username already exists"
            });
        }

        console.error(error);

        res.status(500).json({
            message: "Internal server error"
        });
    }
};

// ==============================
// DELETE ADMIN
// DELETE /api/admin/users/:id
// ==============================

const deleteAdmin = async (req, res) => {
    try {
        const { id } = req.params;

        // Menghapus akun sendiri akan langsung mengakhiri sesi
        // dan bisa membuat terkunci di luar. Dicegah.
        if (String(id) === String(req.admin.id)) {
            return res.status(400).json({
                message: "You cannot delete your own account"
            });
        }

        const existing = await db.query(
            `
            SELECT id
            FROM admins
            WHERE id=$1
            `,
            [id]
        );

        if (existing.rows.length === 0) {
            return res.status(404).json({
                message: "Admin not found"
            });
        }

        // Jangan sampai semua admin terhapus dan tidak ada
        // yang bisa login lagi.
        if (await countAdmins() <= 1) {
            return res.status(400).json({
                message: "Cannot delete the last admin account"
            });
        }

        await db.query(
            `
            DELETE FROM admins
            WHERE id=$1
            `,
            [id]
        );

        res.json({
            message: "Admin deleted"
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Internal server error"
        });
    }
};

module.exports = {
    getAdmins,
    createAdmin,
    updateAdmin,
    deleteAdmin
};
