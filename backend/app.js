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

app.options('*', (req, res) => {
    const allowedOrigin = process.env.NODE_ENV === 'production'
        ? 'https://vyshnavi005-max.github.io'
        : 'http://localhost:3001';
        
    res.header("Access-Control-Allow-Origin", allowedOrigin);
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.header("Access-Control-Allow-Credentials", "true"); 
    res.sendStatus(204);
});


app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
        ? 'https://vyshnavi005-max.github.io' 
        : 'http://localhost:3001',
    credentials: true,
}));

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
    const authHeader = request.headers['authorization'];
    const bearerToken = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;
    const cookieToken = request.cookies.token || request.cookies.jwtToken;

    const jwtToken = bearerToken || cookieToken;

    if (!jwtToken) {
        console.log("No JWT token found in headers or cookies");
        return response.status(401).send("Invalid JWT Token");
    }

    try {
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
            return response.status(401).send("Invalid JWT Token");
        }
        
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
        const { username, password, name, gender } = request.body;
        const validGenders = ["Male", "Female", "Other"];
        
        if (!validGenders.includes(gender)) {
            return response.status(400).send("Invalid gender. Choose 'Male', 'Female', or 'Other'.");
        }
        
        if (password.length < 6) {
            return response.status(400).send('Password is too short');
        }
        
        // Check if user exists
        let dbUser;
        if (process.env.NODE_ENV === 'production') {
            // PostgreSQL query
            dbUser = await db.oneOrNone('SELECT * FROM "User" WHERE username = $1', [username]);
        } else {
            // SQLite query
            const getUserQuery = `
            select *
            from User
            where username='${username}'`;
            dbUser = await db.get(getUserQuery);
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
                // SQLite query
                const addUserQuery = `
                insert into User(name, username, password, gender)
                values('${name}', '${username}', '${hashedPassword}', '${gender}')`;
                await db.run(addUserQuery);
            }
            
            return response.status(200).send('User created successfully');
        } else {
            return response.status(400).send('User already exists');
        }
    } catch (error) {
        console.error("Registration error:", error);
        return response.status(500).send('Server error during registration');
    }
});

app.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body;
        
        // Different query based on database type
        let user;
        if (process.env.NODE_ENV === 'production') {
            // PostgreSQL query
            user = await db.oneOrNone("SELECT * FROM \"User\" WHERE username = $1", [username]);
        } else {
            // SQLite query
            user = await db.get("SELECT * FROM User WHERE username = ?", [username]);
        }
        
        if (!user) {
            return res.status(400).json({ error: "Invalid username or password" });
        }

        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            return res.status(400).json({ error: "Invalid username or password" });
        }

        const token = jwt.sign({ 
            username: user.username,
            userId: user.user_id 
        }, process.env.JWT_SECRET, { expiresIn: "1h" });

        res.cookie("token", token, { 
            httpOnly: true, 
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax'
        });

        return res.status(200).json({ message: "Login successful", token });
    } catch (error) {
        console.error("Login error:", error);
        return res.status(500).json({ error: "Server error" });
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
        let dbResponse;
        
        if (process.env.NODE_ENV === 'production') {
            // PostgreSQL query
            const user = await db.oneOrNone('SELECT user_id FROM "User" WHERE username = $1', [username]);
            if (!user) return response.status(400).send("User not found");
            
            dbResponse = await db.any(`
                SELECT u.username, t.tweet_id, t.tweet, t.date_time
                FROM "Tweet" t
                JOIN "Follower" f ON t.user_id = f.following_user_id
                JOIN "User" u ON u.user_id = t.user_id
                WHERE f.follower_user_id = $1
                ORDER BY t.date_time DESC
            `, [user.user_id]);
        } else {
            // SQLite query
            const getUserIdQuery = `SELECT user_id FROM User WHERE username ='${username}'`;
            const user = await db.get(getUserIdQuery);
            const getTweetsQuery = `
                SELECT User.username, Tweet.tweet_id, Tweet.tweet, Tweet.date_time
                FROM Tweet
                JOIN Follower ON Tweet.user_id = Follower.following_user_id
                JOIN User ON User.user_id = Tweet.user_id
                WHERE Follower.follower_user_id = ${user.user_id}
                ORDER BY Tweet.date_time DESC
            `;
            dbResponse = await db.all(getTweetsQuery);
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
    const { username } = req.user;
    const { tweetId } = req.params;
  
    try {
      const getUserIdQuery = `SELECT user_id FROM user WHERE username = ?`;
      const user = await db.get(getUserIdQuery, [username]);
  
      const getTweets = `
        SELECT u.name
        FROM like l
        JOIN user u ON l.user_id = u.user_id
        WHERE l.tweet_id = ?
          AND l.tweet_id IN (
            SELECT tweet_id
            FROM tweet
            WHERE user_id IN (
              SELECT following_user_id
              FROM follower
              WHERE follower_user_id = ?
            )
          )
      `;
  
      const dbResponse = await db.all(getTweets, [tweetId, user.user_id]);
  
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
    const { username } = req.user;
    const { tweetId } = req.params;
  
    try {
      const getUserIdQuery = `SELECT user_id FROM user WHERE username = ?`;
      const user = await db.get(getUserIdQuery, [username]);
  
      const getRepliesQuery = `
        SELECT u.name, r.reply
        FROM reply r
        JOIN user u ON r.user_id = u.user_id
        WHERE r.tweet_id = ?
          AND r.tweet_id IN (
            SELECT tweet_id
            FROM tweet
            WHERE user_id IN (
              SELECT following_user_id
              FROM follower
              WHERE follower_user_id = ?
            )
          )
      `;
  
      const dbResponse = await db.all(getRepliesQuery, [tweetId, user.user_id]);
  
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
                
                await db.none(
                    'INSERT INTO "Notifications" (user_id, from_user_id, tweet_id, type, message) VALUES ($1, $2, $3, $4, $5)',
                    [tweet.user_id, user.user_id, tweetId, 'like', `${username} liked your tweet.`]
                );
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
                
                await db.run(
                    `INSERT INTO notifications (user_id, from_user_id, tweet_id, type, message) 
                    VALUES (?, ?, ?, 'like', ?)`,
                    [tweet.user_id, user.user_id, tweetId, `${username} liked your tweet.`]
                );
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
            
            await db.none(
                'INSERT INTO "Notifications" (user_id, from_user_id, tweet_id, type, message) VALUES ($1, $2, $3, $4, $5)',
                [tweet.user_id, user.user_id, tweetId, 'reply', `${username} replied: "${replyText}"`]
            );
            
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
            
            await db.run(
                `INSERT INTO Notifications (user_id, from_user_id, tweet_id, type, message) 
                 VALUES (?, ?, ?, 'reply', ?)`,
                [tweet.user_id, user.user_id, tweetId, `${username} replied: "${replyText}"`]
            );
            
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
            followers = await db.one('SELECT COUNT(*) as count FROM "Follower" WHERE following_user_id = $1', [user.user_id]);
            following = await db.one('SELECT COUNT(*) as count FROM "Follower" WHERE follower_user_id = $1', [user.user_id]);
        } else {
            // SQLite queries
            user = await db.get('SELECT user_id, name, username FROM User WHERE username = ?', [username]);
            
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            // Get follower and following counts
            followers = await db.get('SELECT COUNT(*) as count FROM Follower WHERE following_user_id = ?', [user.user_id]);
            following = await db.get('SELECT COUNT(*) as count FROM Follower WHERE follower_user_id = ?', [user.user_id]);
        }

        res.json({
            username: user.username,
            name: user.name,
            followersCount: followers.count,
            followingCount: following.count
        });
    } catch (error) {
        console.error('Error in profile endpoint:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
  
app.get("/user/followers/",authenticateToken,async(request,response)=>{
   const { username } = request.user;
  const getUserIdQuery = `SELECT user_id FROM User WHERE username ='${username}'`;
  const user = await db.get(getUserIdQuery);
    const getNamesQuery=`
    select User.name
    from User join Follower on User.user_id = Follower.follower_user_id 
    where Follower.following_user_id =${user.user_id}` 
    const dbResponse = await db.all(getNamesQuery)
    response.send(dbResponse.map(convertToCamelCaseForFollowers));
})
app.get("/user/following/",authenticateToken,async(request,response)=>{
   const { username } = request.user;
  const getUserIdQuery = `SELECT user_id FROM User WHERE username ='${username}'`;
  const user = await db.get(getUserIdQuery);
    const getNamesQuery=`
    select User.name
    from User join Follower on User.user_id = Follower.following_user_id
    where Follower.follower_user_id =${user.user_id}` 
    const dbResponse = await db.all(getNamesQuery)
    response.send(dbResponse.map(convertToCamelCaseForFollowers));
})
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
    const { username } = request.user;
    const getUserIdQuery = `SELECT user_id FROM User WHERE username = '${username}'`;
    const user = await db.get(getUserIdQuery);
  
    const getOwnTweetRepliesQuery = `
      SELECT t.tweet_id, u.name, r.reply 
      FROM Tweet t 
      JOIN Reply r ON t.tweet_id = r.tweet_id 
      JOIN User u ON r.user_id = u.user_id 
      WHERE t.user_id = ${user.user_id}
    `;
    const dbResponse = await db.all(getOwnTweetRepliesQuery);
    response.send(dbResponse.map((eachItem)=>convertToCamelCaseForReplies(eachItem)));
  });
  const convertToCamelCaseForLikes=(replies)=>({
    tweetId:replies.tweet_id,
    name:replies.name
})
  app.get("/user/tweets/likes/", authenticateToken, async (request, response) => {
    const { username } = request.user;
    const getUserIdQuery = `SELECT user_id FROM User WHERE username = '${username}'`;
    const user = await db.get(getUserIdQuery);
  
    const getOwnTweetLikesQuery = `
      SELECT t.tweet_id, u.name 
      FROM Tweet t 
      JOIN Like l ON t.tweet_id = l.tweet_id 
      JOIN User u ON l.user_id = u.user_id 
      WHERE t.user_id = ${user.user_id}
    `;
    const dbResponse = await db.all(getOwnTweetLikesQuery);
    response.send(dbResponse.map((eachItem)=>convertToCamelCaseForLikes(eachItem)));
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
            
            getTweets = `
                SELECT
                    t.tweet_id AS tweet_id,
                    t.tweet, 
                    COUNT(DISTINCT l.like_id) AS likes,
                    COUNT(DISTINCT r.reply_id) AS replies,
                    t.date_time
                FROM Tweet t
                LEFT JOIN Like l ON t.tweet_id = l.tweet_id
                LEFT JOIN Reply r ON t.tweet_id = r.tweet_id
                WHERE t.user_id = ${user.user_id}
                GROUP BY t.tweet_id
                ORDER BY t.date_time DESC;`;
            dbResponse = await db.all(getTweets);
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
            
            notifications = await db.any(`
                SELECT * 
                FROM "Notifications" 
                WHERE user_id = $1 
                ORDER BY created_at DESC
            `, [user.user_id]);
        } else {
            // SQLite queries
            user = await db.get("SELECT user_id FROM User WHERE username = ?", [username]);
            if (!user) return response.status(400).send("User not found");
            
            const getNotificationsQuery = `
                SELECT * 
                FROM notifications 
                WHERE user_id = ${user.user_id} 
                ORDER BY created_at DESC
            `;
            notifications = await db.all(getNotificationsQuery);
        }
        
        response.json(notifications);
    } catch (error) {
        console.error("Error fetching notifications:", error);
        response.status(500).json({ error: "Internal server error" });
    }
});

app.post("/notifications/:id/read", authenticateToken, async (request, response) => {
    try {
        const { id } = request.params;
        
        if (process.env.NODE_ENV === 'production') {
            // PostgreSQL query
            await db.none('UPDATE "Notifications" SET is_read = true WHERE id = $1', [id]);
        } else {
            // SQLite query
            await db.run(`UPDATE notifications SET is_read = 1 WHERE id = ${id}`);
        }

        response.send({ message: "Notification marked as read" });
    } catch (error) {
        console.error("Error marking notification as read:", error);
        response.status(500).json({ error: "Internal server error" });
    }
});

// API to follow a user
app.post('/follow/:userId', authenticateToken, async (request, response) => {
    try {
        const { userId } = request.params;
        const jwtToken = request.cookies.token || request.cookies.jwtToken;
        const payload = jwt.verify(jwtToken, process.env.JWT_SECRET);
        const followerId = payload.userId;

        if (followerId === parseInt(userId)) {
            return response.status(400).json({ error: "You cannot follow yourself" });
        }

        // Check if already following
        let existingFollow;
        if (process.env.NODE_ENV === 'production') {
            // PostgreSQL query
            existingFollow = await db.oneOrNone(
                'SELECT * FROM "Follower" WHERE follower_user_id = $1 AND following_user_id = $2',
                [followerId, userId]
            );
        } else {
            // SQLite query
            existingFollow = await db.get(
                `SELECT * FROM Follower WHERE follower_user_id = ? AND following_user_id = ?`,
                [followerId, userId]
            );
        }

        if (existingFollow) {
            return response.status(400).json({ error: "Already following this user" });
        }

        // Add follow relationship
        if (process.env.NODE_ENV === 'production') {
            // PostgreSQL query
            await db.none(
                'INSERT INTO "Follower" (follower_user_id, following_user_id) VALUES ($1, $2)',
                [followerId, userId]
            );

            // Add notification
            await db.none(
                'INSERT INTO "Notifications" (user_id, from_user_id, type, message) VALUES ($1, $2, $3, $4)',
                [userId, followerId, 'follow', `@${payload.username} started following you`]
            );
        } else {
            // SQLite query
            await db.run(
                `INSERT INTO Follower (follower_user_id, following_user_id) VALUES (?, ?)`,
                [followerId, userId]
            );

            // Add notification
            await db.run(
                `INSERT INTO Notifications (user_id, from_user_id, type, message) VALUES (?, ?, 'follow', ?)`,
                [userId, followerId, `@${payload.username} started following you`]
            );
        }

        response.json({ message: "Followed successfully" });
    } catch (error) {
        console.error("Follow error:", error);
        response.status(500).json({ error: error.message });
    }
});

// API to unfollow a user
app.post('/unfollow/:userId', authenticateToken, async (request, response) => {
    try {
        const { userId } = request.params;
        const jwtToken = request.cookies.token || request.cookies.jwtToken;
        const payload = jwt.verify(jwtToken, process.env.JWT_SECRET);
        const followerId = payload.userId;

        if (process.env.NODE_ENV === 'production') {
            // PostgreSQL query
            await db.none(
                'DELETE FROM "Follower" WHERE follower_user_id = $1 AND following_user_id = $2',
                [followerId, userId]
            );
        } else {
            // SQLite query
            await db.run(
                `DELETE FROM Follower WHERE follower_user_id = ? AND following_user_id = ?`,
                [followerId, userId]
            );
        }
        
        response.json({ message: "Unfollowed successfully" });
    } catch (error) {
        console.error("Unfollow error:", error);
        response.status(500).json({ error: error.message });
    }
});

// API to get user suggestions
app.get('/suggestions', authenticateToken, async (request, response) => {
    try {
        const { username } = request.user;
        let suggestions;
        
        if (process.env.NODE_ENV === 'production') {
            // First get the user's ID from their username (PostgreSQL)
            const user = await db.oneOrNone('SELECT user_id FROM "User" WHERE username = $1', [username]);
            if (!user) {
                return response.status(401).json({ error: 'User not found' });
            }

            // PostgreSQL query
            suggestions = await db.any(`
                SELECT u.user_id, u.name, u.username 
                FROM "User" u
                WHERE u.user_id != $1 
                AND u.user_id NOT IN (
                    SELECT following_user_id 
                    FROM "Follower" 
                    WHERE follower_user_id = $1
                )
                ORDER BY RANDOM()
                LIMIT 5
            `, [user.user_id]);
        } else {
            // First get the user's ID from their username (SQLite)
            const user = await db.get('SELECT user_id FROM User WHERE username = ?', [username]);
            if (!user) {
                return response.status(401).json({ error: 'User not found' });
            }

            const userId = user.user_id;

            // SQLite query
            suggestions = await db.all(`
                SELECT u.user_id, u.name, u.username 
                FROM User u
                WHERE u.user_id != ? 
                AND u.user_id NOT IN (
                    SELECT following_user_id 
                    FROM Follower 
                    WHERE follower_user_id = ?
                )
                ORDER BY RANDOM()
                LIMIT 5
            `, [userId, userId]);
        }

        if (!suggestions || suggestions.length === 0) {
            return response.status(200).json([]);
        }

        response.json(suggestions);
    } catch (error) {
        console.error('Error in suggestions endpoint:', error);
        response.status(500).json({ error: 'Internal server error' });
    }
});

// API to get following list
app.get('/following', authenticateToken, async (request, response) => {
    try {
        const jwtToken = request.cookies.token || request.cookies.jwtToken;
        const payload = jwt.verify(jwtToken, process.env.JWT_SECRET);
        const userId = payload.userId;
        let following;

        if (process.env.NODE_ENV === 'production') {
            // PostgreSQL query
            following = await db.any(`
                SELECT u.user_id, u.name, u.username 
                FROM "User" u
                JOIN "Follower" f ON u.user_id = f.following_user_id
                WHERE f.follower_user_id = $1
            `, [userId]);
        } else {
            // SQLite query
            following = await db.all(`
                SELECT u.user_id, u.name, u.username 
                FROM User u
                JOIN Follower f ON u.user_id = f.following_user_id
                WHERE f.follower_user_id = ?
            `, [userId]);
        }

        response.json(following);
    } catch (error) {
        console.error('Error getting following list:', error);
        response.status(500).json({ error: error.message });
    }
});

// API to get followers list
app.get('/followers', authenticateToken, async (request, response) => {
    try {
        const jwtToken = request.cookies.token || request.cookies.jwtToken;
        const payload = jwt.verify(jwtToken, process.env.JWT_SECRET);
        const userId = payload.userId;
        let followers;

        if (process.env.NODE_ENV === 'production') {
            // PostgreSQL query
            followers = await db.any(`
                SELECT u.user_id, u.name, u.username 
                FROM "User" u
                JOIN "Follower" f ON u.user_id = f.follower_user_id
                WHERE f.following_user_id = $1
            `, [userId]);
        } else {
            // SQLite query
            followers = await db.all(`
                SELECT u.user_id, u.name, u.username 
                FROM User u
                JOIN Follower f ON u.user_id = f.follower_user_id
                WHERE f.following_user_id = ?
            `, [userId]);
        }

        response.json(followers);
    } catch (error) {
        console.error('Error getting followers list:', error);
        response.status(500).json({ error: error.message });
    }
});

console.log('Current NODE_ENV:', process.env.NODE_ENV);

module.exports = app;
