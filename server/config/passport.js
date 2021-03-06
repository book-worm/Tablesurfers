// config/passport.js

// load all the things we need
var FacebookStrategy = require('passport-facebook').Strategy;
var request = require('request-promise');

// load up the database holding the user model
var db = require('./db.js');

// load auth variables
var configAuth = require('./auth.js');

module.exports = function (passport) {

  // =========================================================================
  // passport session setup ==================================================
  // =========================================================================
  // required for persistent login sessions
  // passport needs ability to serialize and deserialize users out of session
  
  // used to serialize the user for the session
  // specifies what to use to identify the user (facebookId)
  // used upon login only
  passport.serializeUser(function (user, done) {
    done(null, user.facebookId);
  });
  
  // used to deserialize the user
  // called when authenticating on each page
  // takes facebookId and returns user again
  passport.deserializeUser(function (facebookId, done) {
    db.User.find({ where: {facebookId: facebookId} })
    .then(function (user) {
      done(null, user);
    })
    .catch(function (err) {
      done(err, null);
    });
  });

  // =========================================================================
  // FACEBOOK ================================================================
  // =========================================================================
  passport.use(new FacebookStrategy({

    // pull in our app id and secret from our auth.js file
    clientID        : configAuth.facebookAuth.clientID,
    clientSecret    : configAuth.facebookAuth.clientSecret,
    callbackURL     : configAuth.facebookAuth.callbackURL,
    profileFields   : ['emails', 'first_name', 'last_name', 'displayName']

  },

  // facebook will send back the token and profile
  function(token, refreshToken, profile, done) {
    var newUser = {};
    // asynchronous
    process.nextTick(function() {

      // find the user in the database based on their facebook id
      db.User.find({where: { 'facebookId' : profile.id }})
      .then(function (user) {
        console.log(token);
        // if the user is found, then log them in
        if (user) {
          return user.update({ // Update token
            token: token
          }).then(function (user) {
            done(null, user);  // user found, return that user
          });
        } else {
          console.log("MAKING USER");
          // if there is no user found with that facebook id, create them
          console.log(profile);
          // set all of the facebook information in our user model
          newUser.facebookId = profile.id; // set the users facebook id                   
          newUser.token      = token; // we will save the token that facebook provides to the user                    
          newUser.name       = profile.displayName; // look at the passport user profile to see how names are returned
          // newUser.email      = profile.emails[0].value; // facebook can return multiple emails so we'll take the first

          // save our user to the database
          return db.User.create(newUser)
          .then(function (user) {
            return request({method: "GET", uri: "https://graph.facebook.com/"+user.facebookId+"/picture?type=large&access_token="+user.token+"&redirect=false", json: true});
          })
          .then(function (resp) {
            return db.User.update(
              {profilePic: resp.data.url},
              {where : {facebookId: newUser.facebookId}}
            );
          })
          .then(function () {
            done(null, newUser);
          })
          .catch(function (err) {
            done(err, null);
          });
        }
      })
      .catch(function (err) {
        console.error("FB ERR", err);
        // if there is an error, stop everything and return that
        // is an error connecting to the database
        done(error);
      });
    });
  }));
};
