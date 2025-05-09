# Twitter Clone

A full-stack Twitter clone application with React frontend and Node.js/Express backend, featuring user authentication, tweeting, likes, replies, and user following functionality.

## Features

- **User Authentication**: Secure login and registration system
- **Tweet Feed**: View tweets from followed users
- **Profile Management**: View and edit user profiles
- **Interactions**: Like and reply to tweets
- **Follower System**: Follow/unfollow other users
- **Notifications**: Real-time notifications for likes, replies, and follows
- **Suggestions**: Discover new users to follow

## Pages & Components

### Main Pages
1. **Landing Page** (`Landing.js`)
   - The entry point of the application
   - Simple landing page with links to login and signup

2. **Login Page** (`Login.js`)
   - User authentication form
   - JWT token-based authentication
   - Redirects to Home page upon successful login

3. **Signup Page** (`Signup.js`)
   - New user registration
   - Form validation and error handling
   - Creates user in the database

4. **Home Feed** (`Home.js`)
   - Displays tweets from users you follow
   - Like and reply functionality
   - Shows the suggestions sidebar

5. **Profile Page** (`Profile.js`)
   - User profile information
   - Followers and following lists
   - User's tweets with interactions
   - Tweet creation option

6. **Notifications** (`Notification.js`)
   - Real-time notifications for likes, follows, and replies
   - Chronological order with timestamps
   - Interactive elements to respond to notifications

### Components
1. **Tweet** (`Tweet.js`)
   - Individual tweet display
   - Like, reply, and delete functionality
   - Shows interaction counts

2. **SuggestionsSidebar** (`SuggestionsSidebar.js`)
   - Displays user suggestions to follow
   - Quick follow/unfollow functionality
   - Updates in real-time

## Tech Stack

### Frontend
- React.js
- React Router for navigation
- React Icons for UI elements
- CSS for styling

### Backend
- Node.js with Express
- PostgreSQL database (production)
- SQLite database (development)
- JWT for authentication
- bcrypt for password hashing

## Project Structure

```
twitter-clone/
├── backend/           # Express server and API endpoints
│   ├── app.js         # Main application file
│   ├── database/      # Database schemas and migrations
│   └── index.js       # Server entry point
└── twitter-clone/     # React frontend
    ├── public/        # Static assets
    └── src/
        ├── components/  # React components
        │   ├── Home.js
        │   ├── Profile.js
        │   ├── Tweet.js
        │   ├── Login.js
        │   ├── Signup.js
        │   ├── Notification.js
        │   ├── SuggestionsSidebar.js
        │   └── Landing.js
        ├── styles/      # CSS files
        ├── utils/       # Utility functions
        └── App.js       # Main React component
```

## API Endpoints

### Authentication
- `POST /register` - Register a new user
- `POST /login` - Authenticate a user

### Tweets
- `GET /user/tweets/feed/` - Get tweets from followed users
- `GET /user/tweets/` - Get tweets by the authenticated user
- `POST /user/tweets` - Create a new tweet
- `DELETE /tweets/:tweetId/` - Delete a tweet

### Interactions
- `GET /tweets/:tweetId/likes` - Get users who liked a tweet
- `GET /tweets/:tweetId/likes/` - Get likes with additional metadata
- `POST /tweets/:tweetId/like` - Like/unlike a tweet
- `GET /tweets/:tweetId/replies` - Get replies to a tweet
- `GET /tweets/:tweetId/replies/` - Get replies with additional metadata
- `POST /tweets/:tweetId/reply` - Reply to a tweet

### User
- `GET /profile` - Get authenticated user's profile
- `GET /user/followers/` - Get user's followers
- `GET /user/following/` - Get users the authenticated user follows
- `GET /suggestions` - Get user suggestions to follow
- `POST /follow/:userId` - Follow/unfollow a user

### Notifications
- `GET /notifications/` - Get user notifications

## Setup and Installation

### Prerequisites
- Node.js (v14 or later)
- npm or yarn
- PostgreSQL (for production)

### Backend Setup
1. Navigate to the backend directory:
   ```
   cd backend
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file with the following variables:
   ```
   NODE_ENV=development
   PORT=3000
   JWT_SECRET=your_jwt_secret
   DATABASE_URL=your_postgresql_url (for production)
   ```

4. Start the server:
   ```
   npm start
   ```

### Frontend Setup
1. Navigate to the frontend directory:
   ```
   cd twitter-clone
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file with:
   ```
   REACT_APP_API_URL=http://localhost:3000
   ```

4. Start the development server:
   ```
   npm start
   ```

## Deployment

### Backend Deployment (Render.com)
1. Create a new Web Service on Render
2. Connect your GitHub repository
3. Set the build command to `npm install`
4. Set the start command to `NODE_ENV=production node index.js`
5. Add environment variables in the Render dashboard

### Frontend Deployment (GitHub Pages)
1. Install gh-pages:
   ```
   npm install --save-dev gh-pages
   ```

2. Add to package.json:
   ```json
   "homepage": "https://your-username.github.io/twitter-clone",
   "scripts": {
     "predeploy": "npm run build",
     "deploy": "gh-pages -d build"
   }
   ```

3. Deploy:
   ```
   npm run deploy
   ```

## User Flow

1. **New User**:
   - Lands on Landing page
   - Signs up via Signup page
   - Gets redirected to Home page
   - Sees suggested users to follow
   - Follows users to populate feed

2. **Returning User**:
   - Logs in via Login page
   - Views feed of tweets from followed users
   - Interacts with tweets (likes, replies)
   - Checks notifications
   - Views and updates profile

## Additional Notes

- The application uses different database configurations for development (SQLite) and production (PostgreSQL)
- Frontend makes API calls with credentials to maintain session state
- The backend handles CORS to allow requests from the frontend origin
- API endpoints exist in both forms (with and without trailing slashes) for compatibility

## License

[MIT License](LICENSE)
