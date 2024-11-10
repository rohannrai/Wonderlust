const express = require("express");
const app = express();
const session = require("express-session");
const path = require("path");
const flash = require("connect-flash");

app.use(flash());
app.use(session({secret : "mysecretstring",
    resave: false ,
saveUninitialized:true
}) 
);
app.set("view engine" ,"ejs");
app.set("views",path.join(__dirname, "views"));

app.get("/register" , (req,res)=>{
   let {name = "anonymous"} = req.query;
   req.session.name = name ;
   req.flash("success" , "registered successfully");
   res.redirect("/hello")
})
app.get("/hello" , (req,res)=>{
    res.render("register.ejs", { name : req.session.name , msg : req.flash('success')});
    })

app.listen("3000", ()=>{
    console.log("server started");
});