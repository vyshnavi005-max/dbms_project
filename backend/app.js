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

// Define allowed origins with a wildcard fallback for development
const allowedOrigins = process.env.NODE_ENV === 'production' 
    ? ['https://vyshnavi005-max.github.io', 'https://twitter-clone-backend-534j.onrender.com', '*'] 
    : ['http://localhost:3001', 'http://localhost:3000', '*'];

// Clear any existing CORS middleware
app.use((req, res, next) => {
    const origin = req.headers.origin;
    
    // For null or undefined origins (like Postman)
    if (!origin) {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
        res.header('Access-Control-Allow-Credentials', 'true');
        
        if (req.method === 'OPTIONS') {
            console.log(`Handling OPTIONS request from unknown origin`);
            return res.status(200).end();
        }
        
        return next();
    }
    
    // Check if the origin is allowed
    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        res.header('Access-Control-Allow-Origin', origin);
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
        res.header('Access-Control-Allow-Credentials', 'true');
        
        console.log(`Request from allowed origin: ${origin}`);
    } else {
        console.log(`Request from disallowed origin: ${origin}`);
    }
    
    // Handle preflight OPTIONS requests
    if (req.method === 'OPTIONS') {
        console.log(`Handling OPTIONS request from ${origin || 'Unknown Origin'}`);
        return res.status(200).end();
    }
    
    // Log all requests for debugging
    console.log(`${req.method} ${req.url} from ${origin || 'Unknown Origin'}`);
    
    next();
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
    if (process.env.NODE_ENV === 'production') {
      return await db.oneOrNone('SELECT * FROM "User" WHERE username = $1', [username]);
    } else {
      return await db.get('SELECT * FROM User WHERE username = ?', [username]);
    }
  },
  
  getUserById: async (userId) => {
    if (process.env.NODE_ENV === 'production') {
      return await db.oneOrNone('SELECT * FROM "User" WHERE user_id = $1', [userId]);
    } else {
      return await db.get('SELECT * FROM User WHERE user_id = ?', [userId]);
    }
  },
  
  // Tweet queries
  getTweetById: async (tweetId) => {
    if (process.env.NODE_ENV === 'production') {
      return await db.oneOrNone('SELECT * FROM "Tweet" WHERE tweet_id = $1', [tweetId]);
    } else {
      return await db.get('SELECT * FROM Tweet WHERE tweet_id = ?', [tweetId]);
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
            return response.status(401).send("Invalid JWT Token");
        }
        
        // Verify the token
        const payload = jwt.verify(jwtToken, process.env.JWT_SECRET);
        
        // Get user details using helper function
        const user = await dbHelpers.getUserByUsername(payload.username);
        
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
        let user, tweet, existingLike;

        user = await dbHelpers.getUserByUsername(username);
        if (!user) return response.status(401).json({ error: "Unauthorized user" });
        
        tweet = await dbHelpers.getTweetById(tweetId);
        if (!tweet) return response.status(404).json({ error: "Tweet not found" });
        
        existingLike = await dbHelpers.execute(
            'SELECT * FROM "Like" WHERE user_id = $1 AND tweet_id = $2', 
            [user.user_id, tweetId]
        );
        
        if (existingLike) {
            await dbHelpers.execute('DELETE FROM "Like" WHERE user_id = $1 AND tweet_id = $2', [user.user_id, tweetId]);
        } else {
            await dbHelpers.execute(
                'INSERT INTO "Like" (user_id, tweet_id) VALUES ($1, $2)', 
                [user.user_id, tweetId]
            );
            
            try {
                await dbHelpers.execute(
                    'INSERT INTO "Notification" (user_id, triggered_by_user_id, tweet_id, type, content, is_read) VALUES ($1, $2, $3, $4, $5, $6)',
                    [tweet.user_id, user.user_id, tweetId, 'like', `${username} liked your tweet.`, false]
                );
            } catch (notifError) {
                console.error("Error creating notification:", notifError);
                // Continue even if notification creation fails
            }
        }
        
        // Get updated likes list with usernames
        const likes = await dbHelpers.execute(`
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

        user = await dbHelpers.getUserByUsername(username);
        if (!user) return response.status(401).send({ error: "Unauthorized user" });
        
        tweet = await dbHelpers.getTweetById(tweetId);
        if (!tweet) return response.status(404).send({ error: "Tweet not found" });
        
        isFollowing = await dbHelpers.execute(
            'SELECT 1 FROM "Follower" WHERE follower_user_id = $1 AND following_user_id = $2',
            [user.user_id, tweet.user_id]
        );
        
        if (!isFollowing) return response.status(403).send({ error: "You can only reply to tweets from users you follow" });
        
        await dbHelpers.execute(
            'INSERT INTO "Reply" (user_id, tweet_id, reply) VALUES ($1, $2, $3)',
            [user.user_id, tweetId, replyText]
        );
        
        try {
            await dbHelpers.execute(
                'INSERT INTO "Notification" (user_id, triggered_by_user_id, tweet_id, type, content, is_read) VALUES ($1, $2, $3, $4, $5, $6)',
                [tweet.user_id, user.user_id, tweetId, 'reply', `${username} replied: "${replyText}"`, false]
            );
        } catch (notifError) {
            console.error("Error creating notification:", notifError);
            // Continue even if notification creation fails
        }
        
        // Get updated replies list with names
        const replies = await dbHelpers.execute(`
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
        
        // Get user details
        const user = await dbHelpers.getUserByUsername(username);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Use more consistent SQL for count queries
        const followersQuery = process.env.NODE_ENV === 'production' 
            ? 'SELECT COUNT(*) as count FROM "Follower" WHERE following_user_id = $1'
            : 'SELECT COUNT(*) as count FROM Follower WHERE following_user_id = ?';
            
        const followingQuery = process.env.NODE_ENV === 'production'
            ? 'SELECT COUNT(*) as count FROM "Follower" WHERE follower_user_id = $1'
            : 'SELECT COUNT(*) as count FROM Follower WHERE follower_user_id = ?';

        // Get follower and following counts
        const [followersResult, followingResult] = await Promise.all([
            dbHelpers.execute(followersQuery, [user.user_id]),
            dbHelpers.execute(followingQuery, [user.user_id])
        ]);
        
        // Handle different db result formats safely
        const followersCount = followersResult && typeof followersResult.count !== 'undefined' 
            ? parseInt(followersResult.count) 
            : 0;
            
        const followingCount = followingResult && typeof followingResult.count !== 'undefined'
            ? parseInt(followingResult.count)
            : 0;

        // Return user profile data
        res.json({
            username: user.username,
            name: user.name,
            followersCount: followersCount,
            followingCount: followingCount
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
        
        user = await dbHelpers.getUserByUsername(username);
        if (!user) return response.status(400).send("User not found");
        
        followers = await dbHelpers.execute(`
            SELECT u.name
            FROM "User" u
            JOIN "Follower" f ON u.user_id = f.follower_user_id
            WHERE f.following_user_id = $1
        `, [user.user_id]);
        
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
        
        user = await dbHelpers.getUserByUsername(username);
        if (!user) return response.status(400).send("User not found");
        
        following = await dbHelpers.execute(`
            SELECT u.name
            FROM "User" u
            JOIN "Follower" f ON u.user_id = f.following_user_id
            WHERE f.follower_user_id = $1
        `, [user.user_id]);
        
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
        
        user = await dbHelpers.getUserByUsername(username);
        if (!user) return response.status(400).send("User not found");
        
        dbResponse = await dbHelpers.execute(`
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
        
        user = await dbHelpers.getUserByUsername(username);
        if (!user) return response.status(400).send("User not found");
        
        replies = await dbHelpers.execute(`
            SELECT t.tweet_id, u.name, r.reply 
            FROM "Tweet" t 
            JOIN "Reply" r ON t.tweet_id = r.tweet_id 
            JOIN "User" u ON r.user_id = u.user_id 
            WHERE t.user_id = $1
        `, [user.user_id]);
        
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
        
        user = await dbHelpers.getUserByUsername(username);
        if (!user) return response.status(400).send("User not found");
        
        likes = await dbHelpers.execute(`
            SELECT t.tweet_id, u.name 
            FROM "Tweet" t 
            JOIN "Like" l ON t.tweet_id = l.tweet_id 
            JOIN "User" u ON l.user_id = u.user_id 
            WHERE t.user_id = $1
        `, [user.user_id]);
        
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
        
        user = await dbHelpers.getUserByUsername(username);

        if (!user) {
            return response.status(400).send("Invalid user");
        }

        const { tweet } = request.body;

        if (!tweet || tweet.trim() === "") {
            return response.status(400).send("Tweet cannot be empty.");
        }

        await dbHelpers.execute('INSERT INTO "Tweet" (tweet, user_id) VALUES ($1, $2)', [tweet, user.user_id]);

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
        
        user = await dbHelpers.getUserByUsername(username);
        if (!user) return response.status(400).send("User not found");
        
        dbResponse = await dbHelpers.execute(`
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
        
        user = await dbHelpers.getUserByUsername(username);
        if (!user) return response.status(400).send("User not found");
        
        tweet = await dbHelpers.getTweetById(tweetId);
        
        if (!tweet || tweet.user_id !== user.user_id) {
            return response.status(401).send("Invalid Request");
        }
        
        await dbHelpers.execute('DELETE FROM "Tweet" WHERE tweet_id = $1', [tweetId]);
        
        return response.send("Tweet Removed");
    } catch (error) {
        console.error("Error deleting tweet:", error);
        return response.status(500).send("Internal Server Error");
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