import React, { useState } from 'react';
import { FaHeart, FaTrash } from 'react-icons/fa';
import '../styles/Tweet.css';

const Tweet = ({ userDetails, tweet, onLike, onDelete }) => {
  const [showOwnLikes, setShowOwnLikes] = useState(false);
  const [showOwnReplies, setShowOwnReplies] = useState(false);
  const [likesList, setLikesList] = useState([]);
  const [repliesList, setRepliesList] = useState([]);

  const { tweetId, tweet: tweetText, likes, replies, dateTime } = tweet || {};
  const formattedDate = new Date(dateTime).toLocaleString();

  const toggleOwnLikes = async () => {
    if (!showOwnLikes) {
      try {
        const res = await fetch(`${process.env.REACT_APP_API_URL}/tweets/${tweetId}/likes`, {
          credentials: 'include',
        });
        const data = await res.json();
        const filteredLikes = data.filter((like) => like.tweetId === tweetId);
        setLikesList(filteredLikes);
      } catch (err) {
        console.error('Failed to fetch likes:', err);
      }
    }
    setShowOwnLikes((prev) => !prev);
  };

  const toggleOwnReplies = async () => {
    if (!showOwnReplies) {
      try {
        const res = await fetch(`${process.env.REACT_APP_API_URL}/tweets/${tweetId}/replies`, {
          credentials: 'include',
        });
        const data = await res.json();
        const filteredReplies = data.filter((reply) => reply.tweetId === tweetId);
        setRepliesList(filteredReplies);
      } catch (err) {
        console.error('Failed to fetch replies:', err);
      }
    }
    setShowOwnReplies((prev) => !prev);
  };

  if (!tweet) return <div>Invalid tweet</div>;

  return (
    <div className="tweet-card">
      <div className="tweet-header">
        <div className="tweet-user-avatar"></div>
        <div className="tweet-user-info">
          <span className="tweet-username">{userDetails.username}</span>
          <span className="tweet-time">{formattedDate}</span>
        </div>
      </div>

      <p className="tweet-text">{tweetText}</p>

      <div className="tweet-actions">
        <button className="like-button" onClick={onLike}>
          <FaHeart className="icon" />
          <span>{likes}</span>
        </button>

        <button onClick={toggleOwnLikes}>
          {showOwnLikes ? 'Hide Likes' : 'Show Likes'}
        </button>

        <button onClick={toggleOwnReplies}>
          {showOwnReplies ? 'Hide Replies' : 'Show Replies'} ({replies})
        </button>

        <button className="delete-button" onClick={() => onDelete(tweetId)}>
          <FaTrash className="icon" />
        </button>
      </div>

      {showOwnLikes && (
        <div className="likes-list">
          <strong>Liked by:</strong>
          <ul className='list'>
            {likesList.length === 0 ? (
              <li>No likes</li>
            ) : (
              likesList.map((like, idx) => <li key={idx}>{like.name}</li>)
            )}
          </ul>
        </div>
      )}

      {showOwnReplies && (
        <div className="replies-list">
          <strong>Replies:</strong>
          <ul className='list'>
            {repliesList.length === 0 ? (
              <li>No replies</li>
            ) : (
              repliesList.map((reply, idx) => (
                <li key={idx}>
                  <strong>{reply.name}</strong>: {reply.reply}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

export default Tweet;
