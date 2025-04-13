import React from "react";
import { useNavigate } from "react-router-dom";
import "../styles/Landing.css";

function Landing() {
  const navigate = useNavigate();

  return (
    <div className="landing-container">
      <div className="card">
        <h1>Basic Twitter Clone</h1>
        <p className="tagline" >
          Hey, this is a Twitter-mimic.   
          Welcome to <strong>Our Twitter Clone</strong>. Hope you see.
        </p>
        <div className="buttons">
          <button className="login-btn" onClick={() => navigate("/login")}>Log In</button>
          <button className="signup-btn" onClick={() => navigate("/signup")}>Sign Up</button>
        </div>
      </div>
    </div>
  );
}

export default Landing;
