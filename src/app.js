require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");



const eventRoutes = require("./routes/eventRoutes");
const photoRoutes = require("./routes/photoRoutes");
const downloadRoutes = require("./routes/downloadRoutes");

const authRoutes = require("./routes/authRoutes");

const adminEventRoutes = require("./routes/adminEventRoutes");
const adminGraduateRoutes = require("./routes/adminGraduateRoutes");
const adminPhotoRoutes = require("./routes/adminPhotoRoutes");




const app = express();


const PORT = process.env.PORT || 5000;





// SECURITY

app.use(

    helmet({

        crossOriginResourcePolicy:false

    })

);






// CORS

app.use(

    cors({

        origin:
        process.env.FRONTEND_URL || "http://localhost:3000",

        methods:[

            "GET",
            "POST",
            "PUT",
            "DELETE"

        ],

        credentials:true

    })

);







// RATE LIMIT

app.use(

    rateLimit({

        windowMs:
        15 * 60 * 1000,

        max:100

    })

);








// BODY PARSER

app.use(

    express.json({

        limit:"10mb"

    })

);



app.use(

    express.urlencoded({

        extended:true,

        limit:"10mb"

    })

);








// REQUEST LOG

app.use((req,res,next)=>{


    console.log(
        `${req.method} ${req.url}`
    );


    next();


});








// STATIC FILE

app.use(

    "/uploads",

    express.static(

        path.join(

            __dirname,

            "../uploads"

        )

    )

);








// PUBLIC

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








// ADMIN AUTH

app.use(

    "/api/admin",

    authRoutes

);








// ADMIN EVENT

app.use(

    "/api/admin/events",

    adminEventRoutes

);








// ADMIN GRADUATE

app.use(

    "/api/admin/graduates",

    adminGraduateRoutes

);








// ADMIN PHOTO

app.use(

    "/api/admin/photos",

    adminPhotoRoutes

);








// HEALTH

app.get(

    "/",

    (req,res)=>{


        res.json({

            message:
            "Pandawa API Running"

        });


    }

);








// ERROR

app.use(

    (err,req,res,next)=>{


        console.error(err);


        res.status(500).json({

            message:
            err.message

        });


    }

);








app.listen(

    PORT,

    ()=>{


        console.log(

            `Server running on port ${PORT}`

        );


    }

);