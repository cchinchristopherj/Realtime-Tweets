// dotenv module to load environment variables
// into process.env from .env file
const dotenv = require('dotenv');
dotenv.config();
// Use a connection pool to make frequent 
// queries to the PostgreSQL Db
const {Pool} = require('pg');
// Connect to the Db
const pool = new Pool({
    connectionString:process.env.DATABASE_URL
});
// Display message on connect event
pool.on('connect',function(){
    console.log('connected to the db');
});

/**
 * Function to create a new table in the Db 
 * if it does not exist with a field for 
 * text and a field for the state
 */
const createTables = function(){
    // SQL query
    const queryText = 
        `CREATE TABLE IF NOT EXISTS
        tweetsdb(
            text VARCHAR(128) NOT NULL,
            state VARCHAR(128) NOT NULL
        )`;
    // Call the query method on pool 
    // which returns a promise 
    pool.query(queryText)
        // On success print the result
        // and close the connection
        .then(function(res){
            console.log(res);
            pool.end();
        })
        // On error print the error
        // and close the connection
        .catch(function(err){
            console.log(err);
            pool.end();
        });
}

/**
 * Function to drop a table in the Db 
 * if it exists
 */
const dropTables = function(){
    // SQL query
    const queryText = 'DROP TABLE IF EXISTS tweetsdb';
    pool.query(queryText)
        .then(function(res){
            console.log(res);
            pool.end();
        })
        .catch(function(err){
            console.log(err);
            pool.end();
        })
}

/**
 * Function to add a "test" row to
 * the table with value "test" for 
 * the text and value "New York"
 * for the state
 */
const updateTables = function(){
    // SQL query with supplied values
    // inserted into the placeholder
    // fields. "returning *" ensures
    // that the created row is returned
    const queryText = `INSERT INTO
        tweetsdb(text,state)
        VALUES($1, $2)
        returning *`;
    const values = ["test","New York"];
    pool.query(queryText,values)
        .then(function(res){
            console.log(res);
            pool.end();
        })
        .catch(function(err){
            console.log(err);
            pool.end();
        })
}
// Display message on remove event
// and exit the node process
pool.on('remove',function(){
    console.log('client removed');
    process.exit(0);
})

module.exports = {
    createTables,
    dropTables,
    updateTables
}
// "make-runnable" allows the user
// to call any of the three functions 
// from the terminal 
require('make-runnable');