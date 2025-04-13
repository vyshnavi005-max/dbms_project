# Twitter Clone

A full-stack Twitter clone built with React, Node.js, and SQLite. This project aims to replicate core Twitter functionality with a modern UI and real-time features.

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

## Getting Started

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/twitter-clone.git
   cd twitter-clone
   ```

2. Install dependencies:
   ```bash
   # Install backend dependencies
   cd backend
   npm install

   # Install frontend dependencies
   cd ../frontend
   npm install
   ```

3. Set up environment variables:
   Create a `.env` file in the backend directory with:
   ```
   PORT=3001
   JWT_SECRET=your_jwt_secret
   DATABASE_URL=./database.sqlite
   ```

4. Start the development servers:
   ```bash
   # Start backend server
   cd backend
   npm start

   # Start frontend server
   cd ../frontend
   npm start
   ```

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
