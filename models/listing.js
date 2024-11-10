const { type } = require("express/lib/response");
const mongoose = require("mongoose");
const Schema = mongoose.Schema ;
const reviews = require("./review.js");
const User = require("./user.js");
const listingschema = new Schema({
    title:  {
        type: String,
        required : true
    },
    description: String,
    image:{
        url:String,
        filename:String,  
    } ,
    price: Number,
    location: String,
    country: String,
    review:[
        {
            type: Schema.Types.ObjectId,
            ref: "review"
        }
    ],
    owner:{
        type : Schema.Types.ObjectId,
        ref:"User"}
})
listingschema.post("findOneAndDelete" , async(listing)=> {
   if(listing){
    await reviews.deleteMany({_id : {$in : listing.review}}); 
   }
})
const Listing = mongoose.model("Listing",listingschema);

module.exports = Listing;