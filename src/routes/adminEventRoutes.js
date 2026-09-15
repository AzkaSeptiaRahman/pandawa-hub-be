const express = require("express");

const router = express.Router();


const authMiddleware = require("../middleware/authMiddleware");


const adminEventController = require("../controllers/adminEventController");



const {
    getEvents,
    createEvent,
    deleteEvent
} = adminEventController;




// DEBUG sementara
console.log({
    getEvents: typeof getEvents,
    createEvent: typeof createEvent,
    deleteEvent: typeof deleteEvent
});





// Semua endpoint event CMS wajib login

router.use(authMiddleware);







// GET ALL EVENTS
// GET /api/admin/events

router.get(
    "/",
    getEvents
);







// CREATE EVENT
// POST /api/admin/events

router.post(
    "/",
    createEvent
);







// DELETE EVENT
// DELETE /api/admin/events/:id

router.delete(
    "/:id",
    deleteEvent
);







module.exports = router;