# Twitter Clone Project

A full-stack Twitter clone with React frontend and Node.js/Express backend.

## Project Structure

- `twitter-clone/` - Frontend React application
- `backend/` - Backend Express API server
- `database/` - Database schemas and scripts

## Technologies Used

- Frontend: React, React Router, CSS
- Backend: Node.js, Express
- Database: PostgreSQL (production), SQLite (development)
- Authentication: JWT (JSON Web Tokens)

## Deployment Guide

### Frontend Deployment (GitHub Pages)

1. Update the API URL in `src/utils/api.js` with your Render backend URL.

2. Install the gh-pages package:
   ```bash
   cd twitter-clone
   npm install gh-pages --save-dev
   ```

3. Add the following to your `package.json`:
   ```json
   "homepage": "https://your-username.github.io/twitter-clone",
   "scripts": {
     "predeploy": "npm run build",
     "deploy": "gh-pages -d build"
   }
   ```

4. Deploy to GitHub Pages:
   ```bash
   npm run deploy
   ```

### Backend Deployment (Render)

1. Create a new Web Service on Render.

2. Connect your GitHub repository.

3. Configure the service with these settings:
   - **Name**: twitter-clone-backend
   - **Root Directory**: backend
   - **Environment**: Node
   - **Build Command**: npm install
   - **Start Command**: node index.js

4. Add environment variables in the Render dashboard:
   - `NODE_ENV`: production
   - `JWT_SECRET`: your-secret-key (use a strong, random string)
   - `DATABASE_URL`: This will be automatically set if you create a PostgreSQL database on Render

5. Create a PostgreSQL database on Render and link it to your service.

## Local Development

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/twitter-clone.git
   ```

2. Install dependencies for both backend and frontend:
   ```bash
   cd backend
   npm install
   cd ../twitter-clone
   npm install
   ```

3. Set up the environment variables:
   Create a `.env` file in the backend directory with:
   ```
   NODE_ENV=development
   JWT_SECRET=your-local-secret-key
   ```

4. Start the backend server:
   ```bash
   cd backend
   npm run dev
   ```

5. Start the frontend development server:
   ```bash
   cd twitter-clone
   npm start
   ```

6. Access the application at http://localhost:3001

## Features

- **User Authentication**
  - Secure login and registration
  - Session management
  - Password hashing

- **Tweet Management**
  - Create, edit, and delete tweets
  - Media attachments
  - Thread support

- **Social Features**
  - Follow/unfollow users
  - Like and retweet posts
  - Reply to tweets
  - Direct messaging

- **Real-time Notifications**
  - Push notifications
  - Email notifications
  - In-app notifications

## Tech Stack

- **Frontend**
  - React.js
  - Redux for state management
  - Material-UI for components
  - Socket.io for real-time features

- **Backend**
  - Node.js
  - Express.js
  - SQLite database
  - JWT authentication

## API Endpoints

- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/tweets` - Get all tweets
- `POST /api/tweets` - Create a new tweet
- `PUT /api/tweets/:id` - Update a tweet
- `DELETE /api/tweets/:id` - Delete a tweet
- `POST /api/tweets/:id/like` - Like a tweet
- `POST /api/tweets/:id/retweet` - Retweet a tweet

## Project Structure

```
twitter-clone/
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── styles/
│   │   └── App.js
│   └── package.json
├── backend/
│   ├── controllers/
│   ├── models/
│   ├── routes/
│   ├── middleware/
│   └── server.js
└── README.md
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Twitter for inspiration
- Open source community for tools and libraries
- Contributors and maintainers
