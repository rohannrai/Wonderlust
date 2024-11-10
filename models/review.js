const { type } = require("express/lib/response");
const { ref } = require("joi");
const mongoose = require("mongoose");
const Schema = mongoose.Schema ;
const User = require("./user.js")

const reviewschema = new Schema({
    Comment :{
        type: String
    },
    rating:{
        type:Number,
        min:1,
        max:5
    },
    created_at :{
        type: Date,
        default: Date.now()
    },
    author : {
        type : Schema.Types.ObjectId ,
        ref : "User"
    }
})
module.exports = mongoose.model("review", reviewschema);