var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var mysql = require('mysql2/promise');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');

var app = express();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

let db;

(async () => {
  try {
    // Connect to MySQL without specifying a database
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '' // Set your MySQL root password
    });


    // Fresh start every time
    await connection.query("DROP DATABASE IF EXISTS DogWalkService;");
    await connection.query('CREATE DATABASE DogWalkService');
    await connection.end();

    // Now connect to the created database
    db = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'DogWalkService'
    });

    await db.execute(`CREATE TABLE Users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('owner', 'walker') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);`);

    await db.execute(`CREATE TABLE Dogs (
    dog_id INT AUTO_INCREMENT PRIMARY KEY,
    owner_id INT NOT NULL,
    name VARCHAR(50) NOT NULL,
    size ENUM('small', 'medium', 'large') NOT NULL,
    FOREIGN KEY (owner_id) REFERENCES Users(user_id)
);`);

    await db.execute(`CREATE TABLE WalkRequests (
    request_id INT AUTO_INCREMENT PRIMARY KEY,
    dog_id INT NOT NULL,
    requested_time DATETIME NOT NULL,
    duration_minutes INT NOT NULL,
    location VARCHAR(255) NOT NULL,
    status ENUM('open', 'accepted', 'completed', 'cancelled') DEFAULT 'open',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (dog_id) REFERENCES Dogs(dog_id)
);`);

    await db.execute(`CREATE TABLE WalkApplications (
    application_id INT AUTO_INCREMENT PRIMARY KEY,
    request_id INT NOT NULL,
    walker_id INT NOT NULL,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('pending', 'accepted', 'rejected') DEFAULT 'pending',
    FOREIGN KEY (request_id) REFERENCES WalkRequests(request_id),
    FOREIGN KEY (walker_id) REFERENCES Users(user_id),
    CONSTRAINT unique_application UNIQUE (request_id, walker_id)
);`);

    await db.execute(`CREATE TABLE WalkRatings (
    rating_id INT AUTO_INCREMENT PRIMARY KEY,
    request_id INT NOT NULL,
    walker_id INT NOT NULL,
    owner_id INT NOT NULL,
    rating INT CHECK (rating BETWEEN 1 AND 5),
    comments TEXT,
    rated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (request_id) REFERENCES WalkRequests(request_id),
    FOREIGN KEY (walker_id) REFERENCES Users(user_id),
    FOREIGN KEY (owner_id) REFERENCES Users(user_id),
    CONSTRAINT unique_rating_per_walk UNIQUE (request_id)
);`);

    // We know the tables are empty because we deleted the db earlier
    // So just insert stuff
    await db.execute(`INSERT INTO Users (username, email, password_hash, role) VALUES ('alice123','alice@example.com','hashed123','owner'),('bobwalker','bob@example.com','hashed456','walker'),('carol123','carol@example.com','hashed789','owner'),
      ('abe','abe@abescompany.com','whatever_the_hash_for_abeisawesome123_is','owner'),
      ('betterbob','bbob@bobsburgers.com','hash','walker');
      `);

    await db.execute(`INSERT INTO Dogs (owner_id, name, size) VALUES ((SELECT user_id FROM Users WHERE username = 'alice123'), 'Max', 'medium'),((SELECT user_id FROM Users WHERE username = 'carol123'), 'Bella', 'small'),((SELECT user_id FROM Users WHERE username = 'abe'),'Abe','large'),((SELECT user_id FROM Users WHERE username = 'abe'), 'Asbestos','small'),((SELECT user_id FROM Users WHERE username = 'abe'),'Mini Abe','small');`);

    await db.execute(`INSERT INTO WalkRequests (dog_id, requested_time, duration_minutes, location, status) VALUES ((SELECT dog_id FROM Dogs WHERE name = 'Max'), '2025-06-10 08:00:00', 30, 'Parklands', 'open'),((SELECT dog_id FROM Dogs WHERE name = 'Bella'), '2025-06-10 09:30:00',45,'Beachside Ave','accepted'),((SELECT dog_id FROM Dogs WHERE name = 'Abe'),'2025-06-10 08:30:00',20, 'West Beach', 'cancelled'),((SELECT dog_id FROM Dogs WHERE name = 'Abe'),'2025-06-10 08:45:00',30,'Brighton', 'open'),((SELECT dog_id FROM Dogs WHERE name = 'Abe'),'2025-06-11 08:45:00',30,'Hove','open');`);

  } catch (err) {
    console.error('Error setting up database. Ensure Mysql is running: service mysql start', err);
  }
})();

// API Routers

app.get("/api/dogs", async (_, res) => {
  try {
    const [rows] = await db.execute("SELECT Dogs.name AS dog_name, Dogs.size, Users.username AS owner_username FROM Dogs INNER JOIN Users ON Dogs.owner_id = Users.user_id;");
    res.json(rows);
  } catch (e) {
    console.error("Error on dogs db query...");
    res.status(500).json({ error: "Failed to get dogs..." });
  }
});

app.get("/api/walkrequests/open", async (_, res) => {
  try {
    const [rows] = await db.execute("SELECT WalkRequests.request_id, Dogs.name AS dog_name, WalkRequests.requested_time, WalkRequests.duration_minutes, WalkRequests.location, Users.username AS owner_username FROM ((WalkRequests INNER JOIN Dogs ON Dogs.dog_id = WalkRequests.dog_id) INNER JOIN Users ON Users.user_id = Dogs.owner_id);");
    res.json(rows);
  } catch (e) {
    console.error("Error on open walkrequest db query...");
    res.status(500).json({ error: "Failed to get open walkrequests..." });
  }
});

app.get("/api/walkers/summary", async (_, res) => {
  try {
    /*
    Quick block here for constructing the request:
    SELECT column names with renames
    LEFT JOIN the Users table with ratings to retain 
    */
    // This is an absolute monster of a request
    const [rows] = await db.execute(`
      SELECT Users.username AS walker_username,
      COUNT(WalkRatings.rating_id) AS total_ratings,
      AVG(WalkRatings.rating) AS average_rating,
      COUNT(WalkRequests.request_id) AS completed_walks
      FROM ((Users LEFT JOIN WalkRatings ON WalkRatings.walker_id = Users.user_id)
      LEFT JOIN WalkRequests ON WalkRequests.request_id = WalkRatings.request_id AND WalkRequests.status = 'completed')
      GROUP BY Users.username;
      `);
    res.json(rows);
  } catch (e) {
    console.error("Error getting walkers...");
    res.status(500).json({ error: "Error getting walkers..." });
  }
});

// Express routers
app.use('/', indexRouter);
app.use('/users', usersRouter);

module.exports = app;
