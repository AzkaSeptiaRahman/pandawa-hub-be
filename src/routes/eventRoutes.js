const express = require("express");
const router = express.Router();


const db = require("../config/database");

const {
    getEventDetail
} = require("../controllers/eventController");





// GET ALL EVENTS

router.get("/", async(req,res)=>{

    try{

        const result = await db.query(
            `
            SELECT *
            FROM events
            ORDER BY id ASC
            `
        );


        res.json(result.rows);


    }catch(error){

        res.status(500).json({
            message:error.message
        });

    }


});





// GET EVENT DETAIL

router.get("/:id", getEventDetail);




module.exports = router;