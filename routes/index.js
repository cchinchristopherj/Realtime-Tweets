var express = require('express');
// Express Routher middleware groups route handlers
// for a particular part of the site together for
// access using a common route-prefix.
var router = express.Router();
var controller = require('../controllers/controllers');

// Routes are defined with handler functions defined in 
// controllers.js 

// Main page
router.get('/',controller.main);

// URL handles post requests with data for realtime tweets
router.post('/tweets', controller.TweetObj.updateTables);

// URL handles post requests with data for state selected 
// by user (to filter tweets by)
router.post('/state',controller.state_post);

// URL handles post requests with data for keyword entered
// by user (to filter tweets by)
router.post('/keyword',controller.keyword_post);

// URL handles get requests informing server to delete
// all rows in the PostgreSQL database
router.get('/restart', controller.TweetObj.clearTables);

module.exports = router;