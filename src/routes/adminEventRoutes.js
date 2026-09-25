const express = require("express");

const router = express.Router();


const authMiddleware =
require("../middleware/authMiddleware");

const {
    createImageUpload
} = require("../config/upload");



const {

    getEvents,

    getEventOptions,

    createEvent,

    updateEvent,

    deleteEvent,

    uploadGallery,

    addHighlight,

    updateMedia,

    deleteMedia


} = require("../controllers/adminEventController");









// ======================================
// MULTER CONFIG
// ======================================


// Event thumbnail

const eventUpload =
    createImageUpload({
        fileSize: 10 * 1024 * 1024,
        files: 1
    });




// Gallery multiple upload

const galleryUpload =
    createImageUpload({
        fileSize: 10 * 1024 * 1024,
        files: 50
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











// UPDATE MEDIA TITLE


router.put(

    "/media/:id",

    updateMedia

);





// DELETE MEDIA


router.delete(

    "/media/:id",

    deleteMedia

);









module.exports = router;