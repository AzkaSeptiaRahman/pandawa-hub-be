const jwt = require("jsonwebtoken");

// Token berumur pendek yang diterbitkan oleh /api/photos/search
// setelah mahasiswa ditemukan. Dipakai untuk mengamankan
// GET /api/download/:graduateId agar tidak bisa dienumerasi.

const DOWNLOAD_SCOPE = "photo-download";

const getExpiresIn = () =>
    parseInt(
        process.env.DOWNLOAD_TOKEN_EXPIRES || "900",
        10
    );

const signDownloadToken = (graduateId) =>
    jwt.sign(
        {
            graduateId: String(graduateId),
            scope: DOWNLOAD_SCOPE
        },
        process.env.JWT_SECRET,
        {
            expiresIn: getExpiresIn()
        }
    );

const downloadAuth = (req, res, next) => {
    try {
        const token =
            req.query.token ||
            (req.headers.authorization || "").split(" ")[1];

        if (!token) {
            return res.status(401).json({
                message: "Download token required"
            });
        }

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        if (decoded.scope !== DOWNLOAD_SCOPE) {
            return res.status(401).json({
                message: "Invalid download token"
            });
        }

        if (String(decoded.graduateId) !== String(req.params.graduateId)) {
            return res.status(403).json({
                message: "Download token does not match graduate"
            });
        }

        req.download = decoded;

        next();

    } catch (error) {
        return res.status(401).json({
            message: "Invalid or expired download token"
        });
    }
};

module.exports = {
    downloadAuth,
    signDownloadToken
};
