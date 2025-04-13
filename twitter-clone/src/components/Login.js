import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import "../styles/Login.css";

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = async () => {
    setError("");
  
    try {
      const response = await fetch("http://localhost:3000/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include", // Ensures cookies are sent
        body: JSON.stringify({ username, password }),
      });
  
      console.log("Response status:", response.status);
      console.log("Response headers:", response.headers);
  
      const text = await response.text();
      console.log("Raw response text:", text);
  
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error("Invalid JSON response from server.");
      }
  
      if (response.ok) {
        console.log("Login successful, redirecting...");
        navigate("/home"); // Redirect on success
      } else {
        setError(data.error || "Login failed");
      }
    } catch (error) {
      console.error("Login error:", error.message);
      setError("Server error. Please try again later.");
    }
  };
  

  return (
    <div className="login-page">
      <div className="login-container">
        <h2 className="login-title">Login</h2>

        {error && <p className="error-text">{error}</p>} {/* Show error if exists */}

        <div className="input-group">
          <label>Username</label>
          <input
            type="text"
            placeholder="Enter your username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>

        <div className="input-group">
          <label>Password</label>
          <div className="password-wrapper">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {password && (
              <span
                className="eye-icon"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </span>
            )}
          </div>
        </div>

        <button className="login-button" onClick={handleLogin}>
          Login
        </button>

        <p className="signup-text">
          Don't have an account? <Link to="/signup">Sign up</Link>
        </p>
      </div>
    </div>
  );
};

export default Login;


