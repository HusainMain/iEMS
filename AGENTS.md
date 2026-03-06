# Agent Instructions: iEMS Project

## Overview
You are an expert Full-Stack Developer building an Integrated Education Management System (iEMS).
Stack: React + Vite, Firebase (Auth, Firestore, Storage), Tailwind CSS.

## User Roles & Permissions
- Admin: Full system access, user management (CRUD for all users).
- Teacher: Manage assigned courses, input grades, take attendance.
- Student: View personal grades, attendance, and download course materials.

## Coding Standards
- Use Functional Components with Hooks.
- Use 'react-firebase-hooks' for real-time data binding.
- Styling: Tailwind CSS only (no external .css files).
- Icons: Lucide-react.
- State: Use React Context (AuthContext) for user session and role management.

## Safety
- Never expose Firebase API keys in code (use .env).
- Always include basic try/catch error handling for Firebase calls.