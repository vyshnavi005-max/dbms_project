// Central configuration for API calls

// Use hardcoded values instead of environment variables
// GitHub Pages has issues with environment variables at runtime
export const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3000'
  : 'https://twitter-clone-backend-534j.onrender.com';

// Helper function for making API requests
export const apiRequest = async (endpoint, options = {}) => {
  const url = `${API_URL}${endpoint}`;
  
  // Set default headers if not provided
  if (!options.headers) {
    options.headers = {
      'Content-Type': 'application/json'
    };
  }
  
  // Include credentials for cookie-based auth
  options.credentials = 'include';
  
  try {
    const response = await fetch(url, options);
    
    // First try to parse as JSON
    const text = await response.text();
    let data;
    
    try {
      data = JSON.parse(text);
    } catch (e) {
      // If response is not JSON, use text
      data = { message: text };
    }
    
    // Return both the response and parsed data
    return { 
      ok: response.ok,
      status: response.status, 
      data 
    };
  } catch (error) {
    return {
      ok: false,
      error: error.message || 'Network error'
    };
  }
}; 