if(process.env.NODE_ENV != "production"){
    require("dotenv").config();
}
const express = require("express");
const app = express();  
const mongoose = require("mongoose");
const path = require("path");
const Listing = require("./models/listing.js");
const methodoverride = require("method-override");
const ejsMate = require("ejs-mate");
const wrapasync = require("./public/utils/wrapasync.js");
const Expresserror = require("./public/utils/expresserror.js");
const MONGO_URL = process.env.DBUrl;
const {listingschema} = require("./schema.js");
const review = require("./models/review.js");
const {reviewSchema} = require("./schema.js");
const session = require("express-session");
const Mongostore = require("connect-mongo");
const flash = require("connect-flash");
const User = require("./models/user.js");
const passport = require("passport");
const Localstrategy = require("passport-local");
const multer = require("multer");
const{storage} = require("./cloudinary.js");
const upload = multer({  storage })
const bodyParser = require('body-parser');
const { google } = require('googleapis');

const KEY_PATH = path.join(__dirname, '/credentials.json');
const SPREADSHEET_ID = '1BeOQ5wIgOT08r-2eUZ6te8wHyo6f7qhn19cmBUo2rmk';
const RANGE = 'Sheet1!A1:D1';

main().then(
    () => { console.log("server connected to Db")}
).catch((err)=> {
    console.log(err);
})

async function main () {
    await mongoose.connect(MONGO_URL);
    };

app.set("view engine" ,"ejs");
app.set("views",path.join(__dirname, "views"));
app.use(express.urlencoded({extended:true}));
app.use(methodoverride("_method"));
app.engine("ejs", ejsMate);
app.use(bodyParser.json());
const store = Mongostore.create({
    mongoUrl: MONGO_URL,
    crypto:{
        secret:process.env.SECRET ,
    },
    touchAfter : 24*3600,
})

store.on("error", ()=>{
console.log("error in mongo store" , err)
});

app.use(session({
    store,
    secret:process.env.SECRET,
    resave:false,
    saveUninitialized: true,
    cookie:{
        expires : Date.now() + 7*24*60*60*1000 ,
        maxAge : 7*24*60*60*1000 ,
        httpOnly : true
    }}
));

app.use(express.static(path.join(__dirname , "public")));
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());
app.use(bodyParser.urlencoded({ extended: true }));
passport.use( new Localstrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());


app.use((req,res,next) =>{
    res.locals.success = req.flash("success");
    res.locals.error = req.flash("error");
    res.locals.signed =  req.flash("signed");
    res.locals.curruser = req.user;
    next();
});
async function authenticate() {
    const auth = new google.auth.GoogleAuth({
      keyFile: KEY_PATH,
      scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive'],
    });
  
    const client = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: client });
  
    return sheets;
  }
  async function appendToSheet(spreadsheetId, range, values) {
    try {
      const sheets = await authenticate();  // Authenticate and get sheets client
  
      const resource = {
        values: [values],  // Values to append as a 2D array
      };
  
      const response = await sheets.spreadsheets.values.append({
        spreadsheetId,
        range,
        valueInputOption: 'RAW',  // You can use 'RAW' or 'USER_ENTERED' depending on your need
        resource,
      });
  
      return response.data;
    } catch (error) {
      console.error('Error appending data to Google Sheets:', error);
      throw error;
    }
  }
  
  
const validatelisting = ( req, res, next) => {
    let {error} = listingschema.validate(req.body);
if(error){
    let errMsg = error.details.map((el) => el.message ).join(",")
    throw new Expresserror (404, errMsg )
 }else{
    next();
 }
};
const validatereview = ( req, res, next) => {
    let {error} = reviewSchema.validate(req.body);
if(error){
    let errMsg = error.details.map((el) => el.message ).join(",")
    throw new Expresserror (404, errMsg )
 }else{
    next();
 }
};

const loggedIn = (req,res,next) =>{
    if(!req.isAuthenticated()){
        req.session.redirectUrl = req.originalUrl;
        req.flash("error" , " you must be logged in before adding a new list ");
        res.redirect("/login");
        
    }else{
        next();
    }
   
};
const saveredirecturl = (req,res,next) =>{
    if(req.session.redirectUrl){
        res.locals.redirectUrl = req.session.redirectUrl;
        console.log()
        }
            next();
        

}
const isowner = async(req,res,next) =>{
    let {id} = req.params;
    let listing = await Listing.findById(id)
     if(!listing.owner._id.equals(res.locals.curruser._id)){
         req.flash("error" , " You are not the owner of this listing");
         return res.redirect(`/listings/${id}`)
     }

     next();
}
const isreviewowner = async(req,res,next) =>{
    let {id, reviewid} = req.params;
    let Review = await review.findById(reviewid)
     if(!Review.author._id.equals(res.locals.curruser._id)){
         req.flash("error" , " You are not the Author of this Review");
         return res.redirect(`/listings/${id}`)
     }

     next();
};

app.get("/" , (req,res) =>{
    res.redirect("/listings");
})
// index route 
app.get("/listings", wrapasync(async (req,res) => {
    let alllistings = await Listing.find({});
    res.render("./listings/index.ejs" , {alllistings});
}));
// new listing form route
app.get("/listings/new",loggedIn, (req,res)=>{
 res.render("./listings/new.ejs");
})
// new listing post route
app.post("/listings"  , upload.single("Listings[image]"), wrapasync(async(req,res,next) => {
let url =    req.file.path;
let filename = req.file.filename;
const newlisting = new Listing(req.body.Listings);
 newlisting.owner = req.user._id;
 newlisting.image = {url,filename};
 await newlisting.save();
 req.flash("success" , "new listing successfully added ");
   res.redirect("/listings");
})
)
// show listing route
app.get("/listings/:id",wrapasync( async(req,res)=> {
    let {id} = req.params;
    const list = await Listing.findById(id).populate({
        path : "review",
        populate : {
            path: "author"
        },
    }).populate("owner");
    if(!list){
        req.flash("error" , " Listing does not exist ");
        res.redirect("/listings")
    }else{
        res.render("./listings/show.ejs" , {list});
    }
    
}));
// edit listing route
app.get("/listings/:id/edit" , loggedIn,isowner, async (req,res)=>{
    let {id} = req.params;
    const listing = await Listing.findById(id);
    if(!listing){
        req.flash("error" , " Listing does not exist ");
        res.redirect("/listings");
    }else{res.render("./listings/edit.ejs" , {listing}) }
    
});
// put
app.put("/listings/:id",isowner, upload.single("Listings[image]") ,wrapasync(async (req,res) => {
    let {id} = req.params;
   let listing = await Listing.findById(id)
    if(!listing.owner._id.equals(res.locals.cuRuser._id)){
        req.flash("error" , "you dont have permission to edit this listing");
        return res.redirect(`/listings/${id}`)
    }
   let listings =  await Listing.findByIdAndUpdate(id,{...req.body.Listings});
   if(typeof req.file != "undefined"){
    let url = req.file.path;
    let filename = req.file.filename;
    listings.image = {url,filename};
     await listings.save()
   }
    req.flash("success" , "Listing Updated ")
    res.redirect(`/listings/${id}`)
}));
// Delete route
app.delete("/listings/:id",loggedIn,isowner, wrapasync( async (req,res)=>{
    let {id}= req.params;
    const listing = await Listing.findByIdAndDelete(id);
    console.log(listing);
    req.flash("success" ,  " Deleted successfully")
    res.redirect("/listings")
}))
app.get("/listingssearch" , async(req,res) =>{
    let {city} = req.query
    const list = await Listing.find({State : city})
    res.render("./listings/search.ejs", {list})
})
// reviews 
//Post route
app.post("/listings/:id/reviews" ,loggedIn, validatereview, wrapasync(async (req,res)=>{
let listing = await Listing.findById(req.params.id);
let newReview = await review(req.body.review);
newReview.author = req.user._id;
listing.review.push(newReview);

await newReview.save();
await listing.save();
 
console.log("both reviews and listing saved");
req.flash("success" , "new Review successfully added ")
res.redirect(`/listings/${listing._id}`)
}
));

// reviews delete route
app.delete("/listings/:id/reviews/:reviewid",loggedIn,isreviewowner,wrapasync(async(req , res )=>{
    let {id , reviewid} = req.params;
    await Listing.findByIdAndUpdate(id,{$pull : { review: reviewid}});
    await review.findByIdAndDelete(reviewid)
    req.flash("success" , "Review Deleted successfully")
    res.redirect(`/listings/${id}`)
}));

app.get("/listings/:id/booknow" , async (req,res) =>{
    let {id} = req.params;
   let hotel =  await Listing.findById(id).populate("owner")
   console.log(hotel)
    res.render("./bookings/booknow.ejs" , {hotel})
})
 /*app.get("/demouser" , async ( req,res) =>{
    let fakeuser = new User({
        email:"rohan@gmail.com",
        username: "rohanrai"
    });
 let registereduser =  await  User.register(fakeuser , "rohan123");
 res.send(registereduser);
})*/

// login form get req 
app.get("/signup" , (req,res) =>{
    res.render("./Users/form.ejs");
})
// post route for login 
app.post("/signup" , wrapasync( async ( req,res) =>{
 try{
    let { username , email , password } = req.body ;
    const  user = {username , email};
    const registereduser =  await  User.register(user, password);
    console.log(registereduser);
    req.login(registereduser , (err) =>{
        if(err){
            return next(err);
        }else{
            req.flash("signed" , " Hii Welcome to WonderLust!!" )
            res.redirect("/listings")
        }})
    }catch(e){
    req.flash("error" , "A user with the given username is already registered");
    res.redirect("/signup")
 }
}));

app.get("/login" , (req,res) =>{
    res.render("./Users/login.ejs");
});
app.post('/submit', async (req, res) => {
    const { name, hotel , owner , From , To} = req.body;
  
    // Google Sheets details
    const spreadsheetId = '1BeOQ5wIgOT08r-2eUZ6te8wHyo6f7qhn19cmBUo2rmk'; // Replace with your Google Sheet ID
    const range = 'Sheet1!A:E'; // Specify the range you want to write to (Sheet1, columns A and B)
  
    try {
      // Append the form data (name, email) to Google Sheets
      const response = await appendToSheet(spreadsheetId, range, [ name, hotel , owner , From , To]);
      console.log('Data successfully added:', response);
      res.redirect("/listings")
    } catch (error) {
      res.status(500).send('Error submitting the form.');
      console.log(error)
    }
   
  });

app.post("/login" ,saveredirecturl,  passport.authenticate( "local" , { 
    failureRedirect:"/login", 
    failureFlash: true
}), async(req,res)=>{
    req.flash("success", "welcome back to WonderLust!! You are Logged in !!");
    let redirecturl = res.locals.redirectUrl || "/listings"
    res.redirect(redirecturl);
});
app.get("/logout" , (req,res,next) =>{
   req.logOut((err) =>{
    if(err) {
        next(err);
   }else{
    req.flash("success" , "you have been successfully logout");
    res.redirect("/listings")
   }});
})

/* app.get("/samplechat", async (req,res)=>{
    let samplelList = new Listing({
        title: "my new villa ",
        description: "by the beach",
        price: 1200 , 
        location: "calangute , goa",
        country: "india"
    })
    samplelList.save();
    console.log("sample chat was saved");
    res.send("sucessfully saved");
})*/ 

app.all("*" , (req,res,next)=>{
    next(new Expresserror(404,"page not found!"));
  });
app.use((err,req,res,next)=>{
    let{statuscode=500,message="Something went wrong"}= err;
    res.render("error.ejs" , {message});
})

app.listen("8080", ()=>{
    console.log("server started");
});
