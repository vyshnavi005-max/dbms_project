import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaHeart,
  FaReply,
  FaBars,
  FaTimes,
  FaHome,
  FaUser,
  FaBell,
  FaSignOutAlt,
  FaUsers
} from "react-icons/fa";
import "../styles/Home.css";
import SuggestionsSidebar from "./SuggestionsSidebar";
import { API_URL } from "../utils/api";

function Home() {
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [error, setError] = useState("");
  const [likes, setLikes] = useState({});
  const [likedByUser, setLikedByUser] = useState({});
  const [visibleLikes, setVisibleLikes] = useState({});
  const [replies, setReplies] = useState({});
  const [visibleReplies, setVisibleReplies] = useState({});
  const [replyInputs, setReplyInputs] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    const fetchFeed = async () => {
      try {
        const response = await fetch(`${API_URL}/user/tweets/feed/`, {
          method: "GET",
          credentials: "include",
        });
        if (!response.ok) throw new Error("Failed to fetch feed");

        const data = await response.json();
        setFeed(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchFeed();
  }, []);

  const handleLike = async (tweetId) => {
    try {
      const response = await fetch(`${API_URL}/tweets/${tweetId}/like`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to toggle like");

      const data = await response.json();

      setLikedByUser((prev) => {
        const newState = { ...prev };
        if (data.message === "Tweet liked successfully") {
          newState[tweetId] = true;
        } else if (data.message === "Tweet unliked successfully") {
          newState[tweetId] = false;
        }
        return newState;
      });

      setLikes((prev) => ({
        ...prev,
        [tweetId]: data.likes,
      }));
    } catch (err) {
      alert(err.message);
    }
  };

  const toggleLikes = async (tweetId) => {
    const isVisible = visibleLikes[tweetId];
    setVisibleLikes((prev) => ({ ...prev, [tweetId]: !isVisible }));

    if (!isVisible) {
      try {
        const response = await fetch(`${API_URL}/tweets/${tweetId}/likes/`, {
          method: "GET",
          credentials: "include",
        });
        if (!response.ok) throw new Error("Failed to fetch likes");

        const data = await response.json();
        console.log("Likes data:", data);
        setLikes((prev) => ({ ...prev, [tweetId]: data.likes }));
      } catch (err) {
        alert(err.message);
      }
    }
  };

  const toggleReplies = async (tweetId) => {
    const isVisible = visibleReplies[tweetId];
    setVisibleReplies((prev) => ({ ...prev, [tweetId]: !isVisible }));

    if (!isVisible) {
      try {
        const response = await fetch(`${API_URL}/tweets/${tweetId}/replies/`, {
          method: "GET",
          credentials: "include",
        });
        if (!response.ok) throw new Error("Failed to fetch replies");

        const data = await response.json();
        console.log("Replies data:", data);
        setReplies((prev) => ({ ...prev, [tweetId]: data.replies }));
      } catch (err) {
        alert(err.message);
      }
    }
  };

  const handleReplyChange = (tweetId, text) => {
    setReplyInputs((prev) => ({ ...prev, [tweetId]: text }));
  };

  const handleReplySubmit = async (tweetId) => {
    const replyText = replyInputs[tweetId];
    if (!replyText) return alert("Reply cannot be empty!");

    try {
      const response = await fetch(`${API_URL}/tweets/${tweetId}/reply`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ replyText }),
      });

      if (!response.ok) throw new Error("Failed to send reply");

      alert("Reply posted!");
      setReplyInputs((prev) => ({ ...prev, [tweetId]: "" }));
      toggleReplies(tweetId); // Refresh replies after posting
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="home-container">
      <div className="navbar">
              <h1 className="logo">Basic Twitter Clone</h1>
              <div className="hamburger" onClick={() => setMenuOpen(!menuOpen)}>
                {menuOpen ? <FaTimes /> : <FaBars />}
              </div>
            </div>
      
            {/* Sidebar */}
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

        <main className="main-content">
          {loading ? (
            <div className="loading">Loading tweets...</div>
          ) : error ? (
            <div className="error">{error}</div>
          ) : (
            <div className="feed-container">
              <div className="tweets-container">
                {feed.length === 0 ? (
                  <div className="no-tweets">No tweets to display</div>
                ) : (
                  feed.map((tweet) => (
                    <div key={tweet.tweetId} className="tweet-card">
                      <div className="tweet-header">
                        <div className="tweet-user-info">
                          <h4 className="tweet-username">@{tweet.username}</h4>
                          <small className="tweet-time">
                            {new Date(tweet.dateTime).toLocaleString()}
                          </small>
                        </div>
                      </div>
                      <p className="tweet-content">{tweet.tweet}</p>
                      <div className="tweet-actions">
                        <button 
                          className={`action-button ${likedByUser[tweet.tweetId] ? 'liked' : ''}`}
                          onClick={() => handleLike(tweet.tweetId)}
                        >
                          <FaHeart />
                          <span>Like</span>
                        </button>
                        <button 
                          className={`action-button ${visibleLikes[tweet.tweetId] ? 'active' : ''}`}
                          onClick={() => toggleLikes(tweet.tweetId)}
                        >
                          <FaUsers />
                          <span>Likes</span>
                        </button>
                        <button 
                          className={`action-button ${visibleReplies[tweet.tweetId] ? 'active' : ''}`}
                          onClick={() => toggleReplies(tweet.tweetId)}
                        >
                          <FaReply />
                          <span>Reply</span>
                        </button>
                      </div>

                      {visibleLikes[tweet.tweetId] && (
                        <div className="likes-section">
                          <h4>Liked by</h4>
                          {likes[tweet.tweetId]?.length > 0 ? (
                            <ul className="likes-list">
                              {likes[tweet.tweetId].map((like, index) => (
                                <li key={index} className="like-item">
                                  <div className="like-user-avatar">
                                    {like && typeof like === 'string' ? like.charAt(0).toUpperCase() : '?'}
                                  </div>
                                  <span className="like-username">@{like || 'unknown'}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="no-likes">No likes yet</p>
                          )}
                        </div>
                      )}

                      {visibleReplies[tweet.tweetId] && (
                        <div className="replies-section">
                          <h4>Replies</h4>
                          {replies[tweet.tweetId]?.length > 0 ? (
                            <ul className="replies-list">
                              {replies[tweet.tweetId].map((reply, index) => (
                                <li key={index}>
                                  <strong>{reply.name}:</strong> {reply.reply}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="no-replies">No replies yet</p>
                          )}
                          <div className="reply-input">
                            <input
                              type="text"
                              placeholder="Write a reply..."
                              value={replyInputs[tweet.tweetId] || ""}
                              onChange={(e) => handleReplyChange(tweet.tweetId, e.target.value)}
                            />
                            <button onClick={() => handleReplySubmit(tweet.tweetId)}>
                              Reply
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </main>

        <aside className="right-sidebar">
          <SuggestionsSidebar />
        </aside>
      </div>
  );
}

export default Home;



