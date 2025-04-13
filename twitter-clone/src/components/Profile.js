import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Tweet from "./Tweet";
import {
  FaBars,
  FaTimes,
  FaHome,
  FaUser,
  FaBell,
  FaSignOutAlt,
} from "react-icons/fa";
import "../styles/Profile.css";

const Profile = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [tweets, setTweets] = useState([]);
  const [userDetails, setUserDetails] = useState({ name: "", username: "" });
  const [newTweet, setNewTweet] = useState("");
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [showFollowers, setShowFollowers] = useState(false);
  const [showFollowing, setShowFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [tweetsRes, followersRes, followingRes, profileRes] =
          await Promise.all([
            fetch("http://localhost:3000/user/tweets/", {
              credentials: "include",
            }),
            fetch("http://localhost:3000/user/followers/", {
              credentials: "include",
            }),
            fetch("http://localhost:3000/user/following/", {
              credentials: "include",
            }),
            fetch("http://localhost:3000/profile", {
              credentials: "include",
            }),
          ]);

        if (
          !tweetsRes.ok ||
          !followersRes.ok ||
          !followingRes.ok ||
          !profileRes.ok
        ) {
          throw new Error("Something went wrong");
        }

        const tweetsData = await tweetsRes.json();
        const followersData = await followersRes.json();
        const followingData = await followingRes.json();
        const profileData = await profileRes.json();

        setTweets(tweetsData);
        setFollowers(followersData);
        setFollowing(followingData);
        setUserDetails(profileData);
      } catch (err) {
        console.error("Fetch Error:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleLikeTweet = async (tweetId) => {
    try {
      const res = await fetch(
        `http://localhost:3000/tweets/${tweetId}/like`,
        {
          method: "POST",
          credentials: "include",
        }
      );
      if (!res.ok) throw new Error("Failed to like");

      const updated = await fetch("http://localhost:3000/user/tweets/", {
        credentials: "include",
      });
      const updatedTweets = await updated.json();
      setTweets(updatedTweets);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteTweet = async (tweetId) => {
    try {
      const res = await fetch(`http://localhost:3000/tweets/${tweetId}/`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        setTweets((prev) => prev.filter((t) => t.tweetId !== tweetId));
      } else {
        throw new Error("Delete failed");
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleTweet = async () => {
    if (newTweet.trim()) {
      try {
        const response = await fetch("http://localhost:3000/user/tweets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ tweet: newTweet }),
        });

        if (response.ok) {
          setNewTweet("");
          const res = await fetch("http://localhost:3000/user/tweets/", {
            credentials: "include",
          });
          const updatedTweets = await res.json();
          setTweets(updatedTweets);
        } else {
          throw new Error("Tweet failed");
        }
      } catch (err) {
        setError(err.message);
      }
    }
  };

  return (
    <div className="profile-container">
      <div className="navbar">
        <h1 className="logo">Basic Twitter Clone</h1>
        <div className="hamburger" onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <FaTimes /> : <FaBars />}
        </div>
      </div>

      <div className={`sidebar ${menuOpen ? "open" : ""}`}>
        <button onClick={() => navigate("/home")}>
          <FaHome className="icon" /> Home
        </button>
        <button onClick={() => navigate("/profile")}>
          <FaUser className="icon" /> Profile
        </button>
        <button onClick={() => navigate("/notifications")}>
          <FaBell className="icon" /> Notifications
        </button>
        <button onClick={() => navigate("/")}>
          <FaSignOutAlt className="icon" /> Logout
        </button>
      </div>
      <div className="profile-cont">
      <div className="profile-header">
        <div className="avatar">
          {userDetails.username?.slice(0, 1).toUpperCase()}
        </div>
        <h2>{userDetails.username}</h2>
        <p>{userDetails.name}</p>
      </div>

      <div className="follow-stats">
        <p onClick={() => setShowFollowers(!showFollowers)}>
          Followers: {followers.length}
        </p>
        <p onClick={() => setShowFollowing(!showFollowing)}>
          Following: {following.length}
        </p>
      </div>

      {showFollowers && (
        <div className="follow-section">
          <h3>Followers</h3>
          <ul>{followers.map((f, i) => <li key={i}>{f.name}</li>)}</ul>
        </div>
      )}

      {showFollowing && (
        <div className="follow-section">
          <h3>Following</h3>
          <ul>{following.map((f, i) => <li key={i}>{f.name}</li>)}</ul>
        </div>
      )}

      <div className="tweet-section">
        <textarea
          placeholder="What's happening?"
          value={newTweet}
          onChange={(e) => setNewTweet(e.target.value)}
        />
        <button className="tweet-button" onClick={handleTweet}>
          Tweet
        </button>
      </div>

      {loading && <p>Loading tweets...</p>}
      {error && <p className="error-text">Error: {error}</p>}

      <div className="tweets-list">
        {tweets.map((tweet) => (
          <Tweet
            userDetails={userDetails}
            key={tweet.tweetId}
            tweet={tweet}
            onLike={() => handleLikeTweet(tweet.tweetId)}
            onDelete={handleDeleteTweet}
          />
        ))}
      </div>
    </div>
    </div>
  );
};

export default Profile;
