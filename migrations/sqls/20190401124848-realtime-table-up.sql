/* SQL statements to be active once database has migrated for realtime use */
/* Create table if it does not exist with one field for text and the other
for the state */
CREATE TABLE IF NOT EXISTS realtime_table (tweet varchar(255) NOT NULL, state varchar(255) NOT NULL);
/* Create a function that returns a trigger (executed in repsonse to an event).
In this case, the trigger calls pg_notify() on the table (i.e. sends a 
notification event with payload string to clients listening to the specified
channel. Further, the row is returned as JSON) */
CREATE FUNCTION notify_trigger() RETURNS trigger AS $$
DECLARE
BEGIN
    PERFORM pg_notify('watch_realtime_table', row_to_json(NEW)::text);
    RETURN new;
END;
$$ LANGUAGE plpgsql;
/* Use the notify_trigger() function defined above every time an "INSERT"
action occurs on the table. */
CREATE TRIGGER watch_realtime_table_trigger AFTER INSERT ON realtime_table
FOR EACH ROW EXECUTE PROCEDURE notify_trigger();