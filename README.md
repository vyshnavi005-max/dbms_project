# Twitter Clone

A full-stack Twitter clone built with React, Node.js, and SQLite. While the backend API is fully functional, the UI is currently in development and may not reflect the final design.

## Features

### Backend API (Fully Functional)
- Complete RESTful API implementation
- All endpoints are working and tested
- Secure authentication system with JWT
- Real-time data handling
- Comprehensive error handling

### Frontend (In Development)
- Basic UI implementation
- Core functionality available
- UI improvements and styling ongoing
- Mobile responsiveness needs enhancement
- Dark theme implementation in progress

### User Authentication
- Secure user registration and login
- JWT-based authentication
- Protected routes and endpoints
- Session management

### Tweet Management
- Create and delete tweets
- View tweet feed
- Like and unlike tweets
- Reply to tweets
- View tweet details with likes and replies

### Social Features
- Follow/unfollow users
- View followers and following lists
- User suggestions
- Profile management
- Real-time notifications for:
  - New followers
  - Tweet likes
  - Tweet replies

### UI/UX (Work in Progress)
- Basic dark theme implementation
- Responsive layout needs improvement
- Real-time updates functional
- Loading states implemented
- Animations and transitions in development

## Tech Stack

### Frontend (In Development)
- **React.js**: Core functionality implemented
- **CSS**: Basic styling, needs enhancement
- **React Router**: Navigation implemented
- **Context API**: State management working

### Backend (Fully Functional)
- **Node.js**: Runtime environment
- **Express.js**: Web framework
- **SQLite**: Database
- **JWT**: Authentication with secure token
- **bcrypt**: Password hashing

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Git

### Installation

1. Clone the repository:
```bash
git clone https://github.com/vyshnavi005-max/dbms_project.git
cd dbms_project
```

2. Install backend dependencies:
```bash
npm install
```

3. Install frontend dependencies:
```bash
cd twitter-clone
npm install
```

4. Set up environment variables:
Create a `.env` file in the backend directory with:
```env
PORT=3000
JWT_SECRET=MY_SECRET_TOKEN
DATABASE_PATH=./database/twitterClone.db
NODE_ENV=development
```

5. Start the development servers:
```bash
# Start backend server (default port: 3000)
npm start

# Start frontend server (default port: 3001)
cd twitter-clone
npm start
```

6. Open [http://localhost:3001](http://localhost:3001) to view the app in your browser.

## Environment Variables

### Backend (.env)
- `PORT`: Server port (default: 3000)
- `JWT_SECRET`: Secret key for JWT token (required)
- `DATABASE_PATH`: Path to SQLite database file
- `NODE_ENV`: Environment (development/production)

### Security Notes
- Never commit `.env` file to version control
- Keep JWT_SECRET secure and unique
- Use different secrets for development and production
- Database file is excluded from version control

## API Endpoints

### Authentication
- `POST /register` - Register a new user
  - Body: `{ username, password, name, gender }`
  - Response: Success message or error
- `POST /login` - User login
  - Body: `{ username, password }`
  - Response: JWT token and success message
- `GET /profile` - Get user profile
  - Headers: Authorization token
  - Response: User details, followers count, following count

### Tweets
- `GET /user/tweets/feed` - Get user's tweet feed
  - Headers: Authorization token
  - Response: Array of tweets from followed users
- `POST /user/tweets` - Create a new tweet
  - Headers: Authorization token
  - Body: `{ tweet }`
  - Response: Created tweet details
- `DELETE /tweets/:tweetId` - Delete a tweet
  - Headers: Authorization token
  - Response: Success message
- `GET /tweets/:tweetId` - Get tweet details
  - Headers: Authorization token
  - Response: Tweet details with likes and replies count
- `GET /user/tweets` - Get user's own tweets
  - Headers: Authorization token
  - Response: Array of user's tweets

### Tweet Interactions
- `POST /tweets/:tweetId/like` - Like/unlike a tweet
  - Headers: Authorization token
  - Response: Updated likes count and list
- `GET /tweets/:tweetId/likes` - Get tweet likes
  - Headers: Authorization token
  - Response: Array of users who liked the tweet
- `POST /tweets/:tweetId/reply` - Reply to a tweet
  - Headers: Authorization token
  - Body: `{ replyText }`
  - Response: Created reply details
- `GET /tweets/:tweetId/replies` - Get tweet replies
  - Headers: Authorization token
  - Response: Array of replies
- `GET /user/tweets/replies` - Get replies to user's tweets
  - Headers: Authorization token
  - Response: Array of replies
- `GET /user/tweets/likes` - Get likes on user's tweets
  - Headers: Authorization token
  - Response: Array of likes

### Social Features
- `POST /follow/:userId` - Follow a user
  - Headers: Authorization token
  - Response: Success message
- `POST /unfollow/:userId` - Unfollow a user
  - Headers: Authorization token
  - Response: Success message
- `GET /user/followers` - Get user's followers
  - Headers: Authorization token
  - Response: Array of followers
- `GET /user/following` - Get users being followed
  - Headers: Authorization token
  - Response: Array of following users
- `GET /suggestions` - Get user suggestions
  - Headers: Authorization token
  - Response: Array of suggested users to follow
- `GET /following` - Get following list
  - Headers: Authorization token
  - Response: Array of following users with details
- `GET /followers` - Get followers list
  - Headers: Authorization token
  - Response: Array of followers with details

### Notifications
- `GET /notifications` - Get user notifications
  - Headers: Authorization token
  - Response: Array of notifications
- `POST /notifications/:id/read` - Mark notification as read
  - Headers: Authorization token
  - Response: Success message

### Error Responses
All endpoints may return the following error responses:
- `400 Bad Request` - Invalid input data
- `401 Unauthorized` - Invalid or missing authentication token
- `403 Forbidden` - User not authorized to perform action
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server error

## Project Structure

```
dbms_project/
├── twitter-clone/          # Frontend source code
│   ├── src/               # React components
│   ├── public/            # Static files
│   └── package.json       # Frontend dependencies
├── backend/               # Backend source code
│   ├── app.js            # Express server
│   ├── index.js          # Server entry point
│   ├── .env              # Environment variables
│   └── database/         # Database files
├── .gitignore            # Git ignore rules
└── README.md            # Project documentation
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Twitter for inspiration
- React and Node.js communities
- All contributors to this project

## Deployment

### Backend Deployment (Node.js)

1. **Prepare your backend**:
   ```bash
   # Install production dependencies
   npm install --production
   
   # Create a production build
   npm run build
   ```

2. **Choose a hosting platform**:
   - **Heroku** (Recommended for beginners):
     ```bash
     # Install Heroku CLI
     npm install -g heroku
     
     # Login to Heroku
     heroku login
     
     # Create a new Heroku app
     heroku create your-app-name
     
     # Set environment variables
     heroku config:set JWT_SECRET=your_secret
     heroku config:set NODE_ENV=production
     
     # Deploy
     git push heroku main
     ```

   - **Render.com** (Free tier available):
     - Create a new Web Service
     - Connect your GitHub repository
     - Set environment variables
     - Deploy automatically

   - **Railway.app** (Free tier available):
     - Connect your GitHub repository
     - Set environment variables
     - Deploy automatically

### Frontend Deployment (React)

1. **Prepare your frontend**:
   ```bash
   # Install production dependencies
   cd twitter-clone
   npm install --production
   
   # Create a production build
   npm run build
   ```

2. **Choose a hosting platform**:
   - **Vercel** (Recommended for React apps):
     - Install Vercel CLI: `npm install -g vercel`
     - Run `vercel` in your frontend directory
     - Follow the prompts to deploy

   - **Netlify**:
     - Connect your GitHub repository
     - Set build command: `npm run build`
     - Set publish directory: `build`
     - Deploy automatically

   - **GitHub Pages**:
     - Add `homepage` field to package.json
     - Install gh-pages: `npm install --save gh-pages`
     - Add deploy script to package.json
     - Run `npm run deploy`

### Database (SQLite)

For production, consider migrating to:
- **PostgreSQL** (Recommended for production)
- **MongoDB Atlas** (Free tier available)
- **Railway PostgreSQL** (Free tier available)

### Environment Variables

Update your environment variables for production:
```env
PORT=process.env.PORT
JWT_SECRET=your_production_secret
DATABASE_URL=your_production_database_url
NODE_ENV=production
```

### CORS Configuration

Update your backend CORS settings for production:
```javascript
app.use(cors({
    origin: "https://your-frontend-domain.com",
    credentials: true,
}));
```

### SSL/HTTPS

Ensure your production environment uses HTTPS:
- Most hosting platforms provide SSL certificates
- Update API endpoints to use HTTPS
- Update frontend API calls to use HTTPS

### Monitoring

Set up monitoring for your production app:
- Add error logging
- Set up uptime monitoring
- Configure alerts for errors

### Backup

Regularly backup your database:
- Set up automated backups
- Store backups securely
- Test restore procedures