const express = require('express')
const path = require('path')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const app = express()
app.use(express.json())
const dbPath = path.join(__dirname, './database/twitterClone.db')
let db = null
const intializeServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    console.log("Database connected successfully");
  } catch (e) {
    console.log(`error occured :${e}`)
  }
}
intializeServer()
const authenticateToken = async (request, response, next) => {
    const authHeader = request.headers['authorization'];
    if (!authHeader) {
        return response.status(401).send("Invalid JWT Token");
    }
    const jwtToken = authHeader.split(" ")[1];
    try {
        const payload = jwt.verify(jwtToken, "MY_SECRET_TOKEN");
        request.user = payload;
        next();
    } catch (err) {
        return response.status(401).send("Invalid JWT Token");
    }
};

app.get("/", (request, response) => {
    response.send("Welcome to the Twitter Clone API!");
  });

app.post("/register",async(request,response)=>{
    const {username,password,name,gender}=request.body
    const validGenders = ["Male", "Female", "Other"];
    if (!validGenders.includes(gender)) {
        return response.status(400).send("Invalid gender. Choose 'Male', 'Female', or 'Other'.");
    }
    if(password.length<6){
        return response.status(400).send('Password is too short')
    }
    const getUserQuery=`
    select *
    from User
    where username='${username}'`
    const dbUser = await db.get(getUserQuery)
    if(dbUser==undefined){
        const hashedPassword = await bcrypt.hash(password,10)
        const addUserQuery=`
        insert into User(name,username,password,gender)
        values('${name}','${username}','${hashedPassword}','${gender}')`
        await db.run(addUserQuery)
        return response.status(200).send('User created successfully')
    }
    else{
        return response.status(400).send('User already exists')
    }
})
app.post("/login", async (request, response) => {
    const { username, password } = request.body;
    const getUserQuery = `SELECT * FROM User WHERE username='${username}'`;
    const dbUser = await db.get(getUserQuery);
    if (!dbUser) {
        return response.status(400).send('Invalid user');
    }
    const comparePass = await bcrypt.compare(password, dbUser.password);
    console.log("Entered Password:", password);
    console.log("Hashed Password from DB:", dbUser.password);

    if (!comparePass) {
        return response.status(400).send('Invalid password');
    }
    const token = jwt.sign({ username: dbUser.username }, 'MY_SECRET_TOKEN');
    return response.send({ jwtToken: token });
});
convertToCamelCaseForTweets=(tweets)=>({
    username:tweets.username,
    tweet:tweets.tweet,
    dateTime:tweets.date_time
})
app.get('/user/tweets/feed/',authenticateToken,async(request,response)=>{
   const { username } = request.user;
 
  const getUserIdQuery = `SELECT user_id FROM User WHERE username ='${username}'`;
  const user = await db.get(getUserIdQuery);
    const getTweetsQuery =`
    SELECT User.username, Tweet.tweet, Tweet.date_time
    FROM Tweet
    JOIN Follower ON Tweet.user_id = Follower.following_user_id
    JOIN user ON User.user_id = Tweet.user_id
    WHERE Follower.follower_user_id = ${user.user_id}
    ORDER BY Tweet.date_time DESC
    LIMIT 4`
    const dbResponse = await db.all(getTweetsQuery)
    response.send(dbResponse.map(convertToCamelCaseForTweets));
})
convertToCamelCaseForFollowers=(user)=>{
    return {name:user.name}
}
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
        tweet:tweetDetails.tweet,
        likes:tweetDetails.likes,
        replies:tweetDetails.replies,
        dateTime:tweetDetails.date_time
    }
}
app.get("/tweets/:tweetId/", authenticateToken, async (request, response) => {
    const { username } = request.user;
    const { tweetId } = request.params;
    const getUserIdQuery = `SELECT user_id FROM User WHERE username ='${username}'`;
    const user = await db.get(getUserIdQuery);
    if (!user) {
        return response.status(400).send("User not found");
    }
    const checkUserQuery=`
    SELECT `
    const getTweetsQuery = `
        SELECT 
            t.tweet,
            COUNT(DISTINCT l.like_id) AS likes,
            COUNT(DISTINCT r.reply_id) AS replies,
            t.date_time
        FROM Tweet t
        LEFT JOIN Like l ON t.tweet_id = l.tweet_id
        LEFT JOIN Reply r ON t.tweet_id = r.tweet_id
        WHERE t.tweet_id =${tweetId}  
        AND t.user_id IN (
            SELECT f.following_user_id FROM Follower f WHERE f.follower_user_id = ${user.user_id}
        )
        GROUP BY t.tweet_id;
    `;
    const dbResponse = await db.get(getTweetsQuery);
    if (!dbResponse) {
        return response.status(401).send("Invalid Request");
    }
    return response.send(convertsnakecaseToCamelCase(dbResponse));
});
const likedNames =(result)=>{
    let arr = []
    for(let i=0;i < result.length;i++){
        arr[i]=result[i].name
    }
    return {'likes':arr}
}
app.get("/tweets/:tweetId/likes/",authenticateToken,async(request,response)=>{
    const { username } = request.user;
  const { tweetId } = request.params;
  const getUserIdQuery = `SELECT user_id FROM User WHERE username ='${username}'`;
  const user = await db.get(getUserIdQuery);
    const getTweets=`
    select u.name
    from Tweet t join Like l on t.tweet_id = l.tweet_id join User u on  l.user_id = u.user_id 
    where t.tweet_id=${tweetId} and (select user_id from Tweet where tweet_id=${tweetId}) in (
        select f.following_user_id
        from Follower f 
        where f.follower_user_id = ${user.user_id})`
     const dbResponse = await db.all(getTweets)
     if(dbResponse == undefined) return response.status(401).send("Invalid Request")
     return response.send(likedNames(dbResponse))
})
const repliesNames=(result)=>{
   return {name:result.name,reply:result.reply}
}
app.get("/tweets/:tweetId/replies/",authenticateToken,async(request,response)=>{
    const { username } = request.user;
  const { tweetId } = request.params;
  const getUserIdQuery = `SELECT user_id FROM User WHERE username ='${username}'`;
  const user = await db.get(getUserIdQuery);
    const getTweets=`
    select r.reply,u.name
    from Tweet t join Reply r on t.tweet_id = r.tweet_id join User u on r.user_id = u.user_id 
    where t.tweet_id=${tweetId} and (select user_id from Tweet where tweet_id=${tweetId}) in (
        select f.following_user_id
        from Follower f 
        where follower_user_id = ${user.user_id})`
     const dbResponse = await db.all(getTweets)
     if(dbResponse == undefined) return response.status(401).send("Invalid Request")
     return response.send({'replies':dbResponse.map(repliesNames)})
})
app.get("/user/tweets/",authenticateToken,async(request,response)=>{
    const { username } = request.user;
  const getUserIdQuery = `SELECT user_id FROM User WHERE username ='${username}'`;
  const user = await db.get(getUserIdQuery);
    getTweets=`
        SELECT 
            t.tweet, 
            COUNT(DISTINCT l.like_id) AS likes,
            COUNT(DISTINCT r.reply_id) AS replies,
            t.date_time
        FROM Tweet t
        LEFT JOIN Like l ON t.tweet_id = l.tweet_id
        LEFT JOIN Reply r ON t.tweet_id = r.tweet_id
        WHERE t.user_id = ${user.user_id}
        GROUP BY t.tweet_id
        ORDER BY t.date_time DESC;`
     const dbResponse = await db.all(getTweets)
    return response.send(dbResponse.map(convertsnakecaseToCamelCase))
})
app.post("/user/tweets", authenticateToken, async (request, response) => {
    try {
        const { username } = request.user;
        const getUserIdQuery = `SELECT user_id FROM User WHERE username = ?`;
        const user = await db.get(getUserIdQuery, [username]);

        if (!user) {
            return response.status(400).send("Invalid user");
        }

        const { tweet } = request.body;

        if (!tweet || tweet.trim() === "") {
            return response.status(400).send("Tweet cannot be empty.");
        }

        const postTweetQuery = `INSERT INTO Tweet (tweet, user_id) VALUES (?, ?)`;
        await db.run(postTweetQuery, [tweet, user.user_id]);

        return response.send("Created a Tweet");
    } catch (error) {
        console.error("Error posting tweet:", error);
        return response.status(500).send("Internal Server Error");
    }
});

app.delete("/tweets/:tweetId/", authenticateToken, async (request, response) => {
    const { username } = request.user;
    const { tweetId } = request.params;
    const getUserIdQuery = `SELECT user_id FROM User WHERE username = '${username}'`;
    const user = await db.get(getUserIdQuery);
    const checkTweetQuery = `SELECT user_id FROM Tweet WHERE tweet_id =${tweetId}`;
    const tweet = await db.get(checkTweetQuery);
    if (!tweet || tweet.user_id !== user.user_id) {
        return response.status(401).send("Invalid Request");
    }
    const deleteTweetQuery = `DELETE FROM Tweet WHERE tweet_id =${tweetId}`;
    await db.run(deleteTweetQuery);
    return response.send("Tweet Removed");
});

module.exports = app;
