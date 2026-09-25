// ======================================================
// CREATE INITIAL ADMIN
//
// Dipakai untuk deployment baru, ketika belum ada admin
// sama sekali dan endpoint /register sudah terkunci auth.
//
// Pemakaian:
//   node scripts/createAdmin.js <username> <password>
//
// Contoh:
//   node scripts/createAdmin.js pandawa_admin 'Pandawa#9441d3f3!'
// ======================================================

require("dotenv").config();

const bcrypt = require("bcrypt");

const db = require("../src/config/database");

const PASSWORD_MIN_LENGTH = 8;

function validatePassword(password) {
    if (typeof password !== "string" || password.length < PASSWORD_MIN_LENGTH) {
        return `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
    }

    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
        return "Password must contain both letters and numbers";
    }

    return null;
}

async function main() {
    const [username, password] = process.argv.slice(2);

    if (!username || !password) {
        console.error(
            "Usage: node scripts/createAdmin.js <username> <password>"
        );
        process.exit(1);
    }

    const passwordError = validatePassword(password);

    if (passwordError) {
        console.error(passwordError);
        process.exit(1);
    }

    const existing = await db.query(
        "SELECT id FROM admins WHERE username=$1",
        [username]
    );

    if (existing.rows.length > 0) {
        console.error(`Admin "${username}" already exists`);
        process.exit(1);
    }

    const hashed = await bcrypt.hash(password, 10);

    const result = await db.query(
        `
        INSERT INTO admins
        (
            username,
            password
        )
        VALUES
        ($1,$2)
        RETURNING id,username
        `,
        [username, hashed]
    );

    console.log(
        `Admin created: id=${result.rows[0].id} username=${result.rows[0].username}`
    );

    process.exit(0);
}

main().catch((error) => {
    console.error("Failed to create admin:", error.message);
    process.exit(1);
});
