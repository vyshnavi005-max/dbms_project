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
import { API_URL } from "../utils/api";

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
        setLoading(true);
        setError("");
        
        // Fetch one at a time to better handle errors
        let tweetsData = [];
        let followersData = [];
        let followingData = [];
        let profileData = { name: "", username: "" };
        
        try {
          console.log("Fetching profile data");
          const profileRes = await fetch(`${API_URL}/profile`, {
            credentials: "include",
            headers: { "Content-Type": "application/json" }
          });
          
          if (!profileRes.ok) {
            const errorText = await profileRes.text();
            console.error("Profile fetch error:", errorText);
            throw new Error(`Profile error: ${profileRes.status}`);
          }
          
          profileData = await profileRes.json();
          setUserDetails(profileData);
          console.log("Profile data loaded successfully");
        } catch (err) {
          console.error("Profile fetch failed:", err);
          setError(`Failed to load profile: ${err.message}`);
        }
        
        try {
          console.log("Fetching tweets");
          const tweetsRes = await fetch(`${API_URL}/user/tweets/`, {
            credentials: "include",
            headers: { "Content-Type": "application/json" }
          });
          
          if (!tweetsRes.ok) {
            const errorText = await tweetsRes.text();
            console.error("Tweets fetch error:", errorText);
            throw new Error(`Tweets error: ${tweetsRes.status}`);
          }
          
          tweetsData = await tweetsRes.json();
          setTweets(Array.isArray(tweetsData) ? tweetsData : []);
          console.log("Tweets loaded successfully");
        } catch (err) {
          console.error("Tweets fetch failed:", err);
          // Don't override profile error if it exists
          if (!error) setError(`Failed to load tweets: ${err.message}`);
        }
        
        try {
          console.log("Fetching followers");
          const followersRes = await fetch(`${API_URL}/user/followers/`, {
            credentials: "include",
            headers: { "Content-Type": "application/json" }
          });
          
          if (!followersRes.ok) {
            const errorText = await followersRes.text();
            console.error("Followers fetch error:", errorText);
            throw new Error(`Followers error: ${followersRes.status}`);
          }
          
          followersData = await followersRes.json();
          setFollowers(Array.isArray(followersData) ? followersData : []);
          console.log("Followers loaded successfully");
        } catch (err) {
          console.error("Followers fetch failed:", err);
          // Don't override existing errors
          if (!error) setError(`Failed to load followers: ${err.message}`);
        }
        
        try {
          console.log("Fetching following");
          const followingRes = await fetch(`${API_URL}/user/following/`, {
            credentials: "include",
            headers: { "Content-Type": "application/json" }
          });
          
          if (!followingRes.ok) {
            const errorText = await followingRes.text();
            console.error("Following fetch error:", errorText);
            throw new Error(`Following error: ${followingRes.status}`);
          }
          
          followingData = await followingRes.json();
          setFollowing(Array.isArray(followingData) ? followingData : []);
          console.log("Following loaded successfully");
        } catch (err) {
          console.error("Following fetch failed:", err);
          // Don't override existing errors
          if (!error) setError(`Failed to load following: ${err.message}`);
        }
      } catch (err) {
        console.error("Overall fetch error:", err);
        setError(err.message || "Error loading profile data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleLikeTweet = async (tweetId) => {
    try {
      const res = await fetch(
        `${API_URL}/tweets/${tweetId}/like`,
        {
          method: "POST",
          credentials: "include",
        }
      );
      if (!res.ok) throw new Error("Failed to like");

      const updated = await fetch(`${API_URL}/user/tweets/`, {
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
      const res = await fetch(`${API_URL}/tweets/${tweetId}/`, {
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
        const response = await fetch(`${API_URL}/user/tweets`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ tweet: newTweet }),
        });

        if (response.ok) {
          setNewTweet("");
          const res = await fetch(`${API_URL}/user/tweets/`, {
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
