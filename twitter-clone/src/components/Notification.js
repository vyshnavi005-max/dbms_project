import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FaHeart,FaReply,FaBars,FaTimes,FaHome,FaUser,FaBell,FaSignOutAlt,} from "react-icons/fa";
import "../styles/Notification.css";

const Notifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const response = await fetch(`${process.env.REACT_APP_API_URL}/notifications/`, {
          credentials: "include",
        });
        const data = await response.json();
        setNotifications(data);
      } catch (error) {
        console.error("Error fetching notifications:", error);
      }
    };

    fetchNotifications();
  }, []);

  const handleLikeNotification = async (tweetId) => {
    try {
      await fetch(`${process.env.REACT_APP_API_URL}/tweets/${tweetId}/like`, {
        method: "POST",
        credentials: "include",
      });
      alert("Tweet liked!");
    } catch (error) {
      console.error("Error liking tweet:", error);
    }
  };

  const handleReplyNotification = async (tweetId) => {
    const replyText = prompt("Enter your reply:");
    if (!replyText?.trim()) return;

    try {
      await fetch(`${process.env.REACT_APP_API_URL}/tweets/${tweetId}/reply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ replyText }),
      });
      alert("Reply sent!");
    } catch (error) {
      console.error("Error replying to tweet:", error);
    }
  };

  return (
        <div className="home-container">
      {/* Navbar */}
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
      {/* Notifications */}
      <div className="notifications-container">
        <h2>Notifications</h2>
        {notifications.length === 0 ? (
          <p>No notifications yet</p>
        ) : (
          notifications.map((notif) => (
            <div key={notif.id} className="notification">
              <p>{notif.message}</p>
              <small>{new Date(notif.created_at).toLocaleString()}</small>

              {(notif.type === "like" || notif.type === "reply") &&
                notif.tweet_id && (
                  <div className="notification-actions">
                    {notif.type === "like" && (
                      <button
                        onClick={() => handleLikeNotification(notif.tweet_id)}
                        className="like-button"
                      >
                        <FaHeart />
                      </button>
                    )}
                    {notif.type === "reply" && (
                      <button
                        onClick={() =>
                          handleReplyNotification(notif.tweet_id)
                        }
                        className="reply-button"
                      >
                        <FaReply />
                      </button>
                    )}
                  </div>
                )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Notifications;
