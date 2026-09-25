require("dotenv").config();

const { Pool } = require("pg");


const pool = new Pool({

    host: process.env.DB_HOST,

    port: process.env.DB_PORT,

    database: process.env.DB_NAME,

    user: process.env.DB_USER,

    password: process.env.DB_PASSWORD

});


// Klien idle yang error (mis. koneksi diputus server) tidak boleh
// menjatuhkan proses. Tanpa handler ini, pg melempar uncaught exception.
pool.on(
    "error",
    (error)=>{

        console.error(
            "Unexpected database pool error:",
            error.message
        );

    }
);


module.exports = pool;