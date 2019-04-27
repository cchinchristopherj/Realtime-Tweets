// Import required modules
var bodyParser = require('body-parser');
const express = require('express');
const cors = require('cors');
var path = require('path');
var Router = require('./routes/index');
// Set port number if defined. Otherwise
// set to 4000
let port = process.env.PORT;
if(port==null || port==""){
    port = 4000;
}
// New express instance
const app = express();
// Express middleware
// Serve files from public folder
app.use(express.static(path.join(__dirname,"/public")));
// Set path to views folder
app.set('views',path.join(__dirname,"/views"));
// Set views engine to "ejs"
app.set('view engine', 'ejs');
app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
// Define routes
app.use('/',Router);

module.exports = app;