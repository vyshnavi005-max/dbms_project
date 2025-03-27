-- Create User Table
CREATE TABLE IF NOT EXISTS User (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    gender TEXT CHECK(gender IN ('Male', 'Female', 'Other')) NOT NULL
);

-- Create Follower Table
CREATE TABLE IF NOT EXISTS Follower (
    follower_id INTEGER PRIMARY KEY AUTOINCREMENT,
    follower_user_id INTEGER NOT NULL,
    following_user_id INTEGER NOT NULL,
    FOREIGN KEY (follower_user_id) REFERENCES User(user_id),
    FOREIGN KEY (following_user_id) REFERENCES User(user_id)
);

-- Create Tweet Table
CREATE TABLE IF NOT EXISTS Tweet (
    tweet_id INTEGER PRIMARY KEY AUTOINCREMENT,
    tweet TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    date_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES User(user_id)
);

-- Create Reply Table
CREATE TABLE IF NOT EXISTS Reply (
    reply_id INTEGER PRIMARY KEY AUTOINCREMENT,
    tweet_id INTEGER NOT NULL,
    reply TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    date_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tweet_id) REFERENCES Tweet(tweet_id),
    FOREIGN KEY (user_id) REFERENCES User(user_id)
);

-- Create Like Table
CREATE TABLE IF NOT EXISTS Like (
    like_id INTEGER PRIMARY KEY AUTOINCREMENT,
    tweet_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    date_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tweet_id) REFERENCES Tweet(tweet_id),
    FOREIGN KEY (user_id) REFERENCES User(user_id)
);


