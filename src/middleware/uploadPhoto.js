const multer = require("multer");
const path = require("path");


const storage = multer.diskStorage({

    destination:(req,file,cb)=>{

        cb(
            null,
            "uploads/photos"
        );

    },


    filename:(req,file,cb)=>{


        const filename =
        Date.now()
        +
        "-"
        +
        file.originalname;


        cb(
            null,
            filename
        );


    }

});




const upload = multer({

    storage:storage,

    limits:{

        fileSize:
        10 * 1024 * 1024

    }

});



module.exports = upload;