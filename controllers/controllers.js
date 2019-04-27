// Modules for validation and sanitization
const {body,validationResult} = require('express-validator/check');
const {sanitizeBody}=require('express-validator/filter');
// Don't use dotenv during production (environment variables drawn
// from defined config vars in Heroku)
if (process.env.NODE_ENV !== 'production') { require('dotenv').config({path:'.env'}) }
var path = require('path');
// Use a connection pool to make frequent 
// queries to the PostgreSQL Db
const pg = require('pg');
// Connect to the pool
const pool = new pg.Pool({
    connectionString:process.env.DATABASE_URL
});
// Pusher is a hosted service that adds realtime 
// functionality to web applications (persistent
// connections push new data from servers to
// clients in realtime).
const Pusher = require('pusher');
// Connect to Pusher
const pusher = new Pusher({
    appId:process.env.PUSHER_APP_ID,
    key:process.env.PUSHER_APP_KEY,
    secret:process.env.PUSHER_APP_SECRET,
    cluster:process.env.PUSHER_APP_CLUSTER,
    encrypted:true,
});
// Connect to the pool
pool.connect(function(err,client){
    if(err){
        console.log(err);
    }
    // On a notification event, make a Pusher trigger with the
    // first argument being the channel name and the second 
    // argument being the payload. The Pusher trigger sends
    // the payload to the specified channel (in realtime). 
    client.on('notification',function(msg){
        pusher.trigger('watch_realtime_table','new_record',JSON.parse(msg.payload));
    });
    // Execute a query to listen for notifications on the
    // specified channel
    const query = client.query('LISTEN watch_realtime_table');
});

// The state_bounding_boxes.csv file in the public folder
// contains the bounding box data for each of the fifty US
// states. Each row in the .csv file corresponds to a 
// different state. Each row will be read in as an object
// with one property for each column, and each object
// added as a new element to the array "state_locs"
// csv module for reading in .csv file
var csv = require('csv');
var obj = csv();
// Array to hold each row in the .csv file
var state_locs = [];

/**
 * The data in each row of the .csv file will be converted
 * into a new object with one property for each column
 * @param States Name of the state
 * @param West Maximum longitude
 * @param East Minimum longitude
 * @param North Maximum latitude
 * @param East Minimum latitutde
 */
function MyCSV(States,West,East,North,South){
    this.States = States;
    this.West = West;
    this.East = East;
    this.North = North;
    this.South = South;
}

// Load in state_bounding_boxes.csv file and add
// data from each row as a new object to "state_locs"
obj.from.path(path.join(__dirname,"../public/files/state_bounding_boxes.csv")).to.array(function(data){
    for(var index=0;index<data.length;index++){
        state_locs.push(new MyCSV(data[index][0],data[index][1],data[index][2],data[index][3],data[index][4]));
    }
})

// Sentiment module analyzes text and outputs a
// score indicating how "positive" or "negative" 
// the text is, with +5 being the maximum
// positive score and -5 being the maximum 
// negative score
var Sentiment = require('sentiment');
var sentiment = new Sentiment();
// Twit module for reading in realtime tweets from
// the Twitter Streaming API
var Twit = require('twit');

// Realtime tweets from the Twitter API will be
// filtered to only include tweets from the USA. 
// Since the API can only accept one filter at
// a time, additional functions will be applied 
// to this filtered set of tweets to add further
// filters, if desired. 
// Additional filters include filtering by state
// that the tweet comes from and by keyword.

// Filter tweets so that they only belong to the
// state specified in "filter_state." If "usa", 
// allow filters from all states
var filter_state = "usa";
// Filter tweets so that they must contain the
// String specified in "keyword."
var keyword = "";
// ID of the last published tweet to keep track
// of what tweets have already been published
var lastPublishedTweetId;

/**
 * Function to determine which state a tweet 
 * belongs to based on its coordinates and the
 * bounding boxes stored in state_locs
 * @param tweet Tweet from the Twitter API
 * @return Name of the state the tweet belongs
 *         to or ""
 */
function which_state(tweet){
    if(tweet.place!=null){
        // Longitude and latitude coordinates
        // of the tweet 
        var tweet_loc = tweet.place.bounding_box.coordinates[0][0];
        var tweet_long = tweet_loc[0];
        var tweet_lat = tweet_loc[1];
        // Loop through all bounding boxes in
        // state_locs. If a tweet is located
        // in a bounding box, return the name
        // of the state associated with the
        // bounding box. Otherwise, return "".
        var this_state;
        for(let i=0;i<state_locs.length;i++){
            var west = state_locs[i].West
            var east = state_locs[i].East
            var north = state_locs[i].North
            var south = state_locs[i].South
            if(west<=tweet_long && tweet_long<=east && south<=tweet_lat && tweet_lat<=north){
                this_state = state_locs[i].States;
                return this_state;
            }
        }
    }
    return "";
}

/**
 * Function to publish a new tweet every 
 * "time" milliseconds
 * @param time Interval (in ms) between 
 *             publishing a new tweet
 */
function tweet_stream(time){
    // Clear timer of the setInterval()
    // method if it exists
    if(publishInterval){
        clearInterval(publishInterval);
    }
    // Call publishTweet for the currently
    // cached tweet every time milliseconds
    publishInterval = setInterval(function(){
        if(cachedTweet){
            publishTweet(cachedTweet);
        }
    },time);
}

/**
 * Function to publish a new tweet if the tweet
 * contains the desired keyword and originated
 * in the desired state
 * @param tweet Tweet from the Twitter API
 */
function publishTweet(tweet){
    // Do not publish tweet if it is the same
    // as the previously published tweet
    if(tweet.id==lastPublishedTweetId){
        return;
    }
    lastPublishedTweetId = tweet.id;
    // Trigger an event on the "poll-channel"
    // in Pusher with the tweet data sent.
    // Ensure that the tweet contains the 
    // desired keyword and tweet originates
    // in the desired state.
    if(tweet.text.indexOf(keyword)!==-1 && (which_state(tweet)==filter_state||filter_state=='usa')){
        pusher.trigger('poll-channel','update-poll',{
            tweet,
        })
    }
}

// TweetPublisher object will hold the credentials
// for the Twitter App, as well as functions to
// start and stop the Twitter stream
var TweetPublisher = {};
// Twitter App credentials
var twitter = TweetPublisher.twitter = new Twit({
    consumer_key:process.env.TWITTER_CONSUMER_KEY,
    consumer_secret:process.env.TWITTER_CONSUMER_SECRET,
    access_token:process.env.TWITTER_ACCESS_TOKEN,
    access_token_secret:process.env.TWITTER_ACCESS_TOKEN_SECRET,
})

// "stream" holds the Twitter stream
// "cachedTweet" holds the current realtime tweet
// "publishInterval" holds the ID of a setInterval()
// method which publishes a new tweet in continuous
// time increments
var stream,cachedTweet,publishInterval;

// The bounding box for the continental United States
var usa = [-124.85,24.39,-66.88,49.38,];

/**
 * Function to start a twitter stream filtered to only
 * include tweets from the USA
 * @return Object containing success/error message
 */
TweetPublisher.start = function(){
    var response = {};
    // If no stream exists, create one that filters
    // tweets to be within a bounding box for the USA
    if(!stream){
        stream = twitter.stream('statuses/filter',{
            locations:usa,
    });
    // For every tweet, calculate the sentiment and
    // store it in "cachedTweet"
        stream.on('tweet',function(tweet){
            tweet.sentiment = sentiment.analyze(tweet.text);
            cachedTweet = tweet;
        });
        response.message = 'Stream created and started';
    }
    else{
        stream.start();
        response.message = 'Stream already exists and started';
    }
    // Call the tweet_stream function to publish the tweet
    // if it is new every 100 milliseconds 
    tweet_stream(100);
    return response;
}

/**
 * Function to stop a stream if it exists
 * @return Object containing success/error message
 */
TweetPublisher.stop = function(){
    var response = {};
    // Stop stream if it exists and clear the timer
    // of the setInterval() method
    if(stream){
        stream.stop();
        clearInterval(publishInterval);
        response.message = 'Stream stopped'
    } else{
        response.message = 'Stream does not exist'
    }
    return response;
}

// TweetObj contains controller handler functions
// (for URLs specified in routes.js) that execute
// SQL queries on the PostgreSQL Db
exports.TweetObj = {
    /**
     * Function to create table if it does not exist
     * with one field for text and the other field
     * for the state
     * @param req Information about the HTTP request
     * @param res Information about HTTP Response
     */
    createTables: function(req,res){
        // SQL query
        const queryText = 
            `CREATE TABLE IF NOT EXISTS
            realtime_table(
                text VARCHAR(128) NOT NULL,
                state VARCHAR(128) NOT NULL
            )`;
        
        pool.query(queryText)
            .then(function(res){
                res.send('No error');
            })
            .catch(function(err){
                res.send('Error');
            });
        },
    /**
     * Function to delete all rows in the table
     * @param req Information about the HTTP request
     * @param res Information about HTTP Response
     */
    clearTables: function(req,res){
        // SQL query
        const queryText = 
            `DELETE FROM
            realtime_table`;

        pool.query(queryText)
            .then(function(res){
                res.send('No error');
            })
            .catch(function(err){
                res.json('Error');
            });
        },
    /**
     * Function to insert a new row in the table
     * with values for the placeholder fields
     * specified by the parameters in the request
     * body
     * @param req Information about the HTTP request
     * @param res Information about HTTP Response
     */
    updateTables: function(req,res){
        // SQL query
        const queryText = `INSERT INTO
            realtime_table(tweet,state)
            VALUES($1, $2)
            returning *`;
        // Values for the placeholder fields
        const values = [
            String(req.body.text),
            String(req.body.state),
        ];
        pool.query(queryText,values)
        .then(function(res){
            res.send('No error');
        })
        .catch(function(err){
            res.send('Error');
        })
    },
    /**
     * Function to drop table if it exists
     * @param req Information about the HTTP request
     * @param res Information about HTTP Response
     */
    dropTables: function(req,res){
        // SQL query
        const queryText = 'DROP TABLE IF EXISTS realtime_table';
        pool.query(queryText)
            .then(function(res){
                res.send('No error');
            })
            .catch(function(err){
                res.send('Error');
            })
    }
}

// Keyword to filter tweets by is entered in a form 
// client-side and sent to the server, which handles it 
// using the sequence of handler functions below.
exports.keyword_post = [
    // Body validation checks if keyword is not empty
    body('keyword','Keyword required').isLength({min:1}).trim(),
    // Body sanitization removes potentially malicious content
    sanitizeBody('keyword').escape(),
    function(req,res,next){
        // Run the validation 
        const errors = validationResult(req);
    // Return if there are errors
    if(!errors.isEmpty()){
        res.send('Error');
        return;
    }
    // Otherwise set the value of the "keyword" variable to
    // the one specified client-side via the form 
    else{
        if(req.body.keyword=="Allow All"){
            keyword = "";
        }
        else{
            keyword = req.body.keyword;
        }
        // Call the tweet_stream function to publish the tweet
        // if it is new every 1 millisecond.
        tweet_stream(1);
        res.send('No error');
        return;
    }
}];

/**
 * Handler function when a state on the map 
 * is clicked client-side
 * @param req Information about the HTTP request
 * @param res Information about HTTP Response
 */
exports.state_post = function(req,res){
    // Set the "filter_state" variable to the
    // name of the state specified in the 
    // request body
    filter_state = req.body.state;
    // Since more realtime tweets are available 
    // from the entire United States and fewer 
    // tweets available from one state, set the
    // time interval in tweet_stream() to a 
    // smaller number if one state is selected 
    // to increase the number of available realtime 
    // tweets
    if(filter_state=='usa'){
        tweet_stream(100);
    }
    else{
        tweet_stream(10);
    }
    res.send('Changed State');
};

/**
 * Handler function for main page renders layout.ejs
 * @param req Information about the HTTP request
 * @param res Information about HTTP Response
 */
exports.main = function(req,res){
    // Start the realtime tweet stream from the
    // Twitter API 
    TweetPublisher.start();
    // Render the layout.ejs template with the 
    // credentials for Pusher made available
    // client-side 
    return res.render('../views/layout.ejs',{
        app_key:process.env.PUSHER_APP_KEY,
        app_cluster:process.env.PUSHER_APP_CLUSTER
    });
};