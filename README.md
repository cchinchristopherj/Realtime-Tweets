USA: Realtime Tweets
=========================

The purpose of this project was to find a means of surveying the entire American population on topics of interest without the time and cost inherent in traditional interviewing practice. With the nearly ubiquitous popularity of social media/networking services like Twitter as a means of communication, the solution was observational analysis of realtime tweets: by sifting through the enormous stream of messages being sent out continuously by users across the 50 states, it becomes possible to gauge American opinion simultaneously in realtime and everywhere, all at the click of a button. Sentiment analysis was also employed as a fast, automated, and scalable method to measure the emotional "polarity" of tweets by calculating a score indicating the overall "positive" or "negative" tone of the text. 

Client
=========================

The screenshot below is of the [web application](http://realtime-tweets-usa.herokuapp.com) developed for realtime tweet sentiment analysis. The blue circles represent the location of tweets being sent in realtime, with the size of the circles reflecting how recently they were sent (smaller circles were sent a longer time ago). The color of each state also reflects the average sentiment score of the tweets sent so far by the state's population, with green representing positive scores, red representing negative scores, and brown representing neutral scores (or no data yet received). Finally, on the right-hand side of the dashboard, a selection of realtime tweets is displayed along with their state of origin. This selection of tweets is implemented via an HTML table, which shifts upward every few seconds (removing the first, oldest row from the table in the process), to ensure that relatively the same number of tweets is always displayed on the web page.

![dashboard](https://github.com/cchinchristopherj/Realtime-Tweets/blob/master/images/screenshot_main.png)

Additional options are also available for the user to interact with the live twitter stream being displayed. If they want to view tweets from one state in particular, they can click on that state on the map and tweets will subsequently only be shown if they originated from the selected state. In the screenshot below, "California" was selected: 

![dashboard](https://github.com/cchinchristopherj/Realtime-Tweets/blob/master/images/screenshot_state.png)

The user also has the option of entering a keyword in the available text field and clicking the "Filter" button to only display tweets that contain the chosen keyword. In this way, the user can gauge the realtime opinion of the population on relevant topics of interest like "economy", "war", "election", etc. by filtering the live twitter stream by these keywords. In the screenshot below, only realtime tweets with the word "movie" are displayed. 

![dashboard](https://github.com/cchinchristopherj/Realtime-Tweets/blob/master/images/screenshot_keyword.png)

Server
=========================

Five types of requests are sent from the client to the server via asynchronous AJAX calls:

1. When a tweet is obtained via the [Twitter Streaming API](https://developer.twitter.com/en/docs.html) (to be discussed), a POST request is sent to '/tweets', which adds the tweet's text and state of origin as a new row to the PostgreSQL database table. 

2. When the user clicks on a state (to selectively display tweets from that state), a POST request is sent to '/state', which sets a global variable to the name of the state. From this point on, POST requests to '/tweets' will only add a new row to the PostgreSQL database table if the tweet originated in the selected state. 

3. When the user clicks outside the map (to remove filtering by state), a POST request is sent to '/state', which resets the global variable indicating what state to filter by. From this point on, POST requests to '/tweets' will add a new row to the PostgreSQL database regardless of original tweet location. 

4. When the user enters a keyword in the form and clicks the "Filter" button (to selectively display tweets containing the desired keyword), a POST request is sent to '/keyword'. Validation and sanitization procedures process the submission from the user to ensure the keyword is not empty and contains no malicious content. Afterwards, a global variable is set to the string entered in the form. From this point on, POST requests to '/tweets' will only add a new row to the PostgreSQL database if the tweet contains the selected keyword. 

5. When the user clicks the "Allow All" button (to remove filtering by keyword), a POST request is sent to 'keyword', which resets the global variable indicating what keyword to filter by.

Realtime Functionality
=========================

There are three components working in tandem with the server and client-side application to provide realtime functionality: the [Twitter Streaming API](https://developer.twitter.com/en/docs.html) (source of realtime data), a [PostgreSQL Database](https://www.postgresql.org/) (storage of realtime data), and [Pusher](https://pusher.com/) (connection between the Twitter and PostgreSQL, server and client). Each of these components will be overviewed in detail with respect to their individual role in the pipeline: 

1. The [Twitter Streaming API](https://developer.twitter.com/en/docs.html) allows developers to connect to the live, realtime Twitter stream, enabling numerous possibilities for interaction, including the receipt of specific kinds of tweets (from a certain location or containing certain text) and posting of new tweets instantly in response to other tweets. 
- In this project, the npm package ["Twit"](https://www.npmjs.com/package/twit) is used to make requests to this API, in particular GET requests for tweets that match filtering criteria. 

2. In order to persistently store this tweet data, an open source relational database management system called [PostgreSQL](https://www.postgresql.org/) is used. Concretely, a PostgreSQL database stores data in a table with rows for records and columns for fields, one field corresponding to the text of each tweet and a second field corresponding to the state of origin. 
- In order to create a new realtime table in the PostgreSQL database, the ['db-migrate'](https://www.npmjs.com/package/db-migrate) and ['db-migrate-pg'](https://www.npmjs.com/package/db-migrate-pg) modules were used to set up a database migration framework, with the 'database.json' file informing 'db-migrate' what database connection was being used. In addition, the '20190401124848-realtime-table-up.sql' file in the 'migrations' folder contains SQL code that was executed once the database migrated successfully (specifically, code to create a new table if one did not exist, and code defining a "trigger" function to be executed once a new row is added to the table). 
- The file 'db.js' is an optional file the user can run from the command line (via the ['make-runnable'](https://www.npmjs.com/package/make-runnable) module) to create a new table with the desired format for the tweet data. Additional functions are also available in the file for deleting the table and inserting a new row. 

3. Lastly, [Pusher](https://pusher.com/), a hosted service that uses persistent connections to push new data from servers to clients in realtime, is used to listen for data on "channels", and execute events on these channels via "triggers" when data is received.
In this application, two channels are employed: 
- The first channel listens for the receipt of tweets from the Twitter Streaming API, executing a series of functions to update the sentiment and tweet location data displayed in the left-hand side of the browser, as well as insert a new row into the PostgreSQL database containing the tweet data. 
- The second channel listens for the insertion of a new row into the PostgreSQL database and executes a function to add a new row to the HTML table on the right-hand side of the browser displaying the text and state of origin of the new tweet.

Data
=========================

1. state_bounding_boxes.csv: Bounding box data for each of the fifty US states. Each tweet obtained via the Twitter API contains the latitude/longitude coordinates from which it was sent. This coordinate data is used in conjunction with the bounding box data from the state_bounding_boxes.csv file to determine the exact state the tweet originated from. 
- Due to there not being a publicly available .csv file of bounding boxes for all 50 US states, raw bounding box data was scraped from the Map & Geospatial Information Round Table [page](http://www.ala.org/rt/magirt/publicationsab/usa) on the American Library Association website and converted into a .csv file. Web scraping was achieved using the [BeautifulSoup](https://www.crummy.com/software/BeautifulSoup/bs4/doc/) Python library, with code available in statebb_scraper.py.

2. us-states.json: GeoJSON data for the US states. A geoAlbersUSA projection and d3 path generator will be used to convert this GeoJSON data to SVG paths, and display a map of the US client-side. 

Deployment
=========================

The web application itself is hosted [here](http://realtime-tweets-usa.herokuapp.com) by the cloud platform [Heroku](https://www.heroku.com/). The 'Procfile' in the root directory is a text file that explicitly informs Heroku what command to run when the application starts. In this case the web process type is specified along with the application entry point: the 'www' file in the 'bin' folder.

Correct Usage - Web application
=========================

If you would like to create the web application from the ground up, run the following commands, the first of which installs all required modules defined in the 'package.json' file, and the second of which calls the application entry point (the 'www' file in the 'bin' folder), which defines application error handling and starts the server:

        npm install
        npm start

The server will then create the [Express](https://developer.mozilla.org/en-US/docs/Learn/Server-side/Express_Nodejs) application, which defines route handling using code from the 'index.js' file in the 'routes' folder. These routes forward requests to the relevant controller functions defined in the 'controllers.js' file in the 'controllers' folder. Finally, the main page of the web application is rendered using the 'layout.ejs' file in the 'views' folder, with the relevant data, javascript, and stylesheet files for 'layout.ejs' served using Express middleware from the 'public' folder.

Correct Usage - Web scraper
=========================

If you would like to run the web scraper program to convert raw data from the Map & Geospatial Information Round Table [page](http://www.ala.org/rt/magirt/publicationsab/usa) on the American Library Association website into a .csv file, run the following command:

        python statebb_scraper.py
