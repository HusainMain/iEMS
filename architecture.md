# Project Architecture

## Folder Structure
- `/src/components`: UI components (Button, Input, Sidebar, Navbar).
- `/src/context`: AuthContext.jsx (Role-based access logic).
- `/src/pages`: 
    - `/Admin`: Dashboard, UserManagement.
    - `/Teacher`: ClassView, GradeEntry.
    - `/Student`: MyGrades, Schedule.
- `/src/services`: firebase.js (config), db.js (Firestore queries).
- `/src/hooks`: Custom hooks for data fetching.

## Navigation Logic
- Login Page -> Role Check -> Dashboard (Admin/Teacher/Student).
- Use `react-router-dom` for protected routes based on the user's 'role' field in Firestore.