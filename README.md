# 📚 Book Bank Management System

A full-stack academic library management system built with **Node.js**, **Express**, **MongoDB**, and **vanilla HTML/CSS/JavaScript**.

## ✨ Features

- **JWT Authentication** with bcrypt password hashing
- **Role-based dashboards** — Student & Librarian
- **Book CRUD** — Add, edit, delete, search books
- **Issue & Return workflow** with due date tracking
- **Elegant academic UI** — glassmorphism, soft shadows, smooth animations
- **Responsive design** — works on desktop, tablet, and mobile

## 🏗 Tech Stack

| Layer    | Technology                          |
|----------|-------------------------------------|
| Frontend | HTML5, CSS3, Vanilla JavaScript     |
| Backend  | Node.js, Express.js                 |
| Database | MongoDB, Mongoose                   |
| Auth     | JWT, bcryptjs                       |

## 📁 Project Structure

```
OOSE project/
├── backend/
│   ├── server.js              # Express server + MongoDB connection
│   ├── package.json           # Dependencies
│   ├── .env                   # Environment variables
│   ├── models/
│   │   ├── User.js            # User schema (bcrypt hashing)
│   │   └── Book.js            # Book schema
│   ├── routes/
│   │   ├── authRoutes.js      # POST /register, /login
│   │   └── bookRoutes.js      # CRUD + issue/return
│   └── middleware/
│       └── authMiddleware.js  # JWT verify + role guard
├── frontend/
│   ├── index.html             # Login & Register page
│   ├── student.html           # Student dashboard
│   ├── librarian.html         # Librarian dashboard
│   ├── style.css              # Complete design system
│   └── script.js              # All frontend logic
└── README.md
```

## 🚀 Setup Instructions

### Prerequisites
- **Node.js** v16+ — [Download](https://nodejs.org/)
- **MongoDB** — [Download](https://www.mongodb.com/try/download/community) or use [MongoDB Atlas](https://www.mongodb.com/atlas)

### Step 1 — Install Dependencies
```bash
cd backend
npm install
```

### Step 2 — Configure Environment
Edit `backend/.env`:
```
PORT=5000
MONGO_URI=mongodb://localhost:27017/bookbank
JWT_SECRET=your_secure_secret_key_here
```
> For MongoDB Atlas, replace `MONGO_URI` with your Atlas connection string.

### Step 3 — Start MongoDB
```bash
# If using local MongoDB:
mongod
```

### Step 4 — Start the Server
```bash
cd backend
npm run dev    # Development (auto-reload)
# or
npm start      # Production
```

### Step 5 — Open in Browser
Navigate to **http://localhost:5000**

## 📡 API Reference

### Authentication
| Method | Route              | Description           | Auth |
|--------|--------------------|-----------------------|------|
| POST   | `/api/auth/register` | Register a new user  | No   |
| POST   | `/api/auth/login`    | Login & get JWT      | No   |

### Books
| Method | Route                  | Description              | Auth        |
|--------|------------------------|--------------------------|-------------|
| GET    | `/api/books`           | List / search books      | Required    |
| POST   | `/api/books`           | Add a book               | Librarian   |
| PUT    | `/api/books/:id`       | Update a book            | Librarian   |
| DELETE | `/api/books/:id`       | Delete a book            | Librarian   |
| POST   | `/api/books/issue-book`  | Issue book to student  | Librarian   |
| POST   | `/api/books/return-book` | Return a book          | Librarian   |
| GET    | `/api/books/my-books`  | Student's borrowed books | Required    |
| GET    | `/api/books/students`  | List all students        | Librarian   |

### Example API Test (using curl)

```bash
# Register a librarian
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Admin","userId":"admin01","password":"admin123","role":"librarian","department":"Library"}'

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"userId":"admin01","password":"admin123"}'

# Add a book (use token from login response)
curl -X POST http://localhost:5000/api/books \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"title":"Clean Code","author":"Robert C. Martin","isbn":"978-0132350884","quantity":3}'
```

## 👤 Default User Roles

| Role      | Access                                            |
|-----------|---------------------------------------------------|
| Student   | Search books, view issued books, see due dates    |
| Librarian | Full CRUD, issue/return books, view all students  |

## 📝 License

This is an academic project for Object-Oriented Software Engineering coursework.
