const express = require("express");
const router = express.Router();

const multer = require("multer");

const authMiddleware =
require("../middleware/authMiddleware");


const {

    getEvents,
    getEventOptions,
    createEvent,
    updateEvent,
    deleteEvent

} = require("../controllers/adminEventController");





const upload = multer({

    dest:"uploads/events"

});





router.use(authMiddleware);





// GET ALL EVENTS

router.get(
    "/",
    getEvents
);





// DROPDOWN EVENT

router.get(
    "/options",
    getEventOptions
);






// CREATE EVENT

router.post(

    "/",

    upload.single("thumbnail"),

    createEvent

);







// UPDATE EVENT

router.put(

    "/:id",

    upload.single("thumbnail"),

    updateEvent

);







// DELETE EVENT

router.delete(

    "/:id",

    deleteEvent

);






module.exports = router;