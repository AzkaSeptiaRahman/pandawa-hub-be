const express = require("express");
const router = express.Router();


const {
    getEvents,
    getEventDetail
} = require("../controllers/eventController");





// GET ALL EVENTS

router.get("/", getEvents);





// GET EVENT DETAIL

router.get("/:id", getEventDetail);




module.exports = router;