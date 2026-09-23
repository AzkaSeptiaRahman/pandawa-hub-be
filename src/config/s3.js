require("dotenv").config();

const {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand
} = require("@aws-sdk/client-s3");

const {
    getSignedUrl
} = require("@aws-sdk/s3-request-presigner");

const s3Client = new S3Client({

    region:
    process.env.S3_REGION || "us-east-1",

    endpoint:
    process.env.S3_ENDPOINT,

    // true untuk MinIO, Cloudflare R2, Backblaze B2, dll.
    // false untuk AWS S3 asli.

    forcePathStyle:
    process.env.S3_FORCE_PATH_STYLE === "true",

    credentials: {

        accessKeyId:
        process.env.S3_ACCESS_KEY_ID,

        secretAccessKey:
        process.env.S3_SECRET_ACCESS_KEY

    }

});

const BUCKET = process.env.S3_BUCKET;

const PRESIGN_EXPIRES = parseInt(
    process.env.S3_PRESIGN_EXPIRES || "3600",
    10
);

// Upload file (body: Buffer / stream / string)

const uploadObject = async(
    key,
    body,
    contentType
)=>{

    await s3Client.send(

        new PutObjectCommand({

            Bucket: BUCKET,

            Key: key,

            Body: body,

            ContentType: contentType

        })

    );

};

// Ambil stream file dari bucket (untuk di-zip saat download)

const getObjectStream = async(
    key
)=>{

    const result = await s3Client.send(

        new GetObjectCommand({

            Bucket: BUCKET,

            Key: key

        })

    );

    return result.Body;

};

// Hapus file dari bucket

const deleteObject = async(
    key
)=>{

    await s3Client.send(

        new DeleteObjectCommand({

            Bucket: BUCKET,

            Key: key

        })

    );

};

// URL presigned (akses privat sementara) — dipakai jika bucket private

const getPresignedUrl = async(
    key,
    expiresIn
)=>{

    return getSignedUrl(

        s3Client,

        new GetObjectCommand({

            Bucket: BUCKET,

            Key: key

        }),

        {

            expiresIn:
            expiresIn || PRESIGN_EXPIRES

        }

    );

};

// URL yang bisa diakses publik.
// Jika S3_PUBLIC_URL diset, pakai itu (bucket public / CDN),
// jika tidak, buat presigned URL.

const getPhotoUrl = async(
    key
)=>{

    if(process.env.S3_PUBLIC_URL){

        return `${process.env.S3_PUBLIC_URL}/${key}`;

    }

    return getPresignedUrl(
        key
    );

};

module.exports = {

    uploadObject,

    getObjectStream,

    deleteObject,

    getPresignedUrl,

    getPhotoUrl

};
