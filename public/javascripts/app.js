// Variables
// Margins
const margin = {
    top:10,
    right:10,
    bottom:15,
    left:20
};
// Width and height for SVG
const width = 960 - margin.left - margin.right;
const height = 600 - margin.top - margin.bottom;
// Current realtime tweet
var curr_tweet;
// State that the current
// realtime tweet belongs to
var curr_state;
// Flags are needed to indicate
// when asynchronous tasks are 
// completed
// Flag indicating previous 
// realtime tweet was successfully
// added to the database and 
// displayed client-side so that
// the current realtime tweet is
// allowed to be processed
var flag = 0;
// Flag indicating a certain number
// of milliseconds have passed since 
// the last realtime tweet was added
// to the database and displayed 
// client-side (ensures that tweets 
// are added and displayed with a 
// certain regularity and not all 
// at once) 
var time_flag = 0;
// Flag indicating tweets should begin
// being processed
var tweet_flag = 0;
// Flag indicating previous state
// selection (executed when user 
// clicks on a state on the map) 
// was sent to the server for 
// processing, so that the next
// state selection can be allowed.
var state_flag = 0;
// Flag indicating previous state
// selection filter removal (executed
// when user clicks outside the map) 
// was processed by the server, so that 
// the next state selection filter
// removal can be allowed. 
var out_flag = 0;
// A continuously updated list of
// filtered realtime tweets is displayed
// client-side. Every few seconds, the 
// topmost tweet message is removed from
// the list and a new tweet message is
// displayed at the bottom of the list.
// "interval" holds the ID of the
// setInterval() method that executes
// the continuous updates.
var interval;
// GeoJSON data for the US states
var map_features;
// SVG for d3.js
var svg;
// Group appended to SVG to draw the
// US states
var map;
// Variable to hold the GeoJSON data for the US
// states
var us;
// Projection for geographical data
// with translation and scaling to see
// the entire United States in the 
// center of the screen
var projection = d3.geoAlbersUsa()
                    .translate([width/2,height/2])
                    .scale([1000]);
// Path generator that converts GeoJSON
// data to SVG paths and uses
// geoAlbersUSA projection
var path;
// d3 selection for all states on the map
var states;
// state_bounding_boxes.csv contains bounding
// box data for each state in the US. Each
// element in state_locs is an object with
// bounding box and current sentiment data 
// for a different state in the US.
var state_locs;
// d3 color scale for US states with negative
// values mapped to red and positive values
// mapped to green
var color = d3.scaleLinear()
    .range(["red","green"])
    .domain([-0.1,0.1]);
// The realtime tweets displayed client-side
// are arranged in a table. The number of rows
// in the table is held in the "numRows" variable.
var numRows;

// Realtime tweets are drawn on the map as blue
// circles that decrease in size over time 

//========= Tweet  ===========
/**
 * Class for Tweets
 * @param pos Coordinates of the tweet
 * @constructor
 */
var Tweet = function (pos) {
    // Coordinates of the tweet
    this.loc = pos;
    // "lifespan" indicates how long the tweet
    // (represented as a blue circle) has been
    // displayed on the map. "lifespan" decreases
    // over time and causes the size of the
    // corresponding circle to decrease over time.
    this.lifespan = 100.0;
}

/**
 *  Call the update function for a tweet 
 */
Tweet.prototype.run = function() {
    this.update();
}

/**
 *  This method checks to see if the tweet has reached 
 *  the end of it's lifespan. If it has, return true, 
 *  otherwise return false.
 */
Tweet.prototype.isDead = function () {
    if (this.lifespan <= 0.0) {
        return true;
    } else {
        return false;
    }
}

/**
 *  This method decreases the lifespan of the tweet so 
 *  that the size of its corresponding blue circle on 
 *  the map decreases as well. 
 */
Tweet.prototype.update = function() {
    this.lifespan -= 2.5;
}

//========= TweetSystem  ===========
// Keeps track of all the realtime tweets currently 
// being displayed in the map
/**
 * Class for System of Tweets
 * @constructor
 */
var TweetSystem = function() {
    // Array of all tweets currently being displayed
    // on the map
    this.tweets = [];
};

/**
 * This function runs the entire Tweet system.
 */
TweetSystem.prototype.run = function() {
    // Length of the array of tweets
    var len = this.tweets.length;

    // Loop through and call run() on each tweet
    for (let i = len - 1; i >= 0; i--) {
        var tweet = this.tweets[i];
        tweet.run();

        // If the tweet is "dead," remove it 
        // using splice()
        if (tweet.isDead()) {
            this.tweets.splice(i,1);
        }
    }
}

/**
 * Adds a new tweet to the system
 * @param pos Coordinates of the tweet
 */
TweetSystem.prototype.addTweet = function(pos) {
    this.tweets.push(new Tweet(pos));
}

// If the user selects a state to filter tweets
// by, remove all currently displayed tweets
// after a delay
// Object to keep track if the "state" variable
// has changed value and execute a callback
// function to remove all currently displayed
// tweets once a change is registered
var state_obj = {
    // Internal variable
    state_internal: "",
    // Callback function to be defined
    state_listener: function(val){},
    // Setter Method changes the value
    // of the internal variable and 
    // executes the callback function 
    set state(val){
        this.state_internal = val;
        this.state_listener(val);
    },
    // Getter Method returns value of
    // the internal variable
    get state(){
        return this.state_internal;
    },
    // Set the callback function 
    register_listener: function(listener){
        this.state_listener = listener;
    }
}

// Set the callback function to be executed
// once a change in the "state" variable
// is registered
state_obj.register_listener(function(val){
    // Select all rows in the table
    var rows = $('tr','#mytable');
    // Transition the opacity of the rows
    // to 0 and remove all rows after 
    // 4000 milliseconds
    rows.css("opacity","0");
    setTimeout(function(){
        rows.remove();
    },4000);
});

/**
 * Function to determine which state a tweet 
 * belongs to based on its coordinates and the
 * bounding boxes stored in state_locs
 * @param tweet Tweet from the Twitter API
 * @return Name of the state the tweet belongs to
 */
function which_state(tweet){
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
        var west = state_locs[i]['west']
        var east = state_locs[i]['east']
        var north = state_locs[i]['north']
        var south = state_locs[i]['south']
        if(west<=tweet_long && tweet_long<=east && south<=tweet_lat && tweet_lat<=north){
            this_state = state_locs[i]['state'];
        }
    }
    return this_state;
}

/**
 * Function to set the "curr_state" and 
 * "curr_tweet" variables according to the
 * data from the current realtime tweet
 * @param tweet Tweet from the Twitter API
 */
function tweet_to_db(tweet){
    // Set the "curr_state" variable to
    // the name of the state the current
    // realtime tweet belongs to
    curr_state = which_state(tweet);
    // Set the "curr_tweet" to the text
    // in the current realtime tweet
    curr_tweet = tweet.text;
}

/**
 * Function to add the current realtime
 * tweet to the TweetSystem so that it 
 * can be displayed on the map (as a blue 
 * circle with decreasing size over time) 
 * on the map
 * @param tweet Tweet from the Twitter API
 */
var add_tweet = function(tweet){
    // Longitude and latitude coordinates
    // of the tweet 
    var tweet_loc = tweet.place.bounding_box.coordinates[0][0];
    var tweet_long = tweet_loc[0];
    var tweet_lat = tweet_loc[1];
    // If the projection of the tweet's
    // coordinates on the map is valid,
    // add the tweet to the TweetSystem
    if(projection([tweet_long,tweet_lat])!=null){
        ts.addTweet([tweet_long,tweet_lat]);
    }
}

/**
 * Function to update the sentiment value of 
 * the state of the current realtime tweet
 * @param tweet Tweet from the Twitter API
 */
function updateSentiment(tweet){
    // Determine which state the current
    // realtime tweet belongs to 
    var thisState = which_state(tweet);
    // Loop through all objects in state_locs
    // until the object corresponding to the
    // state of the current realtime tweet is
    // found
    for(let i=0;i<state_locs.length;i++){
        var csvState = state_locs[i].state;
        if(csvState==thisState){
            // For the state in state_locs
            // corresponding to the state
            // the current realtime tweet 
            // belongs to, perform the 
            // following. The curr_sentiment 
            // property is the current average 
            // sentiment value for the state, 
            // calculated by dividing the sum 
            // of all current and previous 
            // sentiment values by the number 
            // of total sentiment values 
            // contributing to the sum. 
            // The prev_sentiment property 
            // is the previous average sentiment
            // value, the sum property is the
            // sum of all current and previous
            // sentiment values, and the count
            // property is the total number
            // of sentiment values contributing
            // to the sum. 
            // Increase the count by 1
            state_locs[i].count += 1;
            // Set prev_sentiment to the previous
            // average sentiment value
            state_locs[i].prev_sentiment = state_locs[i].curr_sentiment;
            // Add the current sentiment value
            // to the sum
            state_locs[i].sum += tweet.sentiment.comparative;
            // Calculate the current average
            // sentiment value by dividing the 
            // sum of all sentiment values by
            // the total number of sentiment
            // values
            state_locs[i].curr_sentiment = state_locs[i].sum/state_locs[i].count;
        }
    }
}

/**
 * The previous and current average sentiment value 
 * for each state are also stored in the "map_features" 
 * object so that the state's corresponding GeoJSON
 * data can be more easily accessed for plotting in d3
 * This function updates the previous and current 
 * average sentiment values for each object in
 * "map_features" according to the data in state_locs
 */
function getSentiment(){
    // For every element in state_locs, obtain the
    // previous and current sentiment values. Store
    // the name of the state for the current element
    // in the "csvState" variable
    for(let i=0;i<state_locs.length;i++){
        var csvState = state_locs[i].state;
        var prevSentiment = state_locs[i].prev_sentiment;
        var currSentiment = state_locs[i].curr_sentiment;
        // Find the element in map_features corresponding
        // to the same state as csvState and update
        // the prev_sentiment and curr_sentiment properties
        // so that they match the values in state_locs.
        for(let j=0;j<map_features.length;j++){
            var jsonState = map_features[j].properties.name
            if(csvState == jsonState){
                map_features[j].properties.prev_sentiment = prevSentiment;
                map_features[j].properties.curr_sentiment = currSentiment;
                break;
            }
        }
    }
}

/**
 * Function called every time a new realtime tweet is
 * read in from the Twitter API. The function updates 
 * the data in several variables as well as updates the 
 * map plotted by d3
 *  @param tweet Tweet from the Twitter API
 */
function update_data(tweet){
    // Set the tweet_flag to 1 indicating that tweets
    // should begin being processed
    tweet_flag = 1;
    // Call tweet_to_db to update the values of the 
    // "curr_state" and "curr_tweet" variables 
    tweet_to_db(tweet);
    // Perform the following only if the value of flag 
    // is 0 (indicating that the previous asynchronous
    // AJAX call completed executing), the value of 
    // time_flag is 0 indicating that the specified time
    // interval has passed between AJAX calls, and the 
    // value of curr_state is not undefined. 
    if(flag==0 && time_flag==0 && curr_state!=undefined){
        // Set flag to 1 and time_flag to 1 indicating
        // that additional AJAX calls should not be 
        // executed until the current one has completed.
        flag = 1;
        time_flag = 1;
        // Use an asynchronous AJAX call to send an HTTP
        // POST request to the server with the current
        // realtime tweet's text and state as data. 
        // Once the AJAX call completes with sucesss or
        // error, set flag to 0 indicating that the 
        // current AJAX call finished, and set time_Flag
        // to 1 so that the time interval delay between
        // subsequent AJAX calls is initiated.
        $.ajax({
            type: "POST",
            url: "/tweets",
            data: {text:curr_tweet,state:curr_state},
            success: function(result,status,xhr){
                flag = 0;
                time_flag = 1;
            },
            error: function(xhr,status,error){
                flag = 0;
                time_flag = 1;
            }
        });
    }
    // Call the updateSentiment() function to update the 
    // previous and current sentiment values in state_locs
    updateSentiment(tweet); 
    // Call add_tweet() to add the current realtime tweet
    // to TweetSystem
    add_tweet(tweet);
    // Call the getSentiment() function to update the 
    // previous and current sentiment values in map_features
    getSentiment();
}

/**
 * Every few seconds, the topmost tweet
 * message in the displayed table is
 * removed and a new tweet message is
 * added as a new row to the bottom of
 * the table. Note that the topmost tweet
 * is only removed if the number of rows
 * in the table is greater than 1. This 
 * function counts the number of rows in 
 * the table
 *  @param table Table HTML Element
 */
function countRows(table){
    // Number of rows
    var rowCount = 0;
    // All row elements in the table 
    var rows = table.find("tr");
    // Increase the row count if the 
    // row contains at least one cell
    // with data 
    for (var i=0;i<rows.length;i++){
        if(rows[i].getElementsByTagName('td').length>0){
            rowCount++;
        }
    }
    numRows = rowCount;
}

/**
 * Remove the topmost row of the table 
 * after a time delay 
 *  @param table Table HTML Element
 *  @param time Time delay before removing
 *              the top row
 */
function upward(table,time){
    // Select the top row of the table
    var top_row = $('tr:first-child',table);
    // Transition the opacity of the topmost
    // row to 0
    top_row.css("opacity","0");
    // After a delay of time milliseconds,
    // remove the topmost row (allowing
    // the CSS opacity transition to take 
    // place over "time" milliseconds)
    setTimeout(function(){
        top_row.remove();
    },time);
}

/**
 * Function to determine if the current
 * element is also the target of the d3 
 * event (used in a subsequent function
 * to determine whether the user has 
 * clicked inside or outside the map 
 * of states)
 */
function equalToEventTarget(){
    return this == d3.event.target;
}

/**
 * Function to convert each row of the
 * csv file into an object with the
 * specified properties
 *  @param data Data from csv file
 */
function transformData1(data){
    return data.map(function(row) {
        return {
            // Name of the state
            state: row.States,
            // Maximum longitude
            west: +row.West,
            // Minimum longitude
            east: +row.East,
            // Maximum latitude
            north: +row.North,
            // Minimum latitude
            south: +row.South,
            // Previous average 
            // sentiment value
            prev_sentiment: 0,
            // Sum of all sentiment
            // values
            sum: 0,
            // Current average
            // sentiment value
            curr_sentiment: 0,
            // Total number of 
            // sentiment values
            // contributing to the
            // sum
            count: 0
        }
    })
}

// Create a new TweetSystem using the constructor
ts = new TweetSystem();

// Select the div with id "d3Container" and 
// append a div that will act as a tooltip.
// Set opacity to 0 so that the tooltip is 
// initially invisible.
const div = d3.select('#d3Container')
    .append('div')
    .attr('class','tooltip')
    .style("opacity",0);

// Read in state_bounding_boxes.csv and convert
// the csv file into an array of objects called
// "state_locs" using transformData1()
d3.csv("files/state_bounding_boxes.csv",function(csvdata1){
    state_locs = transformData1(csvdata1);
    // Read in us-states.json and execute the specified
    // callback function
    d3.json("files/us-states.json",function(jsondata){
        // Store the JSON data in the variable "us"
        us = jsondata;
        // Path generator to convert GeoJSON data to
        // SVG paths uses albersUsa projection
        path = d3.geoPath().projection(projection);
        // Store features from GeoJSON data in 
        // the variable "map_features"
        map_features = us.features;
        // Add the previous and current average 
        // sentiment values for each state in each 
        // corresponding object of "map_features"
        // according to the data in state_locs. 
        // (Previous and current average sentiment
        // values in state_locs are initialized to 
        // 0 by the transformData1() function called
        // earlier on the csv file). Adding the 
        // previous and current average sentiment 
        // values to "map_features" allows that data
        // to be accessed for plotting when passing 
        // "map_features" subsequently to the d3 data() 
        // function
        getSentiment();
        // Append an SVG to the div with id d3Container
        svg = d3.select("#d3Container")
        .append("svg")
        .attr("id","container")
        .attr("width",width+margin.left+margin.right)
        .attr("height",height+margin.top+margin.bottom);
        // Add a group to the svg with class states 
        map = svg.append("g")
        .attr("class","states");
        // Create SVG paths for the GeoJSON data in
        // map_features
        states = map
            .selectAll("path")
            .data(map_features);
        states
            .enter()
            .append("path")
            .attr("d",path)
            .style("stroke","#fff")
            .style("stroke-width","1")
            // Color each state according to the previous
            // average sentiment value with red
            // representing negative sentiment and green
            // representing positive sentiment
            .style("fill",function(d){
                return color(d.properties.prev_sentiment);
            })
            // On mouseover for a state, display a tooltip
            // with the state name
            .on("mouseover",function(d){
                div.transition()
                .duration(200)
                .style("opacity",.9)
                .style("left",(d3.event.pageX+10)+"px")
                .style("top",(d3.event.pageY-10)+"px")
                .text(d.properties.name);
            })
            // When the user clicks on a state, execute
            // the following:
            .on("click",function(d){
                // Set the tweet_flag to 1 indicating that
                // tweets should begin being processed
                tweet_flag = 1;
                // Set the "state" property in state_obj,
                // which triggers a "listener" function to
                // remove all rows in the currently 
                // displayed table of tweets. From now on
                // tweets will only be displayed if they 
                // belong to the state selected
                state_obj.state = d.properties.name;
                // If the previous AJAX call to url "/state"
                // has completed executing (indicated by 
                // a flag value of 0), execute a new 
                // AJAX call to "/state"
                if(state_flag==0){
                    // Set "state_flag" to 1 indicating that
                    // an AJAX call to "/state" is currently
                    // executing.
                    state_flag = 1;
                    // Execute an AJAX call to "/state" with
                    // data for the name of the state the
                    // user clicked on
                    $.ajax({
                        type: "POST",
                        url: "/state",
                        data: {state:d.properties.name},
                        // On success or error change the 
                        // "state_flag" to 0 indicating that
                        // the AJAX call completed
                        success: function(result,status,xhr){
                            state_flag = 0;
                        },
                        error: function(xhr,status,error){
                            state_flag = 0;
                        }
                    });
                }
                d3.event.stopPropagation();
            })
            // On mouseout from a state, transition the tooltip
            // so that its opacity becomes 0 (disappears)
            .on("mouseout",function(d){
                div.transition()
                    .duration(500)
                    .style("opacity",0);
            });
        // Select all paths in the svg with id container
        var state_paths = d3.selectAll("#container path");
        // The equalToEventTarget() and d3 filter() functions are
        // used to determine if the user's click event was inside
        // or outside "state_paths." If the user's click event was
        // outside "state_paths, an AJAX call is made to "/state".
        svg.on("click",function(){
            var outside = state_paths.filter(equalToEventTarget).empty();
            if(outside){
                // Set the tweet_flag to 1 indicating that
                // tweets should begin being processed
                tweet_flag = 1;
                // Set the state property of state_obj to "" 
                // indicating no state was selected. This 
                // setting of the state property also 
                // triggers a "listener" function to
                // remove all rows in the currently 
                // displayed table of tweets. From now on
                // tweets will be displayed from all states.
                state_obj.state = "";
                // If the previous AJAX call to url "/state"
                // has completed executing (indicated by 
                // a flag value of 0), execute a new 
                // AJAX call to "/state"
                if(out_flag==0){
                    // Set "out_flag" to 1 indicating that
                    // an AJAX call to "/state" is currently
                    // executing.
                    out_flag = 1;
                    // Execute an AJAX call to "/state" with
                    // a value of "usa" for property state
                    // indicating that tweets should be
                    // allowed from all states.
                    $.ajax({
                        type: "POST",
                        url: "/state",
                        data: {state:"usa"},
                        // On success or error change the 
                        // "state_flag" to 0 indicating that
                        // the AJAX call completed
                        success: function(result,status,xhr){
                            out_flag = 0;
                        },
                        error: function(xhr,status,error){
                            out_flag = 0;
                        }
                    });
                }
            }
        })
        // Append a group to the SVG for the title 
        var title = svg.append("g")
        // Translation
        .attr("transform","translate(210,40)");
        title.append("text")
        .attr("x", 0)
        .attr("y", 0)
        .attr("font-size","40px")
        .attr("dy", "0.35em")
        .text("Real-Time Tweets across USA");
        // Append a group to the SVG for the legend
        var legend = svg.append("g")
        // Translation
        .attr("transform","translate(190,550)");
        // Create a box around the legend
        legend.append("rect")
        .attr("stroke","black")
        .attr("stroke-width",1)
        .attr("width",585)
        .attr("height",30)
        .attr("fill-opacity",0)
        // Add a blue circle symbol (indicating a tweet)
        // to the legend
        legend.append("circle")
        .attr("transform","scale(2)")
        .attr("cx",15)
        .attr("cy",7)
        .attr("r",3)
        .attr("fill","#38A1F3");
        // Add a text description for the blue circle
        legend.append("text")
        .attr("x", 43)
        .attr("y", 13)
        .attr("dy", "0.35em")
        .text("= Tweet");
        // Add a rectangle symbol with color red 
        // (indicating a state with overall negative
        // average sentiment) to the legend 
        legend.append("rect")
        .attr("transform","scale(2)")
        .attr("x",64)
        .attr("y",5)
        .attr("stroke","#d3d3d3")
        .attr("stroke-width",1)
        .attr("width",5)
        .attr("height",5)
        .attr("fill","red");
        // Add a text description for the red
        // rectangle
        legend.append("text")
        .attr("x", 143)
        .attr("y", 13)
        .attr("dy", "0.35em")
        .text("= Negative Sentiment");
        // Add a rectangle symbol with color green
        // (indicating a state with overall positive
        // average sentiment) to the legend
        legend.append("rect")
        .attr("transform","scale(2)")
        .attr("x",146)
        .attr("y",5)
        .attr("stroke","#d3d3d3")
        .attr("stroke-width",1)
        .attr("width",5)
        .attr("height",5)
        .attr("fill","green");
        // Add a text description for the green 
        // rectangle
        legend.append("text")
        .attr("x", 307)
        .attr("y", 13)
        .attr("dy", "0.35em")
        .text("= Positive Sentiment");
        // Add a rectangle symbol with color brown
        // (indicating a state with overall neutral
        // sentiment or no data) to the legend
        legend.append("rect")
        .attr("transform","scale(2)")
        .attr("x",228)
        .attr("y",5)
        .attr("stroke","#d3d3d3")
        .attr("stroke-width",1)
        .attr("width",5)
        .attr("height",5)
        .attr("fill","brown");
        // Add a text description for the brown 
        // rectangle
        legend.append("text")
        .attr("x", 471)
        .attr("y", 13)
        .attr("dy", "0.35em")
        .text("= Neutral/No Data");
    });
});

/**
 * Function to transition the color of
 * each state from reflecting the previous
 * average sentiment value to reflecting 
 * the current average sentiment value
 */
var draw_states = function(){
    map
        .selectAll("path")
        .data(map_features)
        // Over 1000 milliseconds transition
        // the color of each state to reflect
        // the current average sentiment value
        .transition()
        .duration(1000)
        .ease(d3.easeQuadIn)
        .style("fill",function(d){
            return color(d.properties.curr_sentiment);
        })
};

/**
 * Function to draw blue circles on the map to represent
 * where individual realtime tweets were tweeted, with 
 * size of the blue circle decreasing over time to reflect 
 * how long ago the tweets were initially tweeted. The 
 * TweetSystem keeps track of the age/lifespan and 
 * coordinates of all realtime tweets in an array so 
 * that they may be plotted using this function. Tweets
 * are continuously added in realtime to the TweetSystem
 * array and deleted after a certain period of time (when 
 * their "lifespan" becomes 0) so that the map always 
 * displays a consistent number of tweets
 */
var draw_tweets = function(){
    // Remove all circles on the map
    d3.select("#circles").remove();
    // Add a group to the svg to draw the circles
    var tweets_layer = svg.append("g")
        .attr("id","circles");
    // Draw the circles on the map using the defined
    // projection and coordinates stored in the
    // TweetSystem
    tweets_layer
        .selectAll("circle")
        .data(ts.tweets)
        .enter()
        .append("circle")
        .attr("cx",function(d){
            return projection([d.loc[0],d.loc[1]])[0];
        })
        .attr("cy",function(d){
            return projection([d.loc[0],d.loc[1]])[1];
        })
        // Size of the blue circles is determined by
        // the lifespan of each tweet, as recorded 
        // by the TweetSystem
        .attr("r",function(d){
            return d.lifespan/10;
        })
        .style("fill","#38A1F3")
        .style("opacity",0.85);
}

// Every 4250 milliseconds, count the number of rows
// in the currently displayed table of tweets. If 
// the number of rows is greater than 1, execute the
// upward function() so that the topmost row is 
// removed after 3750 milliseconds.
$(function(){
    interval = setInterval(function(){
        countRows($('#mytable'));
        if(numRows>1){
            upward($('#mytable'),3750);
        }
    },4250);
});

// Every 1000 milliseconds, transition the color of
// states on the map from the previous average 
// sentiment value to the current average sentiment
// value.
setInterval(function(){
    draw_states();
},1000);

// Every 3750 milliseconds, change the value of the
// time_flag. Since AJAX calls to post a new realtime
// tweet to the database and display it on the table 
// are only allowed to execute if the tine_flag has
// a value of 0, this controls how often those AJAX
// calls are executed.
setInterval(function(){
    if(time_flag==0){
        time_flag=1;
    }
    else if(time_flag==1){
        time_flag = 0;
    }
},3750);

// If tweet_flag has a value of 1, run the TweetSystem
// (which decreases the lifespan of all tweets in
// TweetSystem's array so that they decrease in size 
// and are closer to disappearing from the map). Also
// redraw all blue circles (representing tweets) on the
// map to reflect their updated lifespans. 
setInterval(function(){
    if(tweet_flag==1){
        ts.run();
        draw_tweets();
    }
},100);

// Every 600000 milliseconds, send an AJAX request
// to "/restart" to delete all rows in the database
setInterval(function(){
    $.ajax({
        type: "GET",
        url: "/restart",
        success: function(result,status,xhr){
        },
        error: function(xhr,status,error){
        }
    });
},60000)

// Instantiate Pusher to connect to Pusher channels.
// Credentials are provided client-side by the server
// using ejs templates in the pusherConfig object. 
const pusher = new Pusher(String(pusherConfig.app_key),{
    cluster:String(pusherConfig.app_cluster),
    encrypted:true,
});

// Use the Pusher subscribe() method to subscribe 
// to a new channel called "poll-channel", which 
// receives realtime tweet data. Updates to the 
// channel are listened for using the bind()
// method. The update_data() function is called 
// every time the channel receives a new realtime
// tweet and receives data ("new_data") for that
// tweet. 
const channel = pusher.subscribe('poll-channel');
channel.bind('update-poll',function(new_data){
    update_data(new_data.tweet);
});

// Subscribe to a new channel called
// "watch_realtime_table" which listens for 
// notification events when a new row (containing
// tweet data) is added to the PostgreSQL database. 
// Every time a new row is added to the database,
// a new row is added to the table of tweets
// displayed client-side with the new data 
// (text and name of the state of the new realtime
// tweet).
const realtime_channel = pusher.subscribe('watch_realtime_table');
realtime_channel.bind('new_record',function(data){
    var table = document.getElementById('mytable');
    var row = table.insertRow(-1);
    // Add the class "fadeClass" to the new row so 
    // that it displays a CSS opacity transition
    row.className = "fadeClass";
    var cell_text = row.insertCell(0);
    var cell_state = row.insertCell(1);
    cell_text.innerHTML = "<blockquote class='twitter-tweet'>"+data.tweet+"</blockquote>";
    cell_state.innerHTML = data.state;
});