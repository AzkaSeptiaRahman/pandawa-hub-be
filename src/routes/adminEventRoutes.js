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

    deleteEvent,

    uploadGallery,

    addHighlight,

    deleteMedia


} = require("../controllers/adminEventController");









// ======================================
// MULTER CONFIG
// ======================================


// Event thumbnail

const eventUpload = multer({

    dest:"uploads/events"

});





// Gallery multiple upload

const galleryUpload = multer({

    dest:"uploads/events/gallery"

});









// ======================================
// AUTH
// ======================================

router.use(authMiddleware);









// ======================================
// EVENT CRUD
// ======================================


// GET ALL ADMIN EVENTS

router.get(

    "/",

    getEvents

);









// EVENT DROPDOWN

router.get(

    "/options",

    getEventOptions

);









// CREATE EVENT
// thumbnail

router.post(

    "/",

    eventUpload.single("thumbnail"),

    createEvent

);









// UPDATE EVENT

router.put(

    "/:id",

    eventUpload.single("thumbnail"),

    updateEvent

);









// DELETE EVENT

router.delete(

    "/:id",

    deleteEvent

);









// ======================================
// EVENT MEDIA MANAGEMENT
// ======================================







// UPLOAD GALLERY PHOTO
//
// FormData:
//
// event_id
// photos[]


router.post(

    "/media/gallery",

    galleryUpload.array(
        "photos",
        50
    ),

    uploadGallery

);











// ADD HIGHLIGHT
//
// JSON:
//
// {
//   event_id,
//   title,
//   url
// }


router.post(

    "/media/highlight",

    addHighlight

);











// DELETE MEDIA


router.delete(

    "/media/:id",

    deleteMedia

);









module.exports = router;