import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/SuggestionsSidebar.css';
import { API_URL } from "../utils/api";

const SuggestionsSidebar = () => {
    const [suggestions, setSuggestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchSuggestions();
    }, []);

    const fetchSuggestions = async () => {
        try {
            setLoading(true);
            const response = await axios.get(`${API_URL}/suggestions`, {
                withCredentials: true,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            if (response.data) {
                setSuggestions(response.data);
                setError(null);
            } else {
                setError('No suggestions available');
            }
        } catch (error) {
            console.error('Error fetching suggestions:', error);
            if (error.response && error.response.status === 401) {
                setError('Please log in to see suggestions');
            } else {
                setError('Failed to load suggestions');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleFollow = async (userId) => {
        try {
            await axios.post(`${API_URL}/follow/${userId}`, {}, {
                withCredentials: true,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            // Filter out the followed user from suggestions
            setSuggestions(prev => prev.filter(user => user.user_id !== userId));
        } catch (error) {
            console.error('Error following user:', error);
            if (error.response && error.response.status === 401) {
                setError('Please log in to follow users');
            }
        }
    };

    if (loading) {
        return (
            <div className="suggestions-sidebar loading">
                <div className="loading-spinner"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="suggestions-sidebar">
                <h3>Who to follow</h3>
                <p className="error-text">{error}</p>
            </div>
        );
    }

    if (suggestions.length === 0) {
        return (
            <div className="suggestions-sidebar empty">
                <h3>Who to follow</h3>
                <p>No suggestions available at the moment</p>
            </div>
        );
    }

    return (
        <div className="suggestions-sidebar">
            <h3>Who to follow</h3>
            {suggestions.map((user) => (
                <div key={user.user_id} className="suggestion-item">
                    <div className="user-info">
                        <span className="username">@{user.username}</span>
                        <span className="name">{user.name}</span>
                    </div>
                    <button 
                        className="follow-button"
                        onClick={() => handleFollow(user.user_id)}
                    >
                        Follow
                    </button>
                </div>
            ))}
        </div>
    );
};

export default SuggestionsSidebar; 