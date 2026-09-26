require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const eventRoutes = require("./routes/eventRoutes");
const photoRoutes = require("./routes/photoRoutes");
const downloadRoutes = require("./routes/downloadRoutes");
const authRoutes = require("./routes/authRoutes");
const adminEventRoutes = require("./routes/adminEventRoutes");
const adminGraduateRoutes = require("./routes/adminGraduateRoutes");
const adminPhotoRoutes = require("./routes/adminPhotoRoutes");
const adminUserRoutes = require("./routes/adminUserRoutes");

const {
    cleanupStaleZipTemps
} = require("./config/upload");

const app = express();

// Di belakang reverse proxy, IP asli pengirim ada di X-Forwarded-For.
// Tanpa ini rate limit akan melihat IP proxy dan membatasi SEMUA
// pengguna sebagai satu IP (atau bisa dilewati).
if (process.env.TRUST_PROXY === "1") {

    app.set("trust proxy", 1);

}


const PORT = process.env.PORT || 5000;

// =====================================
// SECURITY
// =====================================

app.use(
    helmet({
        crossOriginResourcePolicy: false
    })
);

// =====================================
// CORS
// =====================================

app.use(
    cors({
        origin:
            process.env.FRONTEND_URL ||
            "http://localhost:3000",

        methods: [
            "GET",
            "POST",
            "PUT",
            "DELETE"
        ],

        credentials: true
    })
);

// =====================================
// RATE LIMIT
// =====================================

app.use(
    rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 100,

        // Progress bulk upload di-polling tiap beberapa detik selama
        // proses berjalan, jadi endpoint statusnya harus dikecualikan
        // agar tidak menghabiskan jatah limit global.
        skip: (req) =>
            req.originalUrl.split("?")[0] ===
            "/api/admin/photos/bulk-upload/status"
    })
);

// =====================================
// BODY PARSER
// =====================================

app.use(
    express.json({
        limit: "10mb"
    })
);

app.use(
    express.urlencoded({
        extended: true,
        limit: "10mb"
    })
);

// =====================================
// REQUEST LOG
// =====================================

app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});

// =====================================
// PUBLIC ROUTES
// =====================================

app.use(
    "/api/events",
    eventRoutes
);

app.use(
    "/api/photos",
    photoRoutes
);

app.use(
    "/api/download",
    downloadRoutes
);

// =====================================
// ADMIN AUTH
// =====================================

app.use(
    "/api/admin",
    authRoutes
);

// =====================================
// ADMIN EVENTS
// =====================================

app.use(
    "/api/admin/events",
    adminEventRoutes
);

// =====================================
// ADMIN GRADUATES
// =====================================

app.use(
    "/api/admin/graduates",
    adminGraduateRoutes
);

// =====================================
// ADMIN PHOTOS
// =====================================

app.use(
    "/api/admin/photos",
    adminPhotoRoutes
);

// =====================================
// ADMIN USERS
// =====================================

app.use(
    "/api/admin/users",
    adminUserRoutes
);

// =====================================
// HEALTH CHECK
// =====================================

app.get("/", (req, res) => {
    res.json({
        message: "Pandawa API Running"
    });
});

// =====================================
// ERROR HANDLER
// =====================================

app.use((err, req, res, next) => {
    console.error(err);

    // Error dari multer (validasi upload) -> 400, bukan 500
    if (err && err.name === "MulterError") {
        return res.status(400).json({
            message:
                err.code === "LIMIT_FILE_SIZE"
                    ? "File is too large"
                    : err.message
        });
    }

    // Error dari fileFilter / upload lain yang menandai status-nya
    if (err && Number.isInteger(err.status)) {
        return res.status(err.status).json({
            message: err.message
        });
    }

    res.status(500).json({
        message: "Internal server error"
    });
});

// =====================================
// START SERVER
// =====================================

// =====================================
// CONFIG CHECK
// =====================================

if (!process.env.JWT_SECRET) {

    console.error(

        "FATAL: JWT_SECRET is not set. Add it to your environment."

    );

    process.exit(1);

}

const server = app.listen(
    PORT,
    () => {
        console.log(
            `Server running on port ${PORT}`
        );
    }
);

// Bulk upload ZIP bisa berukuran besar dan berjalan lama.
// Timeout default (5 menit) akan memutus upload yang belum selesai,
// jadi diperpanjang. Nilai 0 = tanpa batas selama transfer berjalan.
server.requestTimeout = 0;
server.headersTimeout = 120000;
server.timeout = 0;

// Bersihkan sisa file ZIP sementara dari proses sebelumnya
// (mis. server sempat mati di tengah upload) agar disk tidak penuh.
cleanupStaleZipTemps().then((removed) => {
    if (removed > 0) {
        console.log(
            `Removed ${removed} stale bulk ZIP temp file(s).`
        );
    }
});