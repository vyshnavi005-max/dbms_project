const express = require('express')
const path = require('path')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const cors = require("cors");
const cookieParser = require('cookie-parser');
const app = express()
const dotenv = require('dotenv')
const fs = require('fs')
dotenv.config();

// Define allowed origins
const allowedOrigins = process.env.NODE_ENV === 'production' 
    ? ['https://vyshnavi005-max.github.io', 'https://twitter-clone-backend-534j.onrender.com'] 
    : ['http://localhost:3001', 'http://localhost:3000'];

// Use a more flexible CORS configuration
app.use(cors({
    origin: function(origin, callback) {
        // Allow requests with no origin (like mobile apps, curl requests)
        if (!origin) return callback(null, true);
        
        console.log("Request from origin:", origin);
        
        if (allowedOrigins.indexOf(origin) === -1) {
            const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
            console.log(`CORS blocked origin: ${origin}`);
            return callback(new Error(msg), false);
        }
        return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
}));

// Handle OPTIONS requests explicitly
app.options('*', (req, res) => {
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.status(204).end();
});

// Add a middleware to log all requests
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url} from ${req.headers.origin || 'Unknown Origin'}`);
    next();
});

app.use(express.json())
app.use(cookieParser());

// Database setup
let db = null;

const initializeServer = async () => {
  try {
    if (process.env.NODE_ENV === 'production') {
      // Connect to PostgreSQL in production
      const pgp = require('pg-promise')();
      const dbConfig = {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      };
      
      db = pgp(dbConfig);
      console.log("PostgreSQL database connected successfully");
      
      // Create tables if they don't exist
      await setupPostgresDatabase();
    } else {
      // Use SQLite for development
      const dbPath = path.join(__dirname, './database/twitterClone.db');
      db = await open({
        filename: dbPath,
        driver: sqlite3.Database,
      });
      console.log("SQLite database connected successfully");
    }
  } catch (e) {
    console.error(`Database connection error: ${e}`);
  }
}

// Function to set up PostgreSQL tables
const setupPostgresDatabase = async () => {
  try {
    // Read the schema file
    const schemaPath = path.join(__dirname, './database/schema_pg.sql');
    const schema = fs.existsSync(schemaPath) 
      ? fs.readFileSync(schemaPath, 'utf8')
      : `
      -- Create User Table
      CREATE TABLE IF NOT EXISTS "User" (
          user_id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          username TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          gender TEXT CHECK(gender IN ('Male', 'Female', 'Other')) NOT NULL
      );

      -- Create Follower Table
      CREATE TABLE IF NOT EXISTS "Follower" (
          follower_id SERIAL PRIMARY KEY,
          follower_user_id INTEGER NOT NULL REFERENCES "User"(user_id),
          following_user_id INTEGER NOT NULL REFERENCES "User"(user_id)
      );

      -- Create Tweet Table
      CREATE TABLE IF NOT EXISTS "Tweet" (
          tweet_id SERIAL PRIMARY KEY,
          tweet TEXT NOT NULL,
          user_id INTEGER NOT NULL REFERENCES "User"(user_id),
          date_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Create Reply Table
      CREATE TABLE IF NOT EXISTS "Reply" (
          reply_id SERIAL PRIMARY KEY,
          tweet_id INTEGER NOT NULL REFERENCES "Tweet"(tweet_id),
          reply TEXT NOT NULL,
          user_id INTEGER NOT NULL REFERENCES "User"(user_id),
          date_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Create Like Table
      CREATE TABLE IF NOT EXISTS "Like" (
          like_id SERIAL PRIMARY KEY,
          tweet_id INTEGER NOT NULL REFERENCES "Tweet"(tweet_id),
          user_id INTEGER NOT NULL REFERENCES "User"(user_id),
          date_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Create Notifications Table
      CREATE TABLE IF NOT EXISTS "Notifications" (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES "User"(user_id),
          from_user_id INTEGER REFERENCES "User"(user_id),
          tweet_id INTEGER REFERENCES "Tweet"(tweet_id),
          type TEXT,
          message TEXT,
          is_read BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      `;
    
    // Execute the schema
    await db.query(schema);
    console.log("PostgreSQL tables created successfully");
  } catch (error) {
    console.error("Error creating PostgreSQL tables:", error);
  }
};

// Initialize database connection
initializeServer();

const authenticateToken = async (request, response, next) => {
    try {
        // Extract token from Authorization header or cookies
        const authHeader = request.headers['authorization'];
        const bearerToken = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;
        const cookieToken = request.cookies.token || request.cookies.jwtToken;
        
        // Choose which token to use (prefer header token over cookie token)
        const jwtToken = bearerToken || cookieToken;
        
        if (!jwtToken) {
            console.log("No JWT token found in headers or cookies");
            return response.status(401).send("Invalid JWT Token");
        }
        
        // Verify the token
        const payload = jwt.verify(jwtToken, process.env.JWT_SECRET);
        
        // Get user details from database based on database type
        let user;
        if (process.env.NODE_ENV === 'production') {
            // PostgreSQL query
            user = await db.oneOrNone('SELECT user_id, username FROM "User" WHERE username = $1', [payload.username]);
        } else {
            // SQLite query
            user = await db.get('SELECT user_id, username FROM User WHERE username = ?', [payload.username]);
        }
        
        if (!user) {
            console.log("User not found in database:", payload.username);
            return response.status(401).send("Invalid JWT Token");
        }
        
        // Add user to request object
        request.user = {
            userId: user.user_id,
            username: user.username
        };
        
        next();
    } catch (err) {
        console.log("JWT verification error:", err.message);
        return response.status(401).send("Invalid JWT Token");
    }
};



app.get("/", (request, response) => {
    response.send("Welcome to the Twitter Clone API!");
  });


app.post("/register", async (request, response) => {
    try {
        console.log("Register request received:", request.body);
        const { username, password, name, gender } = request.body;
        const validGenders = ["Male", "Female", "Other"];
        
        if (!username || !password || !name || !gender) {
            return response.status(400).send("All fields (username, password, name, gender) are required");
        }
        
        if (!validGenders.includes(gender)) {
            return response.status(400).send("Invalid gender. Choose 'Male', 'Female', or 'Other'.");
        }
        
        if (password.length < 6) {
            return response.status(400).send('Password is too short');
        }
        
        // Check if user exists
        let dbUser;
        try {
            if (process.env.NODE_ENV === 'production') {
                // PostgreSQL query
                dbUser = await db.oneOrNone('SELECT * FROM "User" WHERE username = $1', [username]);
            } else {
                // SQLite query - using parameterized query
                const getUserQuery = `SELECT * FROM User WHERE username = ?`;
                dbUser = await db.get(getUserQuery, [username]);
            }
            
            if (dbUser == undefined) {
                const hashedPassword = await bcrypt.hash(password, 10);
                
                // Insert new user
                if (process.env.NODE_ENV === 'production') {
                    // PostgreSQL query
                    await db.none(
                        'INSERT INTO "User"(name, username, password, gender) VALUES($1, $2, $3, $4)',
                        [name, username, hashedPassword, gender]
                    );
                } else {
                    // SQLite query - using parameterized query
                    const addUserQuery = `INSERT INTO User(name, username, password, gender) VALUES(?, ?, ?, ?)`;
                    await db.run(addUserQuery, [name, username, hashedPassword, gender]);
                }
                
                return response.status(200).send('User created successfully');
            } else {
                return response.status(400).send('User already exists');
            }
        } catch (dbError) {
            console.error("Database error during registration:", dbError);
            return response.status(500).send('Database error during registration');
        }
    } catch (error) {
        console.error("Registration error:", error);
        return response.status(500).send('Server error during registration');
    }
});

// Login endpoint
app.post("/login", (request, response) => {
    const { username, password } = request.body;
    
    // Determine which database query to use based on environment
    const query = process.env.NODE_ENV === 'production' 
        ? 'SELECT * FROM "User" WHERE username = $1'
        : 'SELECT * FROM User WHERE username = ?';
    
    // Execute the appropriate query
    const dbMethod = process.env.NODE_ENV === 'production' ? db.oneOrNone : db.get;
    dbMethod(query, [username])
        .then(user => {
            if (!user) {
                return response.status(400).json({ message: "Invalid username or password" });
            }
            
            // Compare the password
            bcrypt.compare(password, user.password, (err, result) => {
                if (err || !result) {
                    return response.status(400).json({ message: "Invalid username or password" });
                }
                
                // Create JWT token
                const token = jwt.sign({ username: user.username }, process.env.JWT_SECRET, { 
                    expiresIn: '24h'
                });
                
                // Set up cookie options
                const cookieOptions = {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
                    path: '/',
                    maxAge: 24 * 60 * 60 * 1000 // 24 hours
                };
                
                // Set JWT in cookie
                response.cookie('token', token, cookieOptions);
                
                // Send token in response body as well
                return response.status(200).json({
                    message: "Login successful",
                    user: {
                        username: user.username,
                        userId: user.user_id,
                        profilePic: user.profile_pic
                    },
                    token: token
                });
            });
        })
        .catch(error => {
            console.error("Login error:", error);
            response.status(500).json({ message: "Server error during login" });
        });
});



const convertToCamelCaseForTweets = (tweets) => ({
    username: tweets.username,
    tweetId: tweets.tweet_id,
    tweet: tweets.tweet,
    dateTime: tweets.date_time
});

// Get Feed of Tweets
app.get('/user/tweets/feed/', authenticateToken, async (request, response) => {
    try {
        const { username } = request.user;
        let user, dbResponse;
        
        if (process.env.NODE_ENV === 'production') {
            // PostgreSQL query
            user = await db.oneOrNone('SELECT user_id FROM "User" WHERE username = $1', [username]);
            if (!user) return response.status(400).send("User not found");
            
            dbResponse = await db.any(`
                SELECT u.username, t.tweet_id, t.tweet, t.date_time
                FROM "Tweet" t
                JOIN "Follower" f ON t.user_id = f.following_user_id
                JOIN "User" u ON u.user_id = t.user_id
                WHERE f.follower_user_id = $1
                ORDER BY t.date_time DESC
                LIMIT 10
            `, [user.user_id]);
        } else {
            // SQLite query - using parameterized query
            const getUserIdQuery = `SELECT user_id FROM User WHERE username = ?`;
            user = await db.get(getUserIdQuery, [username]);
            if (!user) return response.status(400).send("User not found");
            
            const getTweetsQuery = `
                SELECT User.username, Tweet.tweet_id, Tweet.tweet, Tweet.date_time
                FROM Tweet
                JOIN Follower ON Tweet.user_id = Follower.following_user_id
                JOIN User ON User.user_id = Tweet.user_id
                WHERE Follower.follower_user_id = ?
                ORDER BY Tweet.date_time DESC
                LIMIT 10
            `;
            dbResponse = await db.all(getTweetsQuery, [user.user_id]);
        }
        
        response.send(dbResponse.map(convertToCamelCaseForTweets));
    } catch (error) {
        console.error("Error fetching tweet feed:", error);
        response.status(500).send("Server error");
    }
});


const likedNames = (data) => {
    const names = data.map((item) => item.name);
    return {
      likes: names,
      hasLiked: names.length > 0,
    };
  };
  
  app.get("/tweets/:tweetId/likes/", authenticateToken, async (req, res) => {
    try {
        const { username } = req.user;
        const { tweetId } = req.params;
        let user, dbResponse;
        
        if (process.env.NODE_ENV === 'production') {
            // PostgreSQL queries
            user = await db.oneOrNone('SELECT user_id FROM "User" WHERE username = $1', [username]);
            if (!user) return res.status(400).send("User not found");
            
            dbResponse = await db.any(`
                SELECT u.name
                FROM "Like" l
                JOIN "User" u ON l.user_id = u.user_id
                WHERE l.tweet_id = $1
                  AND l.tweet_id IN (
                    SELECT tweet_id
                    FROM "Tweet"
                    WHERE user_id IN (
                      SELECT following_user_id
                      FROM "Follower"
                      WHERE follower_user_id = $2
                    )
                  )
            `, [tweetId, user.user_id]);
        } else {
            // SQLite queries
            const getUserIdQuery = `SELECT user_id FROM User WHERE username = ?`;
            user = await db.get(getUserIdQuery, [username]);
            if (!user) return res.status(400).send("User not found");
            
            const getTweets = `
                SELECT u.name
                FROM Like l
                JOIN User u ON l.user_id = u.user_id
                WHERE l.tweet_id = ?
                  AND l.tweet_id IN (
                    SELECT tweet_id
                    FROM Tweet
                    WHERE user_id IN (
                      SELECT following_user_id
                      FROM Follower
                      WHERE follower_user_id = ?
                    )
                  )
            `;
            dbResponse = await db.all(getTweets, [tweetId, user.user_id]);
        }
        
        return res.send(likedNames(dbResponse));
    } catch (error) {
        console.error("Error fetching likes:", error);
        return res.status(500).send("Server error");
    }
  });
  
const repliesNames = (item) => {
    return { name: item.name, reply: item.reply };
  };
  
  app.get("/tweets/:tweetId/replies/", authenticateToken, async (req, res) => {
    try {
        const { username } = req.user;
        const { tweetId } = req.params;
        let user, dbResponse;
        
        if (process.env.NODE_ENV === 'production') {
            // PostgreSQL queries
            user = await db.oneOrNone('SELECT user_id FROM "User" WHERE username = $1', [username]);
            if (!user) return res.status(400).send("User not found");
            
            dbResponse = await db.any(`
                SELECT u.name, r.reply
                FROM "Reply" r
                JOIN "User" u ON r.user_id = u.user_id
                WHERE r.tweet_id = $1
                  AND r.tweet_id IN (
                    SELECT tweet_id
                    FROM "Tweet"
                    WHERE user_id IN (
                      SELECT following_user_id
                      FROM "Follower"
                      WHERE follower_user_id = $2
                    )
                  )
            `, [tweetId, user.user_id]);
        } else {
            // SQLite queries
            const getUserIdQuery = `SELECT user_id FROM User WHERE username = ?`;
            user = await db.get(getUserIdQuery, [username]);
            if (!user) return res.status(400).send("User not found");
            
            const getRepliesQuery = `
                SELECT u.name, r.reply
                FROM Reply r
                JOIN User u ON r.user_id = u.user_id
                WHERE r.tweet_id = ?
                  AND r.tweet_id IN (
                    SELECT tweet_id
                    FROM Tweet
                    WHERE user_id IN (
                      SELECT following_user_id
                      FROM Follower
                      WHERE follower_user_id = ?
                    )
                  )
            `;
            dbResponse = await db.all(getRepliesQuery, [tweetId, user.user_id]);
        }
        
        return res.send({ replies: dbResponse.map(repliesNames) });
    } catch (error) {
        console.error("Error fetching replies:", error);
        return res.status(500).send("Server error");
    }
  });
  

// Like a tweet
app.post("/tweets/:tweetId/like", authenticateToken, async (request, response) => {
    try {
        const { username } = request.user;
        const { tweetId } = request.params;
        let user, tweet, existingLike;

        if (process.env.NODE_ENV === 'production') {
            // PostgreSQL queries
            user = await db.oneOrNone('SELECT user_id FROM "User" WHERE username = $1', [username]);
            if (!user) return response.status(401).json({ error: "Unauthorized user" });
            
            tweet = await db.oneOrNone('SELECT user_id FROM "Tweet" WHERE tweet_id = $1', [tweetId]);
            if (!tweet) return response.status(404).json({ error: "Tweet not found" });
            
            existingLike = await db.oneOrNone(
                'SELECT * FROM "Like" WHERE user_id = $1 AND tweet_id = $2', 
                [user.user_id, tweetId]
            );
            
            if (existingLike) {
                await db.none('DELETE FROM "Like" WHERE user_id = $1 AND tweet_id = $2', [user.user_id, tweetId]);
            } else {
                await db.none(
                    'INSERT INTO "Like" (user_id, tweet_id) VALUES ($1, $2)', 
                    [user.user_id, tweetId]
                );
                
                try {
                    await db.none(
                        'INSERT INTO "Notification" (user_id, triggered_by_user_id, tweet_id, type, content, is_read) VALUES ($1, $2, $3, $4, $5, $6)',
                        [tweet.user_id, user.user_id, tweetId, 'like', `${username} liked your tweet.`, false]
                    );
                } catch (notifError) {
                    console.error("Error creating notification:", notifError);
                    // Continue even if notification creation fails
                }
            }
            
            // Get updated likes list with usernames
            const likes = await db.any(`
                SELECT u.username
                FROM "Like" l
                JOIN "User" u ON l.user_id = u.user_id
                WHERE l.tweet_id = $1
            `, [tweetId]);
            
            response.json({
                message: existingLike ? "Tweet unliked successfully" : "Tweet liked successfully",
                likes: likes.map(like => like.username),
                currentUser: username
            });
        } else {
            // SQLite queries
            const getUserIdQuery = `SELECT user_id FROM User WHERE username = ?`;
            user = await db.get(getUserIdQuery, [username]);
            if (!user) return response.status(401).json({ error: "Unauthorized user" });
            
            const getTweetQuery = `SELECT user_id FROM Tweet WHERE tweet_id = ?`;
            tweet = await db.get(getTweetQuery, [tweetId]);
            if (!tweet) return response.status(404).json({ error: "Tweet not found" });
            
            const checkLikeQuery = `SELECT * FROM Like WHERE user_id = ? AND tweet_id = ?`;
            existingLike = await db.get(checkLikeQuery, [user.user_id, tweetId]);
            
            if (existingLike) {
                await db.run(`DELETE FROM Like WHERE user_id = ? AND tweet_id = ?`, [user.user_id, tweetId]);
            } else {
                await db.run(`INSERT INTO Like (user_id, tweet_id) VALUES (?, ?)`, [user.user_id, tweetId]);
                
                try {
                    await db.run(
                        `INSERT INTO Notification (user_id, triggered_by_user_id, tweet_id, type, content, is_read) 
                        VALUES (?, ?, ?, ?, ?, ?)`,
                        [tweet.user_id, user.user_id, tweetId, 'like', `${username} liked your tweet.`, 0]
                    );
                } catch (notifError) {
                    console.error("Error creating notification:", notifError);
                    // Continue even if notification creation fails
                }
            }
            
            // Get updated likes list with usernames
            const likesQuery = `
                SELECT u.username
                FROM Like l
                JOIN User u ON l.user_id = u.user_id
                WHERE l.tweet_id = ?
            `;
            const likes = await db.all(likesQuery, [tweetId]);
            
            response.json({
                message: existingLike ? "Tweet unliked successfully" : "Tweet liked successfully",
                likes: likes.map(like => like.username),
                currentUser: username
            });
        }
    } catch (err) {
        console.error("Error handling like:", err);
        response.status(500).json({ error: "Internal server error" });
    }
});

// Reply to a tweet
app.post("/tweets/:tweetId/reply", authenticateToken, async (request, response) => {
    try {
        const { username } = request.user;
        const { tweetId } = request.params;
        const { replyText } = request.body;
        let user, tweet, isFollowing;

        if (process.env.NODE_ENV === 'production') {
            // PostgreSQL queries
            user = await db.oneOrNone('SELECT user_id FROM "User" WHERE username = $1', [username]);
            if (!user) return response.status(401).send({ error: "Unauthorized user" });
            
            tweet = await db.oneOrNone('SELECT user_id FROM "Tweet" WHERE tweet_id = $1', [tweetId]);
            if (!tweet) return response.status(404).send({ error: "Tweet not found" });
            
            isFollowing = await db.oneOrNone(
                'SELECT 1 FROM "Follower" WHERE follower_user_id = $1 AND following_user_id = $2',
                [user.user_id, tweet.user_id]
            );
            
            if (!isFollowing) return response.status(403).send({ error: "You can only reply to tweets from users you follow" });
            
            await db.none(
                'INSERT INTO "Reply" (user_id, tweet_id, reply) VALUES ($1, $2, $3)',
                [user.user_id, tweetId, replyText]
            );
            
            try {
                await db.none(
                    'INSERT INTO "Notification" (user_id, triggered_by_user_id, tweet_id, type, content, is_read) VALUES ($1, $2, $3, $4, $5, $6)',
                    [tweet.user_id, user.user_id, tweetId, 'reply', `${username} replied: "${replyText}"`, false]
                );
            } catch (notifError) {
                console.error("Error creating notification:", notifError);
                // Continue even if notification creation fails
            }
            
            // Get updated replies list with names
            const replies = await db.any(`
                SELECT u.name, r.reply
                FROM "Reply" r
                JOIN "User" u ON r.user_id = u.user_id
                WHERE r.tweet_id = $1
            `, [tweetId]);
            
            const formattedReplies = replies.map(item => ({
                name: item.name,
                reply: item.reply
            }));
            
            response.json({
                message: "Reply added successfully",
                replies: formattedReplies
            });
        } else {
            // SQLite queries
            const getUserIdQuery = `SELECT user_id FROM User WHERE username = ?`;
            user = await db.get(getUserIdQuery, [username]);
            if (!user) return response.status(401).send({ error: "Unauthorized user" });
            
            const getTweetQuery = `SELECT user_id FROM Tweet WHERE tweet_id = ?`;
            tweet = await db.get(getTweetQuery, [tweetId]);
            if (!tweet) return response.status(404).send({ error: "Tweet not found" });
            
            const checkFollowQuery = `
                SELECT 1 FROM Follower 
                WHERE follower_user_id = ? AND following_user_id = ?
            `;
            isFollowing = await db.get(checkFollowQuery, [user.user_id, tweet.user_id]);
            
            if (!isFollowing) return response.status(403).send({ error: "You can only reply to tweets from users you follow" });
            
            await db.run(`INSERT INTO Reply (user_id, tweet_id, reply) VALUES (?, ?, ?)`, [user.user_id, tweetId, replyText]);
            
            try {
                await db.run(
                    `INSERT INTO Notification (user_id, triggered_by_user_id, tweet_id, type, content, is_read) 
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [tweet.user_id, user.user_id, tweetId, 'reply', `${username} replied: "${replyText}"`, 0]
                );
            } catch (notifError) {
                console.error("Error creating notification:", notifError);
                // Continue even if notification creation fails
            }
            
            // Get updated replies list with names
            const repliesQuery = `
                SELECT u.name, r.reply
                FROM Reply r
                JOIN User u ON r.user_id = u.user_id
                WHERE r.tweet_id = ?
            `;
            const replies = await db.all(repliesQuery, [tweetId]);
            
            const formattedReplies = replies.map(item => ({
                name: item.name,
                reply: item.reply
            }));
            
            response.json({
                message: "Reply added successfully",
                replies: formattedReplies
            });
        }
    } catch (err) {
        console.error("Error handling reply:", err);
        response.status(500).json({ error: "Internal server error" });
    }
});


convertToCamelCaseForFollowers=(user)=>{
    return {name:user.name}
}
app.get('/profile', authenticateToken, async (req, res) => {
    try {
        const { username } = req.user;
        let user, followers, following;
        
        if (process.env.NODE_ENV === 'production') {
            // PostgreSQL queries
            user = await db.oneOrNone('SELECT user_id, name, username FROM "User" WHERE username = $1', [username]);
            
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            // Get follower and following counts
            const followersResult = await db.one('SELECT COUNT(*) as count FROM "Follower" WHERE following_user_id = $1', [user.user_id]);
            const followingResult = await db.one('SELECT COUNT(*) as count FROM "Follower" WHERE follower_user_id = $1', [user.user_id]);
            
            followers = parseInt(followersResult.count) || 0;
            following = parseInt(followingResult.count) || 0;
        } else {
            // SQLite queries
            const getUserIdQuery = 'SELECT user_id, name, username FROM User WHERE username = ?';
            user = await db.get(getUserIdQuery, [username]);
            
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            // Get follower and following counts
            const getFollowersCountQuery = 'SELECT COUNT(*) as count FROM Follower WHERE following_user_id = ?';
            const getFollowingCountQuery = 'SELECT COUNT(*) as count FROM Follower WHERE follower_user_id = ?';
            
            const followersResult = await db.get(getFollowersCountQuery, [user.user_id]);
            const followingResult = await db.get(getFollowingCountQuery, [user.user_id]);
            
            followers = followersResult ? followersResult.count : 0;
            following = followingResult ? followingResult.count : 0;
        }

        res.json({
            username: user.username,
            name: user.name,
            followersCount: followers,
            followingCount: following
        });
    } catch (error) {
        console.error('Error in profile endpoint:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
  
app.get("/user/followers/", authenticateToken, async (request, response) => {
    try {
        const { username } = request.user;
        let user, followers;
        
        if (process.env.NODE_ENV === 'production') {
            // PostgreSQL queries
            user = await db.oneOrNone('SELECT user_id FROM "User" WHERE username = $1', [username]);
            if (!user) return response.status(400).send("User not found");
            
            followers = await db.any(`
                SELECT u.name
                FROM "User" u
                JOIN "Follower" f ON u.user_id = f.follower_user_id
                WHERE f.following_user_id = $1
            `, [user.user_id]);
        } else {
            // SQLite queries
            const getUserIdQuery = `SELECT user_id FROM User WHERE username = ?`;
            user = await db.get(getUserIdQuery, [username]);
            if (!user) return response.status(400).send("User not found");
            
            const getNamesQuery = `
                SELECT User.name
                FROM User JOIN Follower ON User.user_id = Follower.follower_user_id
                WHERE Follower.following_user_id = ?
            `;
            followers = await db.all(getNamesQuery, [user.user_id]);
        }
        
        response.send(followers.map(convertToCamelCaseForFollowers));
    } catch (error) {
        console.error("Error fetching followers:", error);
        response.status(500).send("Internal Server Error");
    }
});

app.get("/user/following/", authenticateToken, async (request, response) => {
    try {
        const { username } = request.user;
        let user, following;
        
        if (process.env.NODE_ENV === 'production') {
            // PostgreSQL queries
            user = await db.oneOrNone('SELECT user_id FROM "User" WHERE username = $1', [username]);
            if (!user) return response.status(400).send("User not found");
            
            following = await db.any(`
                SELECT u.name
                FROM "User" u
                JOIN "Follower" f ON u.user_id = f.following_user_id
                WHERE f.follower_user_id = $1
            `, [user.user_id]);
        } else {
            // SQLite queries
            const getUserIdQuery = `SELECT user_id FROM User WHERE username = ?`;
            user = await db.get(getUserIdQuery, [username]);
            if (!user) return response.status(400).send("User not found");
            
            const getNamesQuery = `
                SELECT User.name
                FROM User JOIN Follower ON User.user_id = Follower.following_user_id
                WHERE Follower.follower_user_id = ?
            `;
            following = await db.all(getNamesQuery, [user.user_id]);
        }
        
        response.send(following.map(convertToCamelCaseForFollowers));
    } catch (error) {
        console.error("Error fetching following:", error);
        response.status(500).send("Internal Server Error");
    }
});

const convertsnakecaseToCamelCase=(tweetDetails)=>{
    return {
        tweetId:tweetDetails.tweet_id,
        tweet:tweetDetails.tweet,
        likes:tweetDetails.likes,
        replies:tweetDetails.replies,
        dateTime:tweetDetails.date_time
    }
}
app.get("/tweets/:tweetId/", authenticateToken, async (request, response) => {
    try {
        const { username } = request.user;
        const { tweetId } = request.params;
        let user, dbResponse;
        
        if (process.env.NODE_ENV === 'production') {
            // PostgreSQL queries
            user = await db.oneOrNone('SELECT user_id FROM "User" WHERE username = $1', [username]);
            if (!user) return response.status(400).send("User not found");
            
            dbResponse = await db.oneOrNone(`
                SELECT 
                    t.tweet_id as tweet_id,
                    t.tweet,
                    COUNT(DISTINCT l.like_id) AS likes,
                    COUNT(DISTINCT r.reply_id) AS replies,
                    t.date_time
                FROM "Tweet" t
                LEFT JOIN "Like" l ON t.tweet_id = l.tweet_id
                LEFT JOIN "Reply" r ON t.tweet_id = r.tweet_id
                WHERE t.tweet_id = $1  
                AND t.user_id IN (
                    SELECT f.following_user_id FROM "Follower" f WHERE f.follower_user_id = $2
                )
                GROUP BY t.tweet_id, t.tweet, t.date_time
            `, [tweetId, user.user_id]);
        } else {
            // SQLite queries
            const getUserIdQuery = `SELECT user_id FROM User WHERE username ='${username}'`;
            user = await db.get(getUserIdQuery);
            if (!user) return response.status(400).send("User not found");
            
            const getTweetsQuery = `
                SELECT 
                    t.tweet_id as tweet_id,
                    t.tweet,
                    COUNT(DISTINCT l.like_id) AS likes,
                    COUNT(DISTINCT r.reply_id) AS replies,
                    t.date_time
                FROM Tweet t
                LEFT JOIN Like l ON t.tweet_id = l.tweet_id
                LEFT JOIN Reply r ON t.tweet_id = r.tweet_id
                WHERE t.tweet_id = ${tweetId}  
                AND t.user_id IN (
                    SELECT f.following_user_id FROM Follower f WHERE f.follower_user_id = ${user.user_id}
                )
                GROUP BY t.tweet_id;
            `;
            dbResponse = await db.get(getTweetsQuery);
        }
        
        if (!dbResponse) {
            return response.status(401).send("Invalid Request");
        }
        
        return response.send(convertsnakecaseToCamelCase(dbResponse));
    } catch (error) {
        console.error("Error fetching tweet:", error);
        return response.status(500).send("Internal Server Error");
    }
});

const convertToCamelCaseForReplies=(replies)=>({
    tweetId:replies.tweet_id,
    name:replies.name,
    reply:replies.reply
})
app.get("/user/tweets/replies/", authenticateToken, async (request, response) => {
    try {
        const { username } = request.user;
        let user, replies;
        
        if (process.env.NODE_ENV === 'production') {
            // PostgreSQL queries
            user = await db.oneOrNone('SELECT user_id FROM "User" WHERE username = $1', [username]);
            if (!user) return response.status(400).send("User not found");
            
            replies = await db.any(`
                SELECT t.tweet_id, u.name, r.reply 
                FROM "Tweet" t 
                JOIN "Reply" r ON t.tweet_id = r.tweet_id 
                JOIN "User" u ON r.user_id = u.user_id 
                WHERE t.user_id = $1
            `, [user.user_id]);
        } else {
            // SQLite queries
            const getUserIdQuery = `SELECT user_id FROM User WHERE username = ?`;
            user = await db.get(getUserIdQuery, [username]);
            if (!user) return response.status(400).send("User not found");
            
            const getOwnTweetRepliesQuery = `
                SELECT t.tweet_id, u.name, r.reply 
                FROM Tweet t 
                JOIN Reply r ON t.tweet_id = r.tweet_id 
                JOIN User u ON r.user_id = u.user_id 
                WHERE t.user_id = ?
            `;
            replies = await db.all(getOwnTweetRepliesQuery, [user.user_id]);
        }
        
        response.send(replies.map((eachItem) => convertToCamelCaseForReplies(eachItem)));
    } catch (error) {
        console.error("Error fetching tweet replies:", error);
        response.status(500).send("Internal Server Error");
    }
});

const convertToCamelCaseForLikes=(replies)=>({
    tweetId:replies.tweet_id,
    name:replies.name
})
app.get("/user/tweets/likes/", authenticateToken, async (request, response) => {
    try {
        const { username } = request.user;
        let user, likes;
        
        if (process.env.NODE_ENV === 'production') {
            // PostgreSQL queries
            user = await db.oneOrNone('SELECT user_id FROM "User" WHERE username = $1', [username]);
            if (!user) return response.status(400).send("User not found");
            
            likes = await db.any(`
                SELECT t.tweet_id, u.name 
                FROM "Tweet" t 
                JOIN "Like" l ON t.tweet_id = l.tweet_id 
                JOIN "User" u ON l.user_id = u.user_id 
                WHERE t.user_id = $1
            `, [user.user_id]);
        } else {
            // SQLite queries
            const getUserIdQuery = `SELECT user_id FROM User WHERE username = ?`;
            user = await db.get(getUserIdQuery, [username]);
            if (!user) return response.status(400).send("User not found");
            
            const getOwnTweetLikesQuery = `
                SELECT t.tweet_id, u.name 
                FROM Tweet t 
                JOIN Like l ON t.tweet_id = l.tweet_id 
                JOIN User u ON l.user_id = u.user_id 
                WHERE t.user_id = ?
            `;
            likes = await db.all(getOwnTweetLikesQuery, [user.user_id]);
        }
        
        response.send(likes.map((eachItem) => convertToCamelCaseForLikes(eachItem)));
    } catch (error) {
        console.error("Error fetching tweet likes:", error);
        response.status(500).send("Internal Server Error");
    }
});
  
    

app.post("/user/tweets", authenticateToken, async (request, response) => {
    try {
        const { username } = request.user;
        let user;
        
        if (process.env.NODE_ENV === 'production') {
            // PostgreSQL query
            user = await db.oneOrNone('SELECT user_id FROM "User" WHERE username = $1', [username]);
        } else {
            // SQLite query
            user = await db.get("SELECT user_id FROM User WHERE username = ?", [username]);
        }

        if (!user) {
            return response.status(400).send("Invalid user");
        }

        const { tweet } = request.body;

        if (!tweet || tweet.trim() === "") {
            return response.status(400).send("Tweet cannot be empty.");
        }

        if (process.env.NODE_ENV === 'production') {
            // PostgreSQL query
            await db.none('INSERT INTO "Tweet" (tweet, user_id) VALUES ($1, $2)', [tweet, user.user_id]);
        } else {
            // SQLite query
            await db.run("INSERT INTO Tweet (tweet, user_id) VALUES (?, ?)", [tweet, user.user_id]);
        }

        return response.status(201).json({
            message: "Created a Tweet",
            tweet: {
                tweet,
                likes: 0,
                replies: 0,
                dateTime: new Date().toISOString()
            }
        });
          
    } catch (error) {
        console.error("Error posting tweet:", error);
        return response.status(500).send("Internal Server Error");
    }
});

app.get("/user/tweets/", authenticateToken, async (request, response) => {
    try {
        const { username } = request.user;
        let user, dbResponse;
        
        if (process.env.NODE_ENV === 'production') {
            // PostgreSQL queries
            user = await db.oneOrNone('SELECT user_id FROM "User" WHERE username = $1', [username]);
            if (!user) return response.status(400).send("User not found");
            
            dbResponse = await db.any(`
                SELECT
                    t.tweet_id AS tweet_id,
                    t.tweet, 
                    COUNT(DISTINCT l.like_id) AS likes,
                    COUNT(DISTINCT r.reply_id) AS replies,
                    t.date_time
                FROM "Tweet" t
                LEFT JOIN "Like" l ON t.tweet_id = l.tweet_id
                LEFT JOIN "Reply" r ON t.tweet_id = r.tweet_id
                WHERE t.user_id = $1
                GROUP BY t.tweet_id, t.tweet, t.date_time
                ORDER BY t.date_time DESC
            `, [user.user_id]);
        } else {
            // SQLite queries
            user = await db.get("SELECT user_id FROM User WHERE username = ?", [username]);
            if (!user) return response.status(400).send("User not found");
            
            const getTweetsQuery = `
                SELECT
                    t.tweet_id AS tweet_id,
                    t.tweet, 
                    COUNT(DISTINCT l.like_id) AS likes,
                    COUNT(DISTINCT r.reply_id) AS replies,
                    t.date_time
                FROM Tweet t
                LEFT JOIN Like l ON t.tweet_id = l.tweet_id
                LEFT JOIN Reply r ON t.tweet_id = r.tweet_id
                WHERE t.user_id = ?
                GROUP BY t.tweet_id
                ORDER BY t.date_time DESC;`;
            dbResponse = await db.all(getTweetsQuery, [user.user_id]);
        }
        
        return response.send(dbResponse.map(convertsnakecaseToCamelCase));
    } catch (error) {
        console.error("Error getting tweets:", error);
        return response.status(500).send("Internal Server Error");
    }
});

app.delete("/tweets/:tweetId/", authenticateToken, async (request, response) => {
    try {
        const { username } = request.user;
        const { tweetId } = request.params;
        let user, tweet;
        
        if (process.env.NODE_ENV === 'production') {
            // PostgreSQL queries
            user = await db.oneOrNone('SELECT user_id FROM "User" WHERE username = $1', [username]);
            if (!user) return response.status(400).send("User not found");
            
            tweet = await db.oneOrNone('SELECT user_id FROM "Tweet" WHERE tweet_id = $1', [tweetId]);
        } else {
            // SQLite queries
            user = await db.get("SELECT user_id FROM User WHERE username = ?", [username]);
            if (!user) return response.status(400).send("User not found");
            
            tweet = await db.get(`SELECT user_id FROM Tweet WHERE tweet_id = ${tweetId}`);
        }
        
        if (!tweet || tweet.user_id !== user.user_id) {
            return response.status(401).send("Invalid Request");
        }
        
        if (process.env.NODE_ENV === 'production') {
            // PostgreSQL query
            await db.none('DELETE FROM "Tweet" WHERE tweet_id = $1', [tweetId]);
        } else {
            // SQLite query
            await db.run(`DELETE FROM Tweet WHERE tweet_id = ${tweetId}`);
        }
        
        return response.send("Tweet Removed");
    } catch (error) {
        console.error("Error deleting tweet:", error);
        return response.status(500).send("Internal Server Error");
    }
});

app.get('/notifications/', authenticateToken, async (request, response) => {
    try {
        const { username } = request.user;
        let user, notifications;
        
        if (process.env.NODE_ENV === 'production') {
            // PostgreSQL queries
            user = await db.oneOrNone('SELECT user_id FROM "User" WHERE username = $1', [username]);
            if (!user) return response.status(400).send("User not found");
            
            try {
                notifications = await db.any(`
                    SELECT n.id as notification_id, n.message as content, n.created_at as date_time, 
                           n.is_read, u.username as triggered_by_username 
                    FROM "Notifications" n
                    LEFT JOIN "User" u ON n.from_user_id = u.user_id
                    WHERE n.user_id = $1
                    ORDER BY n.created_at DESC
                `, [user.user_id]);
            } catch (dbError) {
                console.error("Database error (trying fallback query):", dbError);
                // Fallback to alternative table structure
                notifications = await db.any(`
                    SELECT n.id as notification_id, n.message as content, n.created_at as date_time, 
                           n.is_read, u.username as triggered_by_username 
                    FROM "Notification" n
                    LEFT JOIN "User" u ON n.triggered_by_user_id = u.user_id
                    WHERE n.user_id = $1
                    ORDER BY n.created_at DESC
                `, [user.user_id]);
            }
        } else {
            // SQLite query
            const getUserIdQuery = `SELECT user_id FROM User WHERE username = ?`;
            user = await db.get(getUserIdQuery, [username]);
            if (!user) return response.status(400).send("User not found");
            
            try {
                const getNotificationsQuery = `
                    SELECT n.id as notification_id, n.message as content, n.date_time, 
                           n.is_read, u.username as triggered_by_username 
                    FROM Notifications n
                    LEFT JOIN User u ON n.from_user_id = u.user_id
                    WHERE n.user_id = ?
                    ORDER BY n.date_time DESC
                `;
                notifications = await db.all(getNotificationsQuery, [user.user_id]);
            } catch (dbError) {
                console.error("Database error (trying fallback query):", dbError);
                // Try alternative table structure
                const getNotificationsQuery = `
                    SELECT n.id as notification_id, n.content, n.date_time, 
                           n.is_read, u.username as triggered_by_username 
                    FROM Notification n
                    LEFT JOIN User u ON n.triggered_by_user_id = u.user_id
                    WHERE n.user_id = ?
                    ORDER BY n.date_time DESC
                `;
                notifications = await db.all(getNotificationsQuery, [user.user_id]);
            }
        }
        
        return response.json(notifications || []);
    } catch (error) {
        console.error("Error fetching notifications:", error);
        return response.status(500).send("Server error");
    }
});