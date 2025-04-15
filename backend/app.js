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

// CORS settings
const allowedOrigins = [
    'http://localhost:3000',
    'https://vyshnavi005-max.github.io',
    'https://twitter-clone-backend-534j.onrender.com',
];

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps, curl requests)
        if (!origin) return callback(null, true);
        
        console.log("Request from origin:", origin);
        
        if (allowedOrigins.indexOf(origin) !== -1) {
            console.log("Request from allowed origin:", origin);
            callback(null, true);
        } else {
            console.log("Request from unauthorized origin:", origin);
            callback(null, true); // Allow all origins for now
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Handle preflight OPTIONS requests
app.options('*', (req, res) => {
    console.log("Preflight OPTIONS request received");
    res.status(200).end();
});

// Add express.json middleware
app.use(express.json());
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

// DB helper functions to standardize queries across environments
const dbHelpers = {
  // User queries
  getUserByUsername: async (username) => {
    try {
      console.log(`Looking up user by username: ${username}`);
      if (process.env.NODE_ENV === 'production') {
        return await db.oneOrNone('SELECT * FROM "User" WHERE username = $1', [username]);
      } else {
        return await db.get('SELECT * FROM User WHERE username = ?', [username]);
      }
    } catch (error) {
      console.error(`Error in getUserByUsername for ${username}:`, error);
      throw error;
    }
  },
  
  getUserById: async (userId) => {
    try {
      console.log(`Looking up user by ID: ${userId}`);
      if (process.env.NODE_ENV === 'production') {
        return await db.oneOrNone('SELECT * FROM "User" WHERE user_id = $1', [userId]);
      } else {
        return await db.get('SELECT * FROM User WHERE user_id = ?', [userId]);
      }
    } catch (error) {
      console.error(`Error in getUserById for ID ${userId}:`, error);
      throw error;
    }
  },
  
  // Tweet queries
  getTweetById: async (tweetId) => {
    try {
      console.log(`Looking up tweet by ID: ${tweetId}`);
      const query = process.env.NODE_ENV === 'production'
        ? 'SELECT * FROM "Tweet" WHERE tweet_id = $1'
        : 'SELECT * FROM Tweet WHERE tweet_id = ?';
        
      return await dbHelpers.execute(query, [tweetId]);
    } catch (error) {
      console.error(`Error in getTweetById for ID ${tweetId}:`, error);
      throw error;
    }
  },
  
  // Generic execution helpers
  execute: async (query, params = []) => {
    // Normalize the query for pattern matching
    const normalizedQuery = query.trim().toLowerCase();
    
    try {
      console.log(`Executing query in ${process.env.NODE_ENV} mode:`, query);
      console.log('With params:', JSON.stringify(params));
      
      if (process.env.NODE_ENV === 'production') {
        // For PostgreSQL
        // Replace ? parameters with $1, $2, etc. if needed
        let pgQuery = query;
        if (pgQuery.includes('?')) {
          console.log('Converting ? parameters to $n format for PostgreSQL');
          // Replace ? with $1, $2, etc.
          let paramIndex = 0;
          pgQuery = pgQuery.replace(/\?/g, () => `$${++paramIndex}`);
          console.log('Converted query:', pgQuery);
        }
        
        // Determine the right method based on expected result
        if (normalizedQuery.startsWith('select')) {
          // Handle COUNT queries which may return a single row with count
          if (normalizedQuery.includes('count(') || normalizedQuery.includes(' count ')) {
            return await db.oneOrNone(pgQuery, params);
          }
          // Handle queries expected to return at most one row
          else if (normalizedQuery.includes('limit 1') || 
              (normalizedQuery.includes('where') && 
              (normalizedQuery.includes('user_id =') || normalizedQuery.includes('tweet_id =') || 
               normalizedQuery.includes('username =')))) {
            return await db.oneOrNone(pgQuery, params);
          } 
          // Default to any for multiple results
          else {
            return await db.any(pgQuery, params);
          }
        } else {
          // For non-SELECT queries (INSERT, UPDATE, DELETE)
          return await db.none(pgQuery, params);
        }
      } else {
        // For SQLite
        if (normalizedQuery.startsWith('select')) {
          // Handle COUNT queries
          if (normalizedQuery.includes('count(') || normalizedQuery.includes(' count ')) {
            return await db.get(query, params);
          }
          // Handle queries expected to return at most one row
          else if (normalizedQuery.includes('limit 1') || 
              (normalizedQuery.includes('where') && 
              (normalizedQuery.includes('user_id =') || normalizedQuery.includes('tweet_id =') ||
               normalizedQuery.includes('username =')))) {
            return await db.get(query, params);
          } 
          // Default to all for multiple results
          else {
            return await db.all(query, params);
          }
        } else {
          // For non-SELECT queries
          return await db.run(query, params);
        }
      }
    } catch (error) {
      console.error(`Database error executing query: ${query}`);
      console.error(`With params: ${JSON.stringify(params)}`);
      console.error(`Error details: ${error.message}`);
      console.error(error.stack);
      throw error;
    }
  }
};

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
            return response.status(401).json({ 
                error: "Authentication required", 
                message: "Please log in to access this resource"
            });
        }
        
        // Verify the token
        let payload;
        try {
            payload = jwt.verify(jwtToken, process.env.JWT_SECRET);
        } catch (jwtError) {
            console.log("JWT verification error:", jwtError.message);
            
            if (jwtError.name === 'TokenExpiredError') {
                return response.status(401).json({ 
                    error: "Token expired", 
                    message: "Your session has expired. Please log in again."
                });
            }
            
            return response.status(401).json({ 
                error: "Invalid token", 
                message: "Authentication failed. Please log in again."
            });
        }
        
        // Get user details using helper function
        const user = await dbHelpers.getUserByUsername(payload.username);
        
        if (!user) {
            console.log("User not found in database:", payload.username);
            return response.status(401).json({ 
                error: "User not found", 
                message: "The user associated with this token no longer exists."
            });
        }
        
        // Add user to request object
        request.user = {
            userId: user.user_id,
            username: user.username
        };
        
        next();
    } catch (err) {
        console.log("Authentication error:", err.message);
        console.error(err.stack);
        return response.status(500).json({ 
            error: "Authentication error", 
            message: "An error occurred during authentication."
        });
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
            dbUser = await dbHelpers.getUserByUsername(username);
            
            if (dbUser == undefined) {
                const hashedPassword = await bcrypt.hash(password, 10);
                
                // Insert new user
                await dbHelpers.execute(
                    'INSERT INTO "User"(name, username, password, gender) VALUES($1, $2, $3, $4)',
                    [name, username, hashedPassword, gender]
                );
                
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
app.post("/login", async (request, response) => {
    console.log("Login request received", request.body);
    
    try {
        const { username, password } = request.body;
        
        if (!username || !password) {
            return response.status(400).json({ 
                success: false,
                message: "Username and password are required" 
            });
        }
        
        let user;
        
        // Fetch user based on environment
        user = await dbHelpers.getUserByUsername(username);
        
        if (!user) {
            return response.status(401).json({ 
                success: false,
                message: "Invalid username or password" 
            });
        }
        
        // Compare password
        const passwordMatch = await bcrypt.compare(password, user.password);
        
        if (!passwordMatch) {
            return response.status(401).json({ 
                success: false,
                message: "Invalid username or password" 
            });
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
        
        // Log successful login
        console.log(`User ${username} logged in successfully`);
        
        // Send success response with token
        return response.status(200).json({
            success: true,
            message: "Login successful",
            user: {
                username: user.username,
                userId: user.user_id,
                profilePic: user.profile_pic
            },
            token: token
        });
    } catch (error) {
        console.error("Login error:", error);
        return response.status(500).json({ 
            success: false,
            message: "Server error during login" 
        });
    }
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
        
        // Get current user
        const user = await dbHelpers.getUserByUsername(username);
        if (!user) return response.status(400).json({ error: "User not found" });
        
        // For PostgreSQL, Properly quote table and column names
        const query = process.env.NODE_ENV === 'production' 
          ? `
              SELECT u.username, t.tweet_id, t.tweet, t.date_time
              FROM "Tweet" t
              JOIN "Follower" f ON t.user_id = f.following_user_id
              JOIN "User" u ON u.user_id = t.user_id
              WHERE f.follower_user_id = $1
              ORDER BY t.date_time DESC
              LIMIT 10
          `
          : `
              SELECT User.username, Tweet.tweet_id, Tweet.tweet, Tweet.date_time
              FROM Tweet
              JOIN Follower ON Tweet.user_id = Follower.following_user_id
              JOIN User ON User.user_id = Tweet.user_id
              WHERE Follower.follower_user_id = ?
              ORDER BY Tweet.date_time DESC
              LIMIT 10
          `;
        
        const dbResponse = await dbHelpers.execute(query, [user.user_id]);
        
        // Add more logging to debug the response
        console.log(`Feed found ${dbResponse ? dbResponse.length : 0} tweets for user ${username}`);
        
        // Ensure dbResponse is an array before mapping
        const tweets = Array.isArray(dbResponse) ? dbResponse.map(convertToCamelCaseForTweets) : [];
        response.json(tweets);
    } catch (error) {
        console.error("Error fetching tweet feed:", error);
        console.error(error.stack); // Log the full stack trace
        response.status(500).json({ error: "Server error", message: error.message });
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
        
        user = await dbHelpers.getUserByUsername(username);
        if (!user) return res.status(400).send("User not found");
        
        dbResponse = await dbHelpers.execute(`
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
        
        user = await dbHelpers.getUserByUsername(username);
        if (!user) return res.status(400).send("User not found");
        
        dbResponse = await dbHelpers.execute(`
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
        
        console.log(`User ${username} attempting to like tweet ${tweetId}`);
        
        // Get user
        const user = await dbHelpers.getUserByUsername(username);
        if (!user) {
            console.log(`User ${username} not found in database`);
            return response.status(401).json({ error: "Unauthorized user" });
        }
        
        // Get tweet
        const tweet = await dbHelpers.getTweetById(tweetId);
        if (!tweet) {
            console.log(`Tweet ${tweetId} not found in database`);
            return response.status(404).json({ error: "Tweet not found" });
        }
        
        // Check if already liked
        const selectQuery = process.env.NODE_ENV === 'production'
            ? 'SELECT * FROM "Like" WHERE user_id = $1 AND tweet_id = $2'
            : 'SELECT * FROM Like WHERE user_id = ? AND tweet_id = ?';
        
        const existingLike = await dbHelpers.execute(selectQuery, [user.user_id, tweetId]);
        console.log(`Existing like check result:`, existingLike);
        
        if (existingLike) {
            // Unlike
            const deleteQuery = process.env.NODE_ENV === 'production'
                ? 'DELETE FROM "Like" WHERE user_id = $1 AND tweet_id = $2'
                : 'DELETE FROM Like WHERE user_id = ? AND tweet_id = ?';
            
            await dbHelpers.execute(deleteQuery, [user.user_id, tweetId]);
            console.log(`User ${username} unliked tweet ${tweetId}`);
        } else {
            // Like
            const insertQuery = process.env.NODE_ENV === 'production'
                ? 'INSERT INTO "Like" (user_id, tweet_id) VALUES ($1, $2)'
                : 'INSERT INTO Like (user_id, tweet_id) VALUES (?, ?)';
            
            await dbHelpers.execute(insertQuery, [user.user_id, tweetId]);
            console.log(`User ${username} liked tweet ${tweetId}`);
            
            // Create notification
            try {
                const notifQuery = process.env.NODE_ENV === 'production'
                    ? 'INSERT INTO "Notifications" (user_id, from_user_id, tweet_id, type, message, is_read) VALUES ($1, $2, $3, $4, $5, $6)'
                    : 'INSERT INTO Notifications (user_id, from_user_id, tweet_id, type, message, is_read) VALUES (?, ?, ?, ?, ?, ?)';
                
                await dbHelpers.execute(notifQuery, [
                    tweet.user_id, 
                    user.user_id, 
                    tweetId, 
                    'like', 
                    `${username} liked your tweet.`, 
                    false
                ]);
            } catch (notifError) {
                console.error("Error creating notification:", notifError);
                // Continue even if notification creation fails
            }
        }
        
        // Get updated likes
        const likesQuery = process.env.NODE_ENV === 'production'
            ? `SELECT u.username FROM "Like" l JOIN "User" u ON l.user_id = u.user_id WHERE l.tweet_id = $1`
            : `SELECT u.username FROM Like l JOIN User u ON l.user_id = u.user_id WHERE l.tweet_id = ?`;
        
        const likes = await dbHelpers.execute(likesQuery, [tweetId]);
        console.log(`Updated likes for tweet ${tweetId}:`, likes);
        
        response.json({
            message: existingLike ? "Tweet unliked successfully" : "Tweet liked successfully",
            likes: Array.isArray(likes) ? likes.map(like => like.username) : [],
            currentUser: username
        });
    } catch (err) {
        console.error("Error handling like:", err);
        console.error(err.stack);
        response.status(500).json({ error: "Internal server error", message: err.message });
    }
});

// Reply to a tweet
app.post("/tweets/:tweetId/reply", authenticateToken, async (request, response) => {
    try {
        const { username } = request.user;
        const { tweetId } = request.params;
        const { replyText } = request.body;
        
        console.log(`User ${username} attempting to reply to tweet ${tweetId}`);
        
        if (!replyText || replyText.trim() === '') {
            return response.status(400).json({ error: "Reply text cannot be empty" });
        }
        
        // Get user
        const user = await dbHelpers.getUserByUsername(username);
        if (!user) {
            console.log(`User ${username} not found in database`);
            return response.status(401).json({ error: "Unauthorized user" });
        }
        
        // Get tweet
        const tweet = await dbHelpers.getTweetById(tweetId);
        if (!tweet) {
            console.log(`Tweet ${tweetId} not found in database`);
            return response.status(404).json({ error: "Tweet not found" });
        }
        
        // Check if following
        const followingQuery = process.env.NODE_ENV === 'production'
            ? 'SELECT 1 FROM "Follower" WHERE follower_user_id = $1 AND following_user_id = $2'
            : 'SELECT 1 FROM Follower WHERE follower_user_id = ? AND following_user_id = ?';
        
        const isFollowing = await dbHelpers.execute(followingQuery, [user.user_id, tweet.user_id]);
        
        if (!isFollowing && user.user_id !== tweet.user_id) {
            console.log(`User ${username} is not following tweet author and is not the author`);
            return response.status(403).json({ 
                error: "You can only reply to tweets from users you follow or your own tweets" 
            });
        }
        
        // Add reply
        const insertQuery = process.env.NODE_ENV === 'production'
            ? 'INSERT INTO "Reply" (user_id, tweet_id, reply) VALUES ($1, $2, $3)'
            : 'INSERT INTO Reply (user_id, tweet_id, reply) VALUES (?, ?, ?)';
        
        await dbHelpers.execute(insertQuery, [user.user_id, tweetId, replyText]);
        console.log(`User ${username} replied to tweet ${tweetId}`);
        
        // Create notification if the reply is not to the user's own tweet
        if (user.user_id !== tweet.user_id) {
            try {
                const notifQuery = process.env.NODE_ENV === 'production'
                    ? 'INSERT INTO "Notifications" (user_id, from_user_id, tweet_id, type, message, is_read) VALUES ($1, $2, $3, $4, $5, $6)'
                    : 'INSERT INTO Notifications (user_id, from_user_id, tweet_id, type, message, is_read) VALUES (?, ?, ?, ?, ?, ?)';
                
                await dbHelpers.execute(notifQuery, [
                    tweet.user_id, 
                    user.user_id, 
                    tweetId, 
                    'reply', 
                    `${username} replied to your tweet: "${replyText.substring(0, 30)}${replyText.length > 30 ? '...' : ''}"`, 
                    false
                ]);
            } catch (notifError) {
                console.error("Error creating notification:", notifError);
                // Continue even if notification creation fails
            }
        }
        
        // Get updated replies
        const repliesQuery = process.env.NODE_ENV === 'production'
            ? `
                SELECT u.name, r.reply
                FROM "Reply" r
                JOIN "User" u ON r.user_id = u.user_id
                WHERE r.tweet_id = $1
                ORDER BY r.date_time DESC
            `
            : `
                SELECT u.name, r.reply
                FROM Reply r
                JOIN User u ON r.user_id = u.user_id
                WHERE r.tweet_id = ?
                ORDER BY r.date_time DESC
            `;
        
        const replies = await dbHelpers.execute(repliesQuery, [tweetId]);
        console.log(`Updated replies for tweet ${tweetId}:`, replies ? replies.length : 0);
        
        const formattedReplies = Array.isArray(replies) ? replies.map(item => ({
            name: item.name,
            reply: item.reply
        })) : [];
        
        response.json({
            message: "Reply added successfully",
            replies: formattedReplies
        });
    } catch (err) {
        console.error("Error handling reply:", err);
        console.error(err.stack);
        response.status(500).json({ error: "Internal server error", message: err.message });
    }
});


convertToCamelCaseForFollowers=(user)=>{
    return {name:user.name}
}
app.get('/profile', authenticateToken, async (req, res) => {
    try {
        const { username } = req.user;
        console.log(`Fetching profile for user: ${username}`);
        
        // Get user details
        const user = await dbHelpers.getUserByUsername(username);
        
        if (!user) {
            console.log(`User not found: ${username}`);
            return res.status(404).json({ error: 'User not found' });
        }

        console.log(`Found user: ${user.username} (ID: ${user.user_id})`);

        // Use more consistent SQL for count queries
        const followersQuery = process.env.NODE_ENV === 'production' 
            ? 'SELECT COUNT(*) as count FROM "Follower" WHERE following_user_id = $1'
            : 'SELECT COUNT(*) as count FROM Follower WHERE following_user_id = ?';
            
        const followingQuery = process.env.NODE_ENV === 'production'
            ? 'SELECT COUNT(*) as count FROM "Follower" WHERE follower_user_id = $1'
            : 'SELECT COUNT(*) as count FROM Follower WHERE follower_user_id = ?';

        // Get follower and following counts
        let followersResult, followingResult;
        
        try {
            followersResult = await dbHelpers.execute(followersQuery, [user.user_id]);
            console.log("Followers query result:", followersResult);
        } catch (err) {
            console.error("Error fetching followers count:", err);
            followersResult = { count: 0 };
        }
        
        try {
            followingResult = await dbHelpers.execute(followingQuery, [user.user_id]);
            console.log("Following query result:", followingResult);
        } catch (err) {
            console.error("Error fetching following count:", err);
            followingResult = { count: 0 };
        }
        
        // Handle different db result formats safely
        const followersCount = followersResult && 
            (typeof followersResult.count !== 'undefined' 
                ? parseInt(followersResult.count) 
                : (Array.isArray(followersResult) && followersResult.length > 0 && followersResult[0].count 
                    ? parseInt(followersResult[0].count) 
                    : 0));
            
        const followingCount = followingResult && 
            (typeof followingResult.count !== 'undefined'
                ? parseInt(followingResult.count)
                : (Array.isArray(followingResult) && followingResult.length > 0 && followingResult[0].count
                    ? parseInt(followingResult[0].count)
                    : 0));

        console.log(`Profile stats: ${followersCount} followers, ${followingCount} following`);

        // Return user profile data
        res.json({
            username: user.username,
            name: user.name,
            followersCount: followersCount,
            followingCount: followingCount
        });
    } catch (error) {
        console.error('Error in profile endpoint:', error);
        console.error(error.stack);
        res.status(500).json({ error: 'Internal server error', message: error.message });
    }
});
  
app.get("/user/followers/", authenticateToken, async (request, response) => {
    try {
        const { username } = request.user;
        console.log(`Fetching followers for user: ${username}`);
        
        const user = await dbHelpers.getUserByUsername(username);
        if (!user) return response.status(400).json({ error: "User not found" });
        
        console.log(`Got user with ID: ${user.user_id}`);
        
        const query = process.env.NODE_ENV === 'production'
            ? `
                SELECT u.name
                FROM "User" u
                JOIN "Follower" f ON u.user_id = f.follower_user_id
                WHERE f.following_user_id = $1
            `
            : `
                SELECT u.name
                FROM User u
                JOIN Follower f ON u.user_id = f.follower_user_id
                WHERE f.following_user_id = ?
            `;
        
        const followers = await dbHelpers.execute(query, [user.user_id]);
        console.log(`Found ${followers ? followers.length : 0} followers`);
        
        // Ensure we're always returning an array
        const result = Array.isArray(followers) ? followers.map(convertToCamelCaseForFollowers) : [];
        response.json(result);
    } catch (error) {
        console.error("Error fetching followers:", error);
        console.error(error.stack);
        response.status(500).json({ error: "Internal Server Error", message: error.message });
    }
});

app.get("/user/following/", authenticateToken, async (request, response) => {
    try {
        const { username } = request.user;
        console.log(`Fetching following for user: ${username}`);
        
        const user = await dbHelpers.getUserByUsername(username);
        if (!user) return response.status(400).json({ error: "User not found" });
        
        console.log(`Got user with ID: ${user.user_id}`);
        
        const query = process.env.NODE_ENV === 'production'
            ? `
                SELECT u.name
                FROM "User" u
                JOIN "Follower" f ON u.user_id = f.following_user_id
                WHERE f.follower_user_id = $1
            `
            : `
                SELECT u.name
                FROM User u
                JOIN Follower f ON u.user_id = f.following_user_id
                WHERE f.follower_user_id = ?
            `;
        
        const following = await dbHelpers.execute(query, [user.user_id]);
        console.log(`Found ${following ? following.length : 0} following`);
        
        // Ensure we're always returning an array
        const result = Array.isArray(following) ? following.map(convertToCamelCaseForFollowers) : [];
        response.json(result);
    } catch (error) {
        console.error("Error fetching following:", error);
        console.error(error.stack);
        response.status(500).json({ error: "Internal Server Error", message: error.message });
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
        
        console.log(`User ${username} requesting tweet ${tweetId}`);
        
        // Get user
        const user = await dbHelpers.getUserByUsername(username);
        if (!user) {
            console.log(`User ${username} not found in database`);
            return response.status(400).json({ error: "User not found" });
        }
        
        // Get tweet with counts
        const query = process.env.NODE_ENV === 'production'
            ? `
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
                AND (
                    t.user_id IN (
                        SELECT f.following_user_id FROM "Follower" f WHERE f.follower_user_id = $2
                    )
                    OR t.user_id = $2
                )
                GROUP BY t.tweet_id, t.tweet, t.date_time
            `
            : `
                SELECT 
                    t.tweet_id as tweet_id,
                    t.tweet,
                    COUNT(DISTINCT l.like_id) AS likes,
                    COUNT(DISTINCT r.reply_id) AS replies,
                    t.date_time
                FROM Tweet t
                LEFT JOIN Like l ON t.tweet_id = l.tweet_id
                LEFT JOIN Reply r ON t.tweet_id = r.tweet_id
                WHERE t.tweet_id = ?  
                AND (
                    t.user_id IN (
                        SELECT f.following_user_id FROM Follower f WHERE f.follower_user_id = ?
                    )
                    OR t.user_id = ?
                )
                GROUP BY t.tweet_id, t.tweet, t.date_time
            `;
        
        const params = process.env.NODE_ENV === 'production'
            ? [tweetId, user.user_id]
            : [tweetId, user.user_id, user.user_id];
        
        const dbResponse = await dbHelpers.execute(query, params);
        console.log(`Tweet query result:`, dbResponse);
        
        if (!dbResponse) {
            console.log(`Tweet ${tweetId} not found or not accessible to user ${username}`);
            return response.status(404).json({ error: "Tweet not found or you don't have access to it" });
        }
        
        return response.json(convertsnakecaseToCamelCase(dbResponse));
    } catch (error) {
        console.error("Error fetching tweet:", error);
        console.error(error.stack);
        return response.status(500).json({ error: "Internal Server Error", message: error.message });
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
        console.log(`User ${username} requesting tweet replies`);
        
        // Get user
        const user = await dbHelpers.getUserByUsername(username);
        if (!user) {
            console.log(`User ${username} not found in database`);
            return response.status(400).json({ error: "User not found" });
        }
        
        // Query tweets replies
        const query = process.env.NODE_ENV === 'production' 
            ? `
                SELECT t.tweet_id, u.name, r.reply 
                FROM "Tweet" t 
                JOIN "Reply" r ON t.tweet_id = r.tweet_id 
                JOIN "User" u ON r.user_id = u.user_id 
                WHERE t.user_id = $1
                ORDER BY r.date_time DESC
            `
            : `
                SELECT t.tweet_id, u.name, r.reply 
                FROM Tweet t 
                JOIN Reply r ON t.tweet_id = r.tweet_id 
                JOIN User u ON r.user_id = u.user_id 
                WHERE t.user_id = ?
                ORDER BY r.date_time DESC
            `;
        
        const replies = await dbHelpers.execute(query, [user.user_id]);
        console.log(`Found ${replies ? replies.length : 0} replies for user's tweets`);
        
        // Ensure we're always returning an array
        const result = Array.isArray(replies) 
            ? replies.map(convertToCamelCaseForReplies) 
            : [];
            
        response.json(result);
    } catch (error) {
        console.error("Error fetching tweet replies:", error);
        console.error(error.stack);
        response.status(500).json({ error: "Internal Server Error", message: error.message });
    }
});

const convertToCamelCaseForLikes=(replies)=>({
    tweetId:replies.tweet_id,
    name:replies.name
})
app.get("/user/tweets/likes/", authenticateToken, async (request, response) => {
    try {
        const { username } = request.user;
        console.log(`User ${username} requesting tweet likes`);
        
        // Get user
        const user = await dbHelpers.getUserByUsername(username);
        if (!user) {
            console.log(`User ${username} not found in database`);
            return response.status(400).json({ error: "User not found" });
        }
        
        // Query tweet likes
        const query = process.env.NODE_ENV === 'production' 
            ? `
                SELECT t.tweet_id, u.name 
                FROM "Tweet" t 
                JOIN "Like" l ON t.tweet_id = l.tweet_id 
                JOIN "User" u ON l.user_id = u.user_id 
                WHERE t.user_id = $1
            `
            : `
                SELECT t.tweet_id, u.name 
                FROM Tweet t 
                JOIN Like l ON t.tweet_id = l.tweet_id 
                JOIN User u ON l.user_id = u.user_id 
                WHERE t.user_id = ?
            `;
        
        const likes = await dbHelpers.execute(query, [user.user_id]);
        console.log(`Found ${likes ? likes.length : 0} likes for user's tweets`);
        
        // Ensure we're always returning an array
        const result = Array.isArray(likes) 
            ? likes.map(convertToCamelCaseForLikes) 
            : [];
            
        response.json(result);
    } catch (error) {
        console.error("Error fetching tweet likes:", error);
        console.error(error.stack);
        response.status(500).json({ error: "Internal Server Error", message: error.message });
    }
});
  
    

app.post("/user/tweets", authenticateToken, async (request, response) => {
    try {
        const { username } = request.user;
        console.log(`User ${username} attempting to create a new tweet`);
        
        // Get user
        const user = await dbHelpers.getUserByUsername(username);
        if (!user) {
            console.log(`User ${username} not found in database`);
            return response.status(400).json({ error: "Invalid user" });
        }

        const { tweet } = request.body;
        console.log(`Tweet content: "${tweet && tweet.length > 30 ? tweet.substring(0, 30) + '...' : tweet}"`);

        if (!tweet || tweet.trim() === "") {
            return response.status(400).json({ error: "Tweet cannot be empty" });
        }

        // Insert tweet - handle differently for PostgreSQL vs SQLite
        let tweetId, dateTime;
        
        if (process.env.NODE_ENV === 'production') {
            // For PostgreSQL
            try {
                console.log("Using PostgreSQL insert with RETURNING");
                const result = await db.one('INSERT INTO "Tweet" (tweet, user_id, date_time) VALUES ($1, $2, CURRENT_TIMESTAMP) RETURNING tweet_id, date_time', 
                    [tweet, user.user_id]);
                tweetId = result.tweet_id;
                dateTime = result.date_time;
                console.log(`Tweet created with ID: ${tweetId}`);
            } catch (pgError) {
                console.error("PostgreSQL insert error:", pgError);
                throw pgError;
            }
        } else {
            // For SQLite
            try {
                console.log("Using SQLite insert");
                const result = await db.run('INSERT INTO Tweet (tweet, user_id) VALUES (?, ?)', 
                    [tweet, user.user_id]);
                tweetId = result.lastID;
                dateTime = new Date().toISOString();
                console.log(`Tweet created with ID: ${tweetId}`);
            } catch (sqliteError) {
                console.error("SQLite insert error:", sqliteError);
                throw sqliteError;
            }
        }

        console.log('Tweet created successfully with ID:', tweetId);

        return response.status(201).json({
            message: "Created a Tweet",
            tweet: {
                tweetId: tweetId,
                tweet: tweet,
                likes: 0,
                replies: 0,
                dateTime: dateTime || new Date().toISOString()
            }
        });
          
    } catch (error) {
        console.error("Error posting tweet:", error);
        console.error(error.stack);
        return response.status(500).json({ 
            error: "Error creating tweet", 
            message: error.message,
            details: process.env.NODE_ENV !== 'production' ? error.stack : undefined
        });
    }
});

app.get("/user/tweets/", authenticateToken, async (request, response) => {
    try {
        const { username } = request.user;
        console.log(`Fetching tweets for user: ${username}`);
        
        const user = await dbHelpers.getUserByUsername(username);
        if (!user) return response.status(400).json({ error: "User not found" });
        
        console.log(`Got user with ID: ${user.user_id}`);
        
        const query = process.env.NODE_ENV === 'production'
            ? `
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
            `
            : `
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
                GROUP BY t.tweet_id, t.tweet, t.date_time
                ORDER BY t.date_time DESC
            `;
        
        const dbResponse = await dbHelpers.execute(query, [user.user_id]);
        console.log(`Found ${dbResponse ? dbResponse.length : 0} tweets`);
        
        // Ensure we're returning a valid array
        const result = Array.isArray(dbResponse) ? dbResponse.map(convertsnakecaseToCamelCase) : [];
        return response.json(result);
    } catch (error) {
        console.error("Error getting tweets:", error);
        console.error(error.stack);
        return response.status(500).json({ error: "Internal Server Error", message: error.message });
    }
});

app.delete("/tweets/:tweetId/", authenticateToken, async (request, response) => {
    try {
        const { username } = request.user;
        const { tweetId } = request.params;
        
        console.log(`User ${username} attempting to delete tweet ${tweetId}`);
        
        // Get user
        const user = await dbHelpers.getUserByUsername(username);
        if (!user) {
            console.log(`User ${username} not found in database`);
            return response.status(400).json({ error: "User not found" });
        }
        
        // Get tweet
        const tweet = await dbHelpers.getTweetById(tweetId);
        if (!tweet) {
            console.log(`Tweet ${tweetId} not found in database`);
            return response.status(404).json({ error: "Tweet not found" });
        }
        
        // Check ownership
        if (tweet.user_id !== user.user_id) {
            console.log(`User ${username} (ID: ${user.user_id}) is not the owner of tweet ${tweetId} (owner: ${tweet.user_id})`);
            return response.status(403).json({ error: "You can only delete your own tweets" });
        }
        
        // Delete tweet
        const query = process.env.NODE_ENV === 'production'
            ? 'DELETE FROM "Tweet" WHERE tweet_id = $1'
            : 'DELETE FROM Tweet WHERE tweet_id = ?';
            
        await dbHelpers.execute(query, [tweetId]);
        console.log(`Tweet ${tweetId} deleted successfully`);
        
        return response.json({ 
            success: true,
            message: "Tweet deleted successfully" 
        });
    } catch (error) {
        console.error("Error deleting tweet:", error);
        console.error(error.stack);
        return response.status(500).json({ error: "Internal Server Error", message: error.message });
    }
});

app.get('/notifications/', authenticateToken, async (request, response) => {
    try {
        const { username } = request.user;
        
        // Get user
        const user = await dbHelpers.getUserByUsername(username);
        if (!user) return response.status(400).json({ error: "User not found" });
        
        // Try to create Notifications table if it doesn't exist (only in production)
        if (process.env.NODE_ENV === 'production') {
            try {
                await db.query(`
                    CREATE TABLE IF NOT EXISTS "Notifications" (
                        id SERIAL PRIMARY KEY,
                        user_id INTEGER REFERENCES "User"(user_id),
                        from_user_id INTEGER REFERENCES "User"(user_id),
                        tweet_id INTEGER REFERENCES "Tweet"(tweet_id),
                        type TEXT,
                        message TEXT,
                        is_read BOOLEAN DEFAULT FALSE,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `);
                console.log("Created Notifications table if it didn't exist");
            } catch (tableError) {
                console.error("Error ensuring Notifications table exists:", tableError);
            }
        }
        
        let notifications = [];
        const notificationQueries = [];
        
        // Add all potential queries we might need to try
        if (process.env.NODE_ENV === 'production') {
            // PostgreSQL queries - try different table names and column structures
            notificationQueries.push({
                name: 'Notifications table with from_user_id',
                query: `
                    SELECT 
                        n.id as notification_id, 
                        n.message as content, 
                        n.created_at as date_time, 
                        n.is_read, 
                        u.username as triggered_by_username 
                    FROM "Notifications" n
                    LEFT JOIN "User" u ON n.from_user_id = u.user_id
                    WHERE n.user_id = $1
                    ORDER BY n.created_at DESC
                `,
                params: [user.user_id]
            });
        } else {
            // SQLite queries
            notificationQueries.push({
                name: 'SQLite Notifications table',
                query: `
                    SELECT 
                        n.id as notification_id, 
                        n.message as content, 
                        n.date_time, 
                        n.is_read, 
                        u.username as triggered_by_username 
                    FROM Notifications n
                    LEFT JOIN User u ON n.from_user_id = u.user_id
                    WHERE n.user_id = ?
                    ORDER BY n.date_time DESC
                `,
                params: [user.user_id]
            });
        }
        
        // Try each query until one works
        let lastError = null;
        for (const queryInfo of notificationQueries) {
            try {
                console.log(`Trying notifications query: ${queryInfo.name}`);
                const result = await dbHelpers.execute(queryInfo.query, queryInfo.params);
                if (result) {
                    notifications = result;
                    console.log(`Successfully got ${notifications.length} notifications with query: ${queryInfo.name}`);
                    break; // Exit loop if query succeeds
                }
            } catch (err) {
                console.error(`Error with ${queryInfo.name}:`, err.message);
                lastError = err;
                // Continue to the next query
            }
        }
        
        // Return empty array when no notifications found or all queries failed
        if (!notifications || !Array.isArray(notifications)) {
            console.log("No notifications found or all queries failed, returning empty array");
            notifications = [];
        }
        
        // Normalize results
        const normalizedNotifications = notifications.map(n => ({
            notification_id: n?.notification_id || 0, 
            content: n?.content || n?.message || '',
            date_time: n?.date_time || new Date().toISOString(),
            is_read: !!n?.is_read,
            triggered_by_username: n?.triggered_by_username || null
        }));
        
        return response.json(normalizedNotifications);
    } catch (error) {
        console.error("Error fetching notifications:", error);
        return response.status(500).json({ error: "Server error", message: error.message });
    }
});

// Add suggestions endpoint
app.get('/suggestions', authenticateToken, async (request, response) => {
  try {
    const { username } = request.user;
    
    // Get current user
    const currentUser = await dbHelpers.getUserByUsername(username);
    if (!currentUser) return response.status(404).json({ error: 'User not found' });
    
    // Get users not followed by current user
    const query = process.env.NODE_ENV === 'production' 
      ? `
        SELECT u.user_id, u.name, u.username 
        FROM "User" u
        WHERE u.user_id != $1
        AND u.user_id NOT IN (
          SELECT f.following_user_id 
          FROM "Follower" f
          WHERE f.follower_user_id = $1
        )
        LIMIT 5
      `
      : `
        SELECT u.user_id, u.name, u.username 
        FROM User u
        WHERE u.user_id != ?
        AND u.user_id NOT IN (
          SELECT f.following_user_id 
          FROM Follower f
          WHERE f.follower_user_id = ?
        )
        LIMIT 5
      `;
    
    // Send parameters in the correct format based on the environment
    const suggestions = await dbHelpers.execute(
      query, 
      process.env.NODE_ENV === 'production' 
        ? [currentUser.user_id] 
        : [currentUser.user_id, currentUser.user_id]
    );
    
    // Return empty array if null or undefined
    response.json(Array.isArray(suggestions) ? suggestions : []);
  } catch (error) {
    console.error('Error fetching suggestions:', error);
    response.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// Follow a user
app.post('/follow/:userId', authenticateToken, async (request, response) => {
  try {
    const { username } = request.user;
    const { userId } = request.params;
    
    // Get current user
    const currentUser = await dbHelpers.getUserByUsername(username);
    if (!currentUser) return response.status(404).json({ error: 'User not found' });
    
    // Get user to follow
    const userToFollow = await dbHelpers.getUserById(userId);
    if (!userToFollow) return response.status(404).json({ error: 'User to follow not found' });
    
    // Check if already following
    const isAlreadyFollowing = await dbHelpers.execute(
      process.env.NODE_ENV === 'production'
        ? 'SELECT 1 FROM "Follower" WHERE follower_user_id = $1 AND following_user_id = $2'
        : 'SELECT 1 FROM Follower WHERE follower_user_id = ? AND following_user_id = ?',
      [currentUser.user_id, userToFollow.user_id]
    );
    
    if (isAlreadyFollowing) {
      // Unfollow if already following
      await dbHelpers.execute(
        process.env.NODE_ENV === 'production'
          ? 'DELETE FROM "Follower" WHERE follower_user_id = $1 AND following_user_id = $2'
          : 'DELETE FROM Follower WHERE follower_user_id = ? AND following_user_id = ?',
        [currentUser.user_id, userToFollow.user_id]
      );
      
      return response.json({ 
        success: true, 
        action: 'unfollowed',
        message: `You are no longer following ${userToFollow.username}` 
      });
    } else {
      // Follow user
      await dbHelpers.execute(
        process.env.NODE_ENV === 'production'
          ? 'INSERT INTO "Follower" (follower_user_id, following_user_id) VALUES ($1, $2)'
          : 'INSERT INTO Follower (follower_user_id, following_user_id) VALUES (?, ?)',
        [currentUser.user_id, userToFollow.user_id]
      );
      
      // Try to create notification
      try {
        if (process.env.NODE_ENV === 'production') {
          await dbHelpers.execute(
            'INSERT INTO "Notifications" (user_id, from_user_id, type, message, is_read) VALUES ($1, $2, $3, $4, $5)',
            [userToFollow.user_id, currentUser.user_id, 'follow', `@${username} started following you.`, false]
          );
        } else {
          await dbHelpers.execute(
            'INSERT INTO Notifications (user_id, from_user_id, type, message, is_read) VALUES (?, ?, ?, ?, ?)',
            [userToFollow.user_id, currentUser.user_id, 'follow', `@${username} started following you.`, false]
          );
        }
      } catch (notifError) {
        console.error('Error creating follow notification:', notifError);
        // Continue even if notification creation fails
      }
      
      return response.json({ 
        success: true, 
        action: 'followed',
        message: `You are now following ${userToFollow.username}` 
      });
    }
  } catch (error) {
    console.error('Error following user:', error);
    response.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// Make sure to export the app for import in other files
module.exports = app;