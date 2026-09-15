require("dotenv").config();

const express = require("express");

const cors = require("cors");

const helmet = require("helmet");

const rateLimit = require("express-rate-limit");

const path = require("path");


const eventRoutes = require("./routes/eventRoutes");

const photoRoutes = require("./routes/photoRoutes");

const downloadRoutes = require("./routes/downloadRoutes");



const app = express();



const PORT = process.env.PORT || 5000;





// Security

app.use(
    helmet()
);



app.use(
    cors({

        origin:
        process.env.FRONTEND_URL,

        methods:[
            "GET",
            "POST"
        ]

    })
);





// Limit request

const limiter = rateLimit({

    windowMs:15 * 60 * 1000,

    max:100,

    message:{
        message:"Too many requests"
    }

});


app.use(
    limiter
);





// Body parser

app.use(
    express.json()
);





// Static

app.use(

    "/uploads",

    express.static(

        path.join(
            __dirname,
            "../uploads"
        )

    )

);





// Routes

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





// Health check

app.get("/",(req,res)=>{

    res.json({

        message:
        "Pandawa API Running"

    });

});






// Global error handler

app.use(
    (err,req,res,next)=>{


        console.error(err);


        res.status(500).json({

            message:
            "Internal Server Error"

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