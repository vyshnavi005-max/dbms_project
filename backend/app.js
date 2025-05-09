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
       
        let pgQuery = query;
        if (pgQuery.includes('?')) {
          console.log('Converting ? parameters to $n format for PostgreSQL');
         
          let paramIndex = 0;
          pgQuery = pgQuery.replace(/\?/g, () => `$${++paramIndex}`);
          console.log('Converted query:', pgQuery);
        }
        
        // Determine the right method based on expected result
        if (normalizedQuery.startsWith('select')) {
          
          if (normalizedQuery.includes('count(') || normalizedQuery.includes(' count ')) {
            return await db.oneOrNone(pgQuery, params);
          }
        
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
        console.log(`Fetching tweet feed for user: ${username}`);
        
        // Get current user
        const user = await dbHelpers.getUserByUsername(username);
        if (!user) {
            console.log(`User ${username} not found in database`);
            return response.status(400).json({ error: "User not found" });
        }
        
        console.log(`Got user with ID: ${user.user_id}`);
        
        let tweets = [];
        
        if (process.env.NODE_ENV === 'production') {
            try {
                // Use db.any for PostgreSQL to handle multiple results
                tweets = await db.any(`
                    SELECT u.username, t.tweet_id, t.tweet, t.date_time
                    FROM "Tweet" t
                    JOIN "Follower" f ON t.user_id = f.following_user_id
                    JOIN "User" u ON u.user_id = t.user_id
                    WHERE f.follower_user_id = $1
                    ORDER BY t.date_time DESC
                    LIMIT 10
                `, [user.user_id]);
                
                console.log(`Feed found ${tweets.length} tweets for user ${username} (PostgreSQL)`);
            } catch (pgError) {
                console.error("PostgreSQL tweet feed query error:", pgError);
                console.error(pgError.stack);
                tweets = [];
            }
        } else {
            // For SQLite
            const query = `
        SELECT User.username, Tweet.tweet_id, Tweet.tweet, Tweet.date_time
        FROM Tweet
        JOIN Follower ON Tweet.user_id = Follower.following_user_id
                JOIN User ON User.user_id = Tweet.user_id
                WHERE Follower.follower_user_id = ?
        ORDER BY Tweet.date_time DESC
                LIMIT 10
            `;
            
            const result = await dbHelpers.execute(query, [user.user_id]);
            tweets = Array.isArray(result) ? result : [];
            
            console.log(`Feed found ${tweets.length} tweets for user ${username} (SQLite)`);
        }
        
        // Convert to expected format
        const formattedTweets = tweets.map(tweet => ({
            username: tweet.username,
            tweetId: tweet.tweet_id,
            tweet: tweet.tweet,
            dateTime: tweet.date_time
        }));
        
        response.json(formattedTweets);
    } catch (error) {
        console.error("Error fetching tweet feed:", error);
        console.error(error.stack);
        response.status(500).json({ 
            error: "Server error", 
            message: error.message,
            details: process.env.NODE_ENV !== 'production' ? error.stack : undefined
        });
    }
});


const likedNames = (data) => {
  // Ensure data is an array
  const safeData = Array.isArray(data) ? data : [];
  const names = safeData.map((item) => item?.name || '');
    return {
      likes: names,
      hasLiked: names.length > 0,
    };
  };
  
app.get("/tweets/:tweetId/likes", authenticateToken, async (req, res) => {
  try {
      const { username } = req.user;
      const { tweetId } = req.params;
      
      console.log(`User ${username} requesting likes for tweet ${tweetId}`);
      
      // Get user
      const user = await dbHelpers.getUserByUsername(username);
      if (!user) {
          console.log(`User ${username} not found in database`);
          return res.status(400).json({ error: "User not found" });
      }
      
      let likes = [];
      let userHasLiked = false;
      
      if (process.env.NODE_ENV === 'production') {
          try {
              // Get all likes for this tweet
              likes = await db.any(`
                  SELECT u.name, u.username, u.user_id
                  FROM "Like" l
                  JOIN "User" u ON l.user_id = u.user_id
                  WHERE l.tweet_id = $1
              `, [tweetId]);
              
              // Check if current user has liked
              userHasLiked = await db.oneOrNone(`
                  SELECT 1
                  FROM "Like" l
                  WHERE l.user_id = $1 AND l.tweet_id = $2
              `, [user.user_id, tweetId]) !== null;
              
              console.log(`Found ${likes.length} likes for tweet ${tweetId} (PostgreSQL), user has liked: ${userHasLiked}`);
          } catch (pgError) {
              console.error("PostgreSQL query error:", pgError);
              console.error(pgError.stack);
              likes = [];
          }
      } else {
          // SQLite - get all likes
          const query = `
              SELECT u.name, u.username, u.user_id
              FROM Like l
              JOIN User u ON l.user_id = u.user_id
              WHERE l.tweet_id = ?
          `;
          
          const result = await dbHelpers.execute(query, [tweetId]);
          likes = Array.isArray(result) ? result : [];
          
          // Check if current user has liked
          const userLikeQuery = `
              SELECT 1
              FROM Like l
              WHERE l.user_id = ? AND l.tweet_id = ?
          `;
          const userLike = await dbHelpers.execute(userLikeQuery, [user.user_id, tweetId]);
          userHasLiked = !!userLike;
          
          console.log(`Found ${likes.length} likes for tweet ${tweetId} (SQLite), user has liked: ${userHasLiked}`);
      }
      
      // Format likes array - Tweet.js expects an array of objects with tweetId and name
      const formattedLikes = Array.isArray(likes) ? likes.map(item => ({
          tweetId: parseInt(tweetId),
          name: item?.name || ''
      })) : [];
      
      console.log(`Response for tweet ${tweetId} likes:`, formattedLikes);
      
      return res.json(formattedLikes);
  } catch (error) {
      console.error("Error fetching likes:", error);
      console.error(error.stack);
      return res.status(500).json({ 
          error: "Server error", 
          message: error.message,
          details: process.env.NODE_ENV !== 'production' ? error.stack : undefined
      });
  }
});
  
const repliesNames = (item) => {
  return { 
    name: item?.name || '', 
    reply: item?.reply || '' 
  };
  };
  
app.get("/tweets/:tweetId/replies", authenticateToken, async (req, res) => {
  try {
    const { username } = req.user;
    const { tweetId } = req.params;
  
      console.log(`User ${username} requesting replies for tweet ${tweetId}`);
      
      // Get user
      const user = await dbHelpers.getUserByUsername(username);
      if (!user) {
          console.log(`User ${username} not found in database`);
          return res.status(400).json({ error: "User not found" });
      }
      
      let replies = [];
      
      if (process.env.NODE_ENV === 'production') {
          try {
              // Use db.any for PostgreSQL - get ALL replies without filtering
              replies = await db.any(`
                  SELECT u.name, r.reply
                  FROM "Reply" r
                  JOIN "User" u ON r.user_id = u.user_id
                  WHERE r.tweet_id = $1
                  ORDER BY r.date_time DESC
              `, [tweetId]);
              
              console.log(`Found ${replies.length} replies for tweet ${tweetId} (PostgreSQL)`);
          } catch (pgError) {
              console.error("PostgreSQL query error:", pgError);
              console.error(pgError.stack);
              replies = [];
          }
      } else {
          // SQLite - get ALL replies without filtering
          const query = `
        SELECT u.name, r.reply
              FROM Reply r
              JOIN User u ON r.user_id = u.user_id
        WHERE r.tweet_id = ?
              ORDER BY r.date_time DESC
          `;
          
          const result = await dbHelpers.execute(query, [tweetId]);
          replies = Array.isArray(result) ? result : [];
          console.log(`Found ${replies.length} replies for tweet ${tweetId} (SQLite)`);
      }
      
      // Format replies to match EXACTLY what the frontend expects
      const formattedReplies = Array.isArray(replies) 
          ? replies.map(item => ({
              tweetId: parseInt(tweetId),
              name: item?.name || '',
              reply: item?.reply || ''
          }))
          : [];
      
      console.log(`Response for tweet ${tweetId} replies:`, formattedReplies);
      
      return res.json(formattedReplies);
    } catch (error) {
      console.error("Error fetching replies:", error);
      console.error(error.stack);
      return res.status(500).json({ 
          error: "Server error", 
          message: error.message,
          details: process.env.NODE_ENV !== 'production' ? error.stack : undefined
      });
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
        let existingLike;
        if (process.env.NODE_ENV === 'production') {
            try {
                existingLike = await db.oneOrNone('SELECT * FROM "Like" WHERE user_id = $1 AND tweet_id = $2', 
                    [user.user_id, tweetId]);
                console.log(`Existing like check result:`, !!existingLike);
            } catch (pgError) {
                console.error("PostgreSQL select error:", pgError);
                throw pgError;
            }
        } else {
            existingLike = await dbHelpers.execute(
                'SELECT * FROM Like WHERE user_id = ? AND tweet_id = ?',
                [user.user_id, tweetId]
            );
        }

        if (existingLike) {
            // Unlike
            if (process.env.NODE_ENV === 'production') {
                try {
                    await db.none('DELETE FROM "Like" WHERE user_id = $1 AND tweet_id = $2',
                        [user.user_id, tweetId]);
                    console.log(`User ${username} unliked tweet ${tweetId}`);
                } catch (pgError) {
                    console.error("PostgreSQL delete error:", pgError);
                    throw pgError;
                }
        } else {
                await dbHelpers.execute(
                    'DELETE FROM Like WHERE user_id = ? AND tweet_id = ?',
                    [user.user_id, tweetId]
                );
            }
        } else {
            // Like
            if (process.env.NODE_ENV === 'production') {
                try {
                    await db.none('INSERT INTO "Like" (user_id, tweet_id) VALUES ($1, $2)',
                        [user.user_id, tweetId]);
                    console.log(`User ${username} liked tweet ${tweetId}`);
                } catch (pgError) {
                    console.error("PostgreSQL insert error:", pgError);
                    throw pgError;
                }
            } else {
                await dbHelpers.execute(
                    'INSERT INTO Like (user_id, tweet_id) VALUES (?, ?)',
                    [user.user_id, tweetId]
                );
            }
            
            // Create notification
            try {
                if (process.env.NODE_ENV === 'production') {
                    await db.none(
                        'INSERT INTO "Notifications" (user_id, from_user_id, tweet_id, type, message, is_read) VALUES ($1, $2, $3, $4, $5, $6)',
                        [tweet.user_id, user.user_id, tweetId, 'like', `${username} liked your tweet.`, false]
                    );
                } else {
                    await dbHelpers.execute(
                        'INSERT INTO Notifications (user_id, from_user_id, tweet_id, type, message, is_read) VALUES (?, ?, ?, ?, ?, ?)',
                        [tweet.user_id, user.user_id, tweetId, 'like', `${username} liked your tweet.`, false]
                    );
                }
                console.log(`Created like notification for tweet ${tweetId}`);
            } catch (notifError) {
                console.error("Error creating notification:", notifError);
                // Continue even if notification creation fails
            }
        }
        
        // Get updated like count
        let likeCount = 0;
        if (process.env.NODE_ENV === 'production') {
            try {
                const result = await db.one(`
                    SELECT COUNT(*) AS count
                    FROM "Like"
                    WHERE tweet_id = $1
                `, [tweetId]);
                likeCount = parseInt(result.count);
                console.log(`Updated like count for tweet ${tweetId}: ${likeCount}`);
            } catch (pgError) {
                console.error("PostgreSQL count error:", pgError);
                likeCount = 0;
            }
        } else {
            const result = await dbHelpers.execute(`
                SELECT COUNT(*) AS count
                FROM Like
                WHERE tweet_id = ?
            `, [tweetId]);
            likeCount = result ? parseInt(result.count) : 0;
        }

        response.json({
            message: existingLike ? "Tweet unliked successfully" : "Tweet liked successfully",
            likes: likeCount
        });
    } catch (err) {
        console.error("Error handling like:", err);
        console.error(err.stack);
        response.status(500).json({ 
            error: "Internal server error", 
            message: err.message,
            details: process.env.NODE_ENV !== 'production' ? err.stack : undefined
        });
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
        let isFollowing = false;
        if (process.env.NODE_ENV === 'production') {
            try {
                const followCheck = await db.oneOrNone(
                    'SELECT 1 FROM "Follower" WHERE follower_user_id = $1 AND following_user_id = $2',
                    [user.user_id, tweet.user_id]
                );
                isFollowing = !!followCheck;
            } catch (pgError) {
                console.error("PostgreSQL select error:", pgError);
                throw pgError;
            }
        } else {
            const followCheck = await dbHelpers.execute(
                'SELECT 1 FROM Follower WHERE follower_user_id = ? AND following_user_id = ?',
                [user.user_id, tweet.user_id]
            );
            isFollowing = !!followCheck;
        }
        
        if (!isFollowing && user.user_id !== tweet.user_id) {
            console.log(`User ${username} is not following tweet author and is not the author`);
            return response.status(403).json({ 
                error: "You can only reply to tweets from users you follow or your own tweets" 
            });
        }
        
        // Add reply
        if (process.env.NODE_ENV === 'production') {
            try {
                await db.none(
                    'INSERT INTO "Reply" (user_id, tweet_id, reply) VALUES ($1, $2, $3)',
                    [user.user_id, tweetId, replyText]
                );
                console.log(`User ${username} replied to tweet ${tweetId}`);
            } catch (pgError) {
                console.error("PostgreSQL insert error:", pgError);
                throw pgError;
            }
        } else {
            await dbHelpers.execute(
                'INSERT INTO Reply (user_id, tweet_id, reply) VALUES (?, ?, ?)',
                [user.user_id, tweetId, replyText]
            );
        }
        
        // Create notification if the reply is not to the user's own tweet
        if (user.user_id !== tweet.user_id) {
            try {
                if (process.env.NODE_ENV === 'production') {
                    await db.none(
                        'INSERT INTO "Notifications" (user_id, from_user_id, tweet_id, type, message, is_read) VALUES ($1, $2, $3, $4, $5, $6)',
                        [tweet.user_id, user.user_id, tweetId, 'reply', 
                        `${username} replied to your tweet: "${replyText.substring(0, 30)}${replyText.length > 30 ? '...' : ''}"`, false]
                    );
                } else {
                    await dbHelpers.execute(
                        'INSERT INTO Notifications (user_id, from_user_id, tweet_id, type, message, is_read) VALUES (?, ?, ?, ?, ?, ?)',
                        [tweet.user_id, user.user_id, tweetId, 'reply', 
                        `${username} replied to your tweet: "${replyText.substring(0, 30)}${replyText.length > 30 ? '...' : ''}"`, false]
                    );
                }
                console.log(`Created reply notification for tweet ${tweetId}`);
            } catch (notifError) {
                console.error("Error creating notification:", notifError);
                // Continue even if notification creation fails
            }
        }
        
        // Get updated replies
        let replies = [];
        if (process.env.NODE_ENV === 'production') {
            try {
                replies = await db.any(`
                    SELECT u.name, r.reply
                    FROM "Reply" r
                    JOIN "User" u ON r.user_id = u.user_id
                    WHERE r.tweet_id = $1
                    ORDER BY r.date_time DESC
                `, [tweetId]);
                console.log(`Found ${replies.length} replies for tweet ${tweetId}`);
            } catch (pgError) {
                console.error("PostgreSQL select error:", pgError);
                replies = [];
            }
        } else {
            const result = await dbHelpers.execute(`
            SELECT u.name, r.reply
            FROM Reply r
            JOIN User u ON r.user_id = u.user_id
            WHERE r.tweet_id = ?
                ORDER BY r.date_time DESC
            `, [tweetId]);
            replies = Array.isArray(result) ? result : [];
        }
        
        const formattedReplies = replies.map(item => ({
            name: item.name,
            reply: item.reply
        }));

        response.json({
            message: "Reply added successfully",
            replies: formattedReplies
        });
    } catch (err) {
        console.error("Error handling reply:", err);
        console.error(err.stack);
        response.status(500).json({ 
            error: "Internal server error", 
            message: err.message,
            details: process.env.NODE_ENV !== 'production' ? err.stack : undefined
        });
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
        
        // Get user
        const user = await dbHelpers.getUserByUsername(username);
        if (!user) {
            console.log(`User ${username} not found in database`);
            return response.status(400).json({ error: "User not found" });
        }
        
        console.log(`Got user with ID: ${user.user_id}`);
        
        let followers = [];
        
        if (process.env.NODE_ENV === 'production') {
            try {
                // Use db.any for PostgreSQL
                followers = await db.any(`
                    SELECT u.name, u.username, u.user_id
                    FROM "User" u
                    JOIN "Follower" f ON u.user_id = f.follower_user_id
                    WHERE f.following_user_id = $1
                `, [user.user_id]);
                
                console.log(`Found ${followers.length} followers for ${username}`);
            } catch (pgError) {
                console.error("PostgreSQL query error:", pgError);
                console.error(pgError.stack);
                followers = [];
            }
        } else {
            // SQLite - continue using dbHelpers.execute
            const query = `
                SELECT u.name, u.username, u.user_id
                FROM User u
                JOIN Follower f ON u.user_id = f.follower_user_id
                WHERE f.following_user_id = ?
            `;
            
            const result = await dbHelpers.execute(query, [user.user_id]);
            followers = Array.isArray(result) ? result : [];
            console.log(`Found ${followers.length} followers (SQLite)`);
        }
        
        // Convert to expected format
        const result = followers.map(user => ({
            name: user.name,
            username: user.username || '', 
            user_id: user.user_id
        }));
        
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
        
        // Get user
        const user = await dbHelpers.getUserByUsername(username);
        if (!user) {
            console.log(`User ${username} not found in database`);
            return response.status(400).json({ error: "User not found" });
        }
        
        console.log(`Got user with ID: ${user.user_id}`);
        
        let following = [];
        
        if (process.env.NODE_ENV === 'production') {
            try {
                // Use db.any for PostgreSQL
                following = await db.any(`
                    SELECT u.name, u.username, u.user_id
                    FROM "User" u
                    JOIN "Follower" f ON u.user_id = f.following_user_id
                    WHERE f.follower_user_id = $1
                `, [user.user_id]);
                
                console.log(`Found ${following.length} users that ${username} is following`);
            } catch (pgError) {
                console.error("PostgreSQL query error:", pgError);
                console.error(pgError.stack);
                following = [];
            }
        } else {
            // SQLite - continue using dbHelpers.execute
            const query = `
                SELECT u.name, u.username, u.user_id
                FROM User u
                JOIN Follower f ON u.user_id = f.following_user_id
                WHERE f.follower_user_id = ?
            `;
            
            const result = await dbHelpers.execute(query, [user.user_id]);
            following = Array.isArray(result) ? result : [];
            console.log(`Found ${following.length} following (SQLite)`);
        }
        
        // Convert to expected format
        const result = following.map(user => ({
            name: user.name,
            username: user.username || '',
            user_id: user.user_id
        }));
        
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
        
        let tweet = null;
        
        if (process.env.NODE_ENV === 'production') {
            try {
                // Use db.oneOrNone for PostgreSQL - we expect at most one result
                tweet = await db.oneOrNone(`
        SELECT 
                        t.tweet_id,
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
                `, [tweetId, user.user_id]);
                
                console.log(`Tweet query result:`, tweet);
            } catch (pgError) {
                console.error("PostgreSQL query error:", pgError);
                console.error(pgError.stack);
                tweet = null;
            }
        } else {
            // SQLite query
            const query = `
                SELECT 
                    t.tweet_id,
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
            
            tweet = await dbHelpers.execute(query, [tweetId, user.user_id, user.user_id]);
        }
        
        if (!tweet) {
            console.log(`Tweet ${tweetId} not found or not accessible to user ${username}`);
            return response.status(404).json({ error: "Tweet not found or you don't have access to it" });
        }
        
        // Format response
        const result = {
            tweetId: tweet.tweet_id,
            tweet: tweet.tweet,
            likes: parseInt(tweet.likes) || 0,
            replies: parseInt(tweet.replies) || 0,
            dateTime: tweet.date_time
        };
        
        return response.json(result);
    } catch (error) {
        console.error("Error fetching tweet:", error);
        console.error(error.stack);
        return response.status(500).json({ 
            error: "Internal Server Error", 
            message: error.message,
            details: process.env.NODE_ENV !== 'production' ? error.stack : undefined
        });
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
        
        let userTweets = [];
        
        if (process.env.NODE_ENV === 'production') {
            try {
                // First get all user tweets
                const tweets = await db.any(`
                    SELECT t.tweet_id, t.tweet, t.date_time
                    FROM "Tweet" t
                    WHERE t.user_id = $1
                    ORDER BY t.date_time DESC
                `, [user.user_id]);
                
                console.log(`Found ${tweets.length} tweets for user ${username} (PostgreSQL)`);
                
                // For each tweet, get its replies
                for (const tweet of tweets) {
                    const repliesForTweet = await db.any(`
                        SELECT r.reply_id, r.reply, u.name, u.username, r.date_time
                        FROM "Reply" r
                        JOIN "User" u ON r.user_id = u.user_id
                        WHERE r.tweet_id = $1
                        ORDER BY r.date_time DESC
                    `, [tweet.tweet_id]);
                    
                    if (repliesForTweet.length > 0) {
                        // Convert replies to the expected format
                        const formattedReplies = repliesForTweet.map(reply => ({
                            replyId: reply.reply_id,
                            name: reply.name || '',
                            username: reply.username || '',
                            reply: reply.reply || '',
                            dateTime: reply.date_time
                        }));
                        
                        // Add tweet with its replies to the result
                        userTweets.push({
                            tweetId: tweet.tweet_id,
                            tweet: tweet.tweet,
                            dateTime: tweet.date_time,
                            replies: formattedReplies
                        });
                    }
                }
                
                console.log(`Processed replies for ${userTweets.length} tweets with replies (PostgreSQL)`);
            } catch (pgError) {
                console.error("PostgreSQL query error:", pgError);
                console.error(pgError.stack);
            }
        } else {
            // SQLite version
            try {
                // First get all user tweets
                const tweetsQuery = `
                    SELECT t.tweet_id, t.tweet, t.date_time
      FROM Tweet t 
                    WHERE t.user_id = ?
                    ORDER BY t.date_time DESC
                `;
                
                const tweetsResult = await dbHelpers.execute(tweetsQuery, [user.user_id]);
                const tweets = Array.isArray(tweetsResult) ? tweetsResult : [];
                console.log(`Found ${tweets.length} tweets for user ${username} (SQLite)`);
                
                // For each tweet, get its replies
                for (const tweet of tweets) {
                    const repliesQuery = `
                        SELECT r.reply_id, r.reply, u.name, u.username, r.date_time
                        FROM Reply r
      JOIN User u ON r.user_id = u.user_id 
                        WHERE r.tweet_id = ?
                        ORDER BY r.date_time DESC
                    `;
                    
                    const repliesResult = await dbHelpers.execute(repliesQuery, [tweet.tweet_id]);
                    const repliesForTweet = Array.isArray(repliesResult) ? repliesResult : [];
                    
                    if (repliesForTweet.length > 0) {
                        // Convert replies to the expected format
                        const formattedReplies = repliesForTweet.map(reply => ({
                            replyId: reply.reply_id,
                            name: reply.name || '',
                            username: reply.username || '',
                            reply: reply.reply || '',
                            dateTime: reply.date_time
                        }));
                        
                        // Add tweet with its replies to the result
                        userTweets.push({
                            tweetId: tweet.tweet_id,
                            tweet: tweet.tweet,
                            dateTime: tweet.date_time,
                            replies: formattedReplies
                        });
                    }
                }
                
                console.log(`Processed replies for ${userTweets.length} tweets with replies (SQLite)`);
            } catch (sqliteError) {
                console.error("SQLite query error:", sqliteError);
                console.error(sqliteError.stack);
            }
        }
        
        // Flatten the result to match expected format - one entry per reply
        const formattedReplies = [];
        
        userTweets.forEach(tweet => {
            if (tweet.replies && tweet.replies.length > 0) {
                tweet.replies.forEach(reply => {
                    formattedReplies.push({
                        tweetId: tweet.tweetId,
                        name: reply.name,
                        reply: reply.reply
                    });
                });
            }
        });
        
        console.log(`Returning ${formattedReplies.length} formatted replies`);
        response.json(formattedReplies);
    } catch (error) {
        console.error("Error fetching tweet replies:", error);
        console.error(error.stack);
        response.status(500).json({ 
            error: "Internal Server Error", 
            message: error.message,
            details: process.env.NODE_ENV !== 'production' ? error.stack : undefined
        });
    }
});

const convertToCamelCaseForLikes = (replies) => ({
    tweetId: replies.tweet_id,
    name: replies.name
});

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
        
        let likes = [];
        
        if (process.env.NODE_ENV === 'production') {
            try {
                // Direct query to get all likes for all user's tweets
                likes = await db.any(`
                    SELECT 
                        t.tweet_id, 
                        u.name 
                    FROM "Tweet" t
                    JOIN "Like" l ON t.tweet_id = l.tweet_id
                    JOIN "User" u ON l.user_id = u.user_id
                    WHERE t.user_id = $1
                `, [user.user_id]);
                
                console.log(`Found ${likes.length} likes for user's tweets (PostgreSQL)`);
            } catch (pgError) {
                console.error("PostgreSQL query error:", pgError);
                console.error(pgError.stack);
                likes = [];
            }
        } else {
            // SQLite query to get all likes for all user's tweets
            const query = `
                SELECT 
                    t.tweet_id, 
                    u.name 
      FROM Tweet t 
      JOIN Like l ON t.tweet_id = l.tweet_id 
      JOIN User u ON l.user_id = u.user_id 
                WHERE t.user_id = ?
            `;
            
            const result = await dbHelpers.execute(query, [user.user_id]);
            likes = Array.isArray(result) ? result : [];
            console.log(`Found ${likes.length} likes for user's tweets (SQLite)`);
        }
        
        // Format to expected structure - directly map the results
        const formattedLikes = likes.map(like => ({
            tweetId: like.tweet_id,
            name: like.name
        }));
        
        console.log(`Returning ${formattedLikes.length} likes - sample:`, 
            formattedLikes.length > 0 ? formattedLikes[0] : "No likes found");
        
        response.json(formattedLikes);
    } catch (error) {
        console.error("Error fetching tweet likes:", error);
        console.error(error.stack);
        response.status(500).json({ 
            error: "Internal Server Error", 
            message: error.message,
            details: process.env.NODE_ENV !== 'production' ? error.stack : undefined
        });
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
                console.log("Using PostgreSQL insert");
                // Use 'none' instead of 'one' since we're not using RETURNING
                await db.none('INSERT INTO "Tweet" (tweet, user_id, date_time) VALUES ($1, $2, CURRENT_TIMESTAMP)', 
                    [tweet, user.user_id]);
                    
                // Then query the inserted tweet separately if needed
                const latestTweet = await db.oneOrNone(
                    'SELECT tweet_id, date_time FROM "Tweet" WHERE user_id = $1 ORDER BY date_time DESC LIMIT 1',
                    [user.user_id]
                );
                
                if (latestTweet) {
                    tweetId = latestTweet.tweet_id;
                    dateTime = latestTweet.date_time;
                    console.log(`Retrieved tweet with ID: ${tweetId}`);
                } else {
                    console.log("Tweet created but couldn't retrieve ID");
                    tweetId = 0;
                    dateTime = new Date().toISOString();
                }
            } catch (pgError) {
                console.error("PostgreSQL insert/query error:", pgError);
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

        console.log('Tweet created successfully');

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
        console.log(`User ${username} requesting their tweets`);
        
        // Get user
        const user = await dbHelpers.getUserByUsername(username);
        if (!user) {
            console.log(`User ${username} not found in database`);
            return response.status(400).json({ error: "User not found" });
        }
        
        let tweets = [];
        
        if (process.env.NODE_ENV === 'production') {
            try {
                // Use db.any for PostgreSQL
                tweets = await db.any(`
                    SELECT 
                        t.tweet_id, 
                        t.tweet, 
                        t.date_time,
                        COUNT(DISTINCT l.like_id) AS likes,
                        COUNT(DISTINCT r.reply_id) AS replies
                    FROM "Tweet" t
                    LEFT JOIN "Like" l ON t.tweet_id = l.tweet_id
                    LEFT JOIN "Reply" r ON t.tweet_id = r.tweet_id
                    WHERE t.user_id = $1
                    GROUP BY t.tweet_id, t.tweet, t.date_time
                    ORDER BY t.date_time DESC
                `, [user.user_id]);
                
                console.log(`Found ${tweets.length} tweets for user ${username} (PostgreSQL)`);
            } catch (pgError) {
                console.error("PostgreSQL query error:", pgError);
                console.error(pgError.stack);
                tweets = [];
            }
        } else {
            // For SQLite
            const query = `
                SELECT 
                    t.tweet_id, 
                    t.tweet, 
                    t.date_time,
                    COUNT(DISTINCT l.like_id) AS likes,
                    COUNT(DISTINCT r.reply_id) AS replies
                FROM Tweet t
                LEFT JOIN Like l ON t.tweet_id = l.tweet_id
                LEFT JOIN Reply r ON t.tweet_id = r.tweet_id
                WHERE t.user_id = ?
                GROUP BY t.tweet_id, t.tweet, t.date_time
                ORDER BY t.date_time DESC
            `;
            
            const result = await dbHelpers.execute(query, [user.user_id]);
            tweets = Array.isArray(result) ? result : [];
            console.log(`Found ${tweets.length} tweets for user ${username} (SQLite)`);
        }
        
        // Format response
        const result = tweets.map(tweet => ({
            tweetId: tweet.tweet_id,
            tweet: tweet.tweet,
            dateTime: tweet.date_time,
            likes: parseInt(tweet.likes) || 0,
            replies: parseInt(tweet.replies) || 0
        }));
        
        response.json(result);
    } catch (error) {
        console.error("Error fetching user tweets:", error);
        console.error(error.stack);
        response.status(500).json({ 
            error: "Internal Server Error", 
            message: error.message,
            details: process.env.NODE_ENV !== 'production' ? error.stack : undefined
        });
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
        if (process.env.NODE_ENV === 'production') {
            try {
                // For PostgreSQL
                console.log(`Using PostgreSQL delete for tweet ${tweetId}`);
                await db.none('DELETE FROM "Tweet" WHERE tweet_id = $1', [tweetId]);
                console.log(`Tweet ${tweetId} deleted successfully (PostgreSQL)`);
            } catch (pgError) {
                console.error("PostgreSQL delete error:", pgError);
                console.error(pgError.stack);
                throw pgError;
            }
        } else {
            // For SQLite
            console.log(`Using SQLite delete for tweet ${tweetId}`);
            await dbHelpers.execute('DELETE FROM Tweet WHERE tweet_id = ?', [tweetId]);
            console.log(`Tweet ${tweetId} deleted successfully (SQLite)`);
        }
        
        return response.json({ 
            success: true,
            message: "Tweet deleted successfully" 
        });
    } catch (error) {
        console.error("Error deleting tweet:", error);
        console.error(error.stack);
        return response.status(500).json({ 
            error: "Internal Server Error", 
            message: error.message,
            details: process.env.NODE_ENV !== 'production' ? error.stack : undefined 
        });
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
        
        // Insert a dummy notification if none exist (for testing)
        if (process.env.NODE_ENV === 'production') {
            try {
                const notificationCount = await db.one(`
                    SELECT COUNT(*) as count FROM "Notifications" WHERE user_id = $1
                `, [user.user_id]);
                
                if (parseInt(notificationCount.count) === 0) {
                    console.log("No notifications found, inserting test notification");
                    await db.none(`
                        INSERT INTO "Notifications" 
                        (user_id, from_user_id, type, message, is_read, created_at) 
                        VALUES ($1, $1, 'welcome', 'Welcome to Twitter Clone!', false, CURRENT_TIMESTAMP)
                    `, [user.user_id]);
                }
            } catch (dummyError) {
                console.error("Error inserting dummy notification:", dummyError);
            }
        }
        
        let notifications = [];
        
        if (process.env.NODE_ENV === 'production') {
            try {
                console.log("Using PostgreSQL query for notifications");
                notifications = await db.any(`
                    SELECT 
                        n.id, 
                        n.message,
                        n.type,
                        n.tweet_id,
                        u.username as triggered_by_username,
                        TO_CHAR(n.created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at,
                        n.is_read
                    FROM "Notifications" n
                    LEFT JOIN "User" u ON n.from_user_id = u.user_id
                    WHERE n.user_id = $1
                    ORDER BY n.created_at DESC NULLS LAST
                    LIMIT 10
                `, [user.user_id]);
                
                console.log(`Found ${notifications.length} notifications for ${username}`);
            } catch (pgError) {
                console.error("PostgreSQL notifications query error:", pgError);
                console.error(pgError.stack);
                notifications = [];
            }
        } else {
            // SQLite query
            console.log("Using SQLite query for notifications");
            try {
                const query = `
                    SELECT 
                        n.id, 
                        n.message,
                        n.type,
                        n.tweet_id,
                        u.username as triggered_by_username,
                        datetime(n.date_time) as created_at,
                        n.is_read 
                    FROM Notifications n
                    LEFT JOIN User u ON n.from_user_id = u.user_id
                    WHERE n.user_id = ?
                    ORDER BY n.date_time DESC
                    LIMIT 10
                `;
                
                const result = await dbHelpers.execute(query, [user.user_id]);
                notifications = Array.isArray(result) ? result : [];
                console.log(`Found ${notifications.length} notifications for user ${username} (SQLite)`);
            } catch (sqliteError) {
                console.error("SQLite notifications query error:", sqliteError);
                console.error(sqliteError.stack);
                notifications = [];
            }
        }
        
        // Format exactly as expected by frontend
        const formattedNotifications = notifications.map(n => ({
            id: n?.id || 0,
            message: n?.message || 'New notification',
            type: n?.type || 'info',
            tweet_id: n?.tweet_id || null,
            created_at: n?.created_at || new Date().toISOString(),
            is_read: !!n?.is_read,
            triggered_by_username: n?.triggered_by_username || username
        }));
        
        console.log("Sending notifications to client, sample:", 
            formattedNotifications.length > 0 ? 
            JSON.stringify(formattedNotifications[0]) : "No notifications");
        
        return response.json(formattedNotifications);
    } catch (error) {
        console.error("Error fetching notifications:", error);
        console.error(error.stack);
        return response.status(500).json({ 
            error: "Server error", 
            message: error.message,
            details: process.env.NODE_ENV !== 'production' ? error.stack : undefined
        });
    }
});

// Add suggestions endpoint
app.get('/suggestions', authenticateToken, async (request, response) => {
    try {
        const { username } = request.user;
    console.log(`User ${username} requesting suggestions`);
    
    // Get current user
    const currentUser = await dbHelpers.getUserByUsername(username);
    if (!currentUser) {
      console.log(`User ${username} not found`);
      return response.status(404).json({ error: 'User not found' });
    }
    
    console.log(`Got user with ID: ${currentUser.user_id}`);
    
    let suggestions = [];
    
    // Get users not followed by current user
    if (process.env.NODE_ENV === 'production') {
      try {
        // Use db.any for PostgreSQL
        suggestions = await db.any(`
          SELECT u.user_id, u.name, u.username 
          FROM "User" u
          WHERE u.user_id != $1
          AND u.user_id NOT IN (
            SELECT f.following_user_id 
            FROM "Follower" f
            WHERE f.follower_user_id = $1
          )
          LIMIT 5
        `, [currentUser.user_id]);
        
        console.log(`Found ${suggestions.length} suggestions for user ${username}`);
      } catch (pgError) {
        console.error("PostgreSQL query error:", pgError);
        console.error(pgError.stack);
        suggestions = [];
      }
    } else {
      // SQLite - continue using dbHelpers.execute
      const query = `
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

      const result = await dbHelpers.execute(query, [currentUser.user_id, currentUser.user_id]);
      suggestions = Array.isArray(result) ? result : [];
      console.log(`Found ${suggestions.length} suggestions for user ${username}`);
        }

        response.json(suggestions);
    } catch (error) {
    console.error('Error fetching suggestions:', error);
    console.error(error.stack);
    response.status(500).json({ 
      error: 'Internal server error', 
      message: error.message,
      details: process.env.NODE_ENV !== 'production' ? error.stack : undefined
    });
  }
});

// Follow a user
app.post('/follow/:userId', authenticateToken, async (request, response) => {
  try {
    const { username } = request.user;
    const { userId } = request.params;
    
    console.log(`User ${username} attempting to follow/unfollow user with ID ${userId}`);
    
    // Get current user
    const currentUser = await dbHelpers.getUserByUsername(username);
    if (!currentUser) {
        console.log(`Current user ${username} not found`);
        return response.status(404).json({ error: 'User not found' });
    }
    
    // Get user to follow
    const userToFollow = await dbHelpers.getUserById(userId);
    if (!userToFollow) {
        console.log(`User to follow with ID ${userId} not found`);
        return response.status(404).json({ error: 'User to follow not found' });
    }
    
    console.log(`User ${username} (ID: ${currentUser.user_id}) attempting to follow/unfollow ${userToFollow.username} (ID: ${userToFollow.user_id})`);
    
    // Check if already following - use db.oneOrNone for PostgreSQL to get exact results
    let isAlreadyFollowing = false;
    
    if (process.env.NODE_ENV === 'production') {
        try {
            const result = await db.oneOrNone('SELECT 1 FROM "Follower" WHERE follower_user_id = $1 AND following_user_id = $2',
                [currentUser.user_id, userToFollow.user_id]);
            isAlreadyFollowing = !!result;
            console.log(`Is already following (PostgreSQL check): ${isAlreadyFollowing}`);
        } catch (pgError) {
            console.error("PostgreSQL select error:", pgError);
            isAlreadyFollowing = false;
        }
    } else {
        // For SQLite
        const result = await dbHelpers.execute(
            'SELECT 1 FROM Follower WHERE follower_user_id = ? AND following_user_id = ?',
            [currentUser.user_id, userToFollow.user_id]
        );
        isAlreadyFollowing = !!result;
        console.log(`Is already following (SQLite check): ${isAlreadyFollowing}`);
    }
    
    if (isAlreadyFollowing) {
      // Unfollow if already following
      if (process.env.NODE_ENV === 'production') {
          try {
              // Direct PostgreSQL query
              await db.none('DELETE FROM "Follower" WHERE follower_user_id = $1 AND following_user_id = $2',
                  [currentUser.user_id, userToFollow.user_id]);
              console.log(`User ${username} unfollowed ${userToFollow.username}`);
          } catch (pgError) {
              console.error("PostgreSQL delete error:", pgError);
              throw pgError;
          }
      } else {
          // SQLite
          await dbHelpers.execute(
              'DELETE FROM Follower WHERE follower_user_id = ? AND following_user_id = ?',
              [currentUser.user_id, userToFollow.user_id]
          );
      }
      
      return response.json({ 
        success: true, 
        action: 'unfollowed',
        message: `You are no longer following ${userToFollow.username}` 
      });
    } else {
      // Follow user
      if (process.env.NODE_ENV === 'production') {
          try {
              // Direct PostgreSQL query
              await db.none('INSERT INTO "Follower" (follower_user_id, following_user_id) VALUES ($1, $2)',
                  [currentUser.user_id, userToFollow.user_id]);
              console.log(`User ${username} followed ${userToFollow.username}`);
          } catch (pgError) {
              console.error("PostgreSQL insert error:", pgError);
              throw pgError;
          }
      } else {
          // SQLite
          await dbHelpers.execute(
              'INSERT INTO Follower (follower_user_id, following_user_id) VALUES (?, ?)',
              [currentUser.user_id, userToFollow.user_id]
          );
      }
      
      // Try to create notification
      try {
        if (process.env.NODE_ENV === 'production') {
          // Fix: Notification INSERT should match table schema - without tweet_id for follow
          await db.none(
            'INSERT INTO "Notifications" (user_id, from_user_id, type, message, is_read, created_at) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)',
            [userToFollow.user_id, currentUser.user_id, 'follow', `@${username} started following you.`, false]
          );
        } else {
          await dbHelpers.execute(
            'INSERT INTO Notifications (user_id, from_user_id, type, message, is_read, date_time) VALUES (?, ?, ?, ?, ?, datetime("now"))',
            [userToFollow.user_id, currentUser.user_id, 'follow', `@${username} started following you.`, false]
          );
        }
        console.log(`Created follow notification for ${userToFollow.username}`);
      } catch (notifError) {
        console.error('Error creating follow notification:', notifError);
        console.error(notifError.stack);
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
    console.error(error.stack);
    response.status(500).json({ 
        error: 'Internal server error', 
        message: error.message,
        details: process.env.NODE_ENV !== 'production' ? error.stack : undefined
    });
  }
});

// Make sure to export the app for import in other files
module.exports = app;

// Add support for endpoint with trailing slash (used in Home.js)
app.get("/tweets/:tweetId/likes/", authenticateToken, async (req, res) => {
  // Redirect to the version without trailing slash
  const tweetId = req.params.tweetId;
  console.log(`Redirecting /tweets/${tweetId}/likes/ to /tweets/${tweetId}/likes`);
  
  try {
      const { username } = req.user;
      const { tweetId } = req.params;
      
      console.log(`User ${username} requesting likes for tweet ${tweetId} (with trailing slash)`);
      
      // Get user
      const user = await dbHelpers.getUserByUsername(username);
      if (!user) {
          console.log(`User ${username} not found in database`);
          return res.status(400).json({ error: "User not found" });
      }
      
      let likes = [];
      let userHasLiked = false;
      
      if (process.env.NODE_ENV === 'production') {
          try {
              // Get all likes for this tweet
              likes = await db.any(`
                  SELECT u.name, u.username, u.user_id
                  FROM "Like" l
                  JOIN "User" u ON l.user_id = u.user_id
                  WHERE l.tweet_id = $1
              `, [tweetId]);
              
              // Check if current user has liked
              userHasLiked = await db.oneOrNone(`
                  SELECT 1
                  FROM "Like" l
                  WHERE l.user_id = $1 AND l.tweet_id = $2
              `, [user.user_id, tweetId]) !== null;
              
              console.log(`Found ${likes.length} likes for tweet ${tweetId} (PostgreSQL), user has liked: ${userHasLiked}`);
          } catch (pgError) {
              console.error("PostgreSQL query error:", pgError);
              console.error(pgError.stack);
              likes = [];
          }
      } else {
          // SQLite - get all likes
          const query = `
              SELECT u.name, u.username, u.user_id
              FROM Like l
              JOIN User u ON l.user_id = u.user_id
              WHERE l.tweet_id = ?
          `;
          
          const result = await dbHelpers.execute(query, [tweetId]);
          likes = Array.isArray(result) ? result : [];
          
          // Check if current user has liked
          const userLikeQuery = `
              SELECT 1
              FROM Like l
              WHERE l.user_id = ? AND l.tweet_id = ?
          `;
          const userLike = await dbHelpers.execute(userLikeQuery, [user.user_id, tweetId]);
          userHasLiked = !!userLike;
          
          console.log(`Found ${likes.length} likes for tweet ${tweetId} (SQLite), user has liked: ${userHasLiked}`);
      }
      
      // Format likes array for Home.js - this component expects likes as property of response
      const likesArray = Array.isArray(likes) ? likes.map(item => item?.name || '') : [];
      
      // Response matching what Home.js expects
      const response = {
          likes: likesArray,
          hasLiked: userHasLiked,
          currentUser: username
      };
      
      console.log(`Response for tweet ${tweetId} likes (trailing slash):`, response);
      
      return res.json(response);
  } catch (error) {
      console.error("Error fetching likes:", error);
      console.error(error.stack);
      return res.status(500).json({ 
          error: "Server error", 
          message: error.message,
          details: process.env.NODE_ENV !== 'production' ? error.stack : undefined
      });
  }
});

// Add support for replies endpoint with trailing slash (used in Home.js)
app.get("/tweets/:tweetId/replies/", authenticateToken, async (req, res) => {
  try {
    const { username } = req.user;
    const { tweetId } = req.params;
  
      console.log(`User ${username} requesting replies for tweet ${tweetId} (with trailing slash)`);
      
      // Get user
      const user = await dbHelpers.getUserByUsername(username);
      if (!user) {
          console.log(`User ${username} not found in database`);
          return res.status(400).json({ error: "User not found" });
      }
      
      let replies = [];
      
      if (process.env.NODE_ENV === 'production') {
          try {
              // Use db.any for PostgreSQL - get ALL replies without filtering
              replies = await db.any(`
                  SELECT u.name, r.reply
                  FROM "Reply" r
                  JOIN "User" u ON r.user_id = u.user_id
                  WHERE r.tweet_id = $1
                  ORDER BY r.date_time DESC
              `, [tweetId]);
              
              console.log(`Found ${replies.length} replies for tweet ${tweetId} (PostgreSQL)`);
          } catch (pgError) {
              console.error("PostgreSQL query error:", pgError);
              console.error(pgError.stack);
              replies = [];
          }
      } else {
          // SQLite - get ALL replies without filtering
          const query = `
        SELECT u.name, r.reply
              FROM Reply r
              JOIN User u ON r.user_id = u.user_id
        WHERE r.tweet_id = ?
              ORDER BY r.date_time DESC
          `;
          
          const result = await dbHelpers.execute(query, [tweetId]);
          replies = Array.isArray(result) ? result : [];
          console.log(`Found ${replies.length} replies for tweet ${tweetId} (SQLite)`);
      }
      
      // Format replies to match what Home.js expects - replies property in response
      const formattedReplies = Array.isArray(replies) 
          ? replies.map(item => ({
              name: item?.name || '',
              reply: item?.reply || ''
          }))
          : [];
      
      // Response object with replies property
      const response = {
          replies: formattedReplies
      };
      
      console.log(`Response for tweet ${tweetId} replies (trailing slash):`, response);
      
      return res.json(response);
    } catch (error) {
      console.error("Error fetching replies:", error);
      console.error(error.stack);
      return res.status(500).json({ 
          error: "Server error", 
          message: error.message,
          details: process.env.NODE_ENV !== 'production' ? error.stack : undefined
      });
    }
  });
