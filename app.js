//jshint esversion:6
require("dotenv").config();
const express=require("express");
const bodyparser=require("body-parser");
const ejs=require("ejs");
const app=express();
const mongoose =require("mongoose");
const session=require("express-session");
const passport=require("passport");
const passportLocalMongoose=require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require('mongoose-findorcreate')
// const encrypt=require("mongoose-encryption");
// const md5=require("md5");
// const bcrypt=require("bcrypt");
// const { Console } = require("console");
// const saltrounds=10;

app.use(express.static("public"));
app.set('view engine','ejs');
app.use(bodyparser.urlencoded({extended:true}));
app.use(session({secret:"Our little secret.",
resave:false,
saveUninitialized:false
}));

app.use(passport.initialize());  //setting up passport
app.use(passport.session());

mongoose.connect("mongodb://127.0.0.1/userDB",{useNewUrlParser:true});
const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  googleId: String,
  secret:String
});
userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);
// userSchema.plugin(encrypt,{secret:process.env.SECRET,encryptedFields:["password"]});
const User=mongoose.model("User",userSchema);
passport.use(User.createStrategy());
passport.serializeUser(function(user, done) {     //creating a cookie
  done(null, user.id);
});
passport.deserializeUser(function (id, done) {      //destroying the cookie
  User.findById(id)
    .then(function (user) {
      done(null, user);
    })
    .catch(function (err) {
      done(err, null);
    });
});
passport.use(new GoogleStrategy({
  clientID: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  callbackURL: "http://localhost:3000/auth/google/secrets"
},
function(accessToken, refreshToken, profile, cb) {
  console.log(profile);
  User.findOrCreate({ googleId: profile.id }, function (err, user) {
    return cb(err, user);
  });
}
));

app.get("/",function(req,res){
   res.render("home");
});
app.get("/auth/google",
  passport.authenticate('google', { scope: ["profile"] })
);

app.get("/auth/google/secrets",
  passport.authenticate('google', { failureRedirect: "/login" }),
  function(req, res) {
    // Successful authentication, redirect to secrets.
    res.redirect("/secrets");
  });
app.get("/login",function(req,res){
   res.render("login");
});
app.get("/register",function(req,res){
   res.render("register");
});
// app.get("/secrets",function(req,res){
//     User.find({"secret":{$ne:null}}).then(function(foundUsers){
//       if(foundUsers)
//       res.render("secrets",{userWithSecrets:foundUsers});
//     }).catch(function(err){
//       console.log(err);
//     })
// });
app.get("/secrets", function(req, res) {
  if (req.isAuthenticated()) {
    User.find({ "secret": { $ne: null } }).then(function(foundUsers) {
      if (foundUsers) {
        res.render("secrets", { userWithSecrets: foundUsers });
      }
    }).catch(function(err) {
      console.log(err);
    });
  } else {
    res.redirect("/login"); // Redirect to the login page if the user is not authenticated
  }
});

app.get("/submit",function(req,res){
  if(req.isAuthenticated())
  res.render("submit");
  else 
  res.redirect("/login");
})
app.get("/logout", (req, res) => {
    req.logout(req.user, err => {
      if(err) return next(err);
      res.redirect("/");
    });
  });

app.post("/submit",function(req,res){
    const submittedSecret=req.body.secret;
    User.findById(req.user.id).then(function(foundUser){
      if(foundUser){
      foundUser.secret=submittedSecret;
      foundUser.save().then(function(){
        res.redirect("/secrets");
      }).catch(function(err){
        console.log(err);
      })
    }
    }).catch(function(err){
      console.log(err);
    })
});
app.post("/register",function(req,res){
    // bcrypt.hash(req.body.password,saltrounds,function(err,hash){
    //     const user=new User({
    //         email:req.body.username,
    //         password:hash
    //     })
    //     user.save().then(function(){
    //         res.render("secrets");
    //     }).catch(function(err){
    //         res.send(err);
    //     });
    // })

    User.register({username:req.body.username},req.body.password,function(err,user){
        if(err){
            console.log(err);
            res.redirect("/register");
        }
        else{
            passport.authenticate("local")(req,res,function(){
                res.redirect("/secrets");
            })
        }
    });
});
app.post("/login",function(req,res){
    // User.findOne({email:req.body.username}).then(function(foundUser){
    //     if(foundUser){
    //         bcrypt.compare(req.body.password,foundUser.password,function(err,result){
    //             if(result)
    //             res.render("secrets");
    //             else 
    //             res.send("Incorrect password");
    //     })}
    //     }).catch(function(err){
    //         res.send("Sorry !!! Either of your username or password is incorrect");
    //     })
        const user=new User({
            username:req.body.username,
            password:req.body.password
        });
        req.login(user,function(err){
            if(err)
            console.log(err);
            else{
                passport.authenticate("local")(req,res,function(){
                    res.redirect("/secrets");
                })
            }
        })
    });
        
app.listen(3000,function(){
    console.log("Server set up on port 3000")
});