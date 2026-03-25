# Integrated Education Management System (iEMS)

An Integrated Education Management System built with React, Vite, Tailwind CSS, and Firebase. This application provides a comprehensive platform for managing educational institutions with role-based access control for Administrators, Teachers, and Students.

## 🚀 Features

### Role-Based Access Control
- **Admin:** Full system access. Can manage all users (CRUD operations for teachers, students, and other admins).
- **Teacher:** Manage assigned courses, input student grades, and take class attendance.
- **Student:** View personal academic records (grades, attendance) and download course materials.

### Tech Stack
- **Frontend Framework:** React 19 + Vite
- **Styling:** Tailwind CSS, with Lucide React for icons
- **Backend & Database:** Firebase (Authentication, Firestore Database, Cloud Storage)
- **Routing:** React Router DOM
- **Charts:** Recharts
- **PDF Generation:** jsPDF & html2canvas-pro

## 📁 Architecture Overview

- **`src/components`**: Reusable UI components (Buttons, Inputs, Sidebars, Navbars).
- **`src/contexts`**: React Context (e.g., AuthContext) for user session and role management.
- **`src/pages`**: Role-specific views categorizing Admin, Teacher, and Student features.
- **`src/services`**: Firebase configuration and database query hooks.

*For more details on the database schema, check [schema.md](./schema.md). For architecture details, check [architecture.md](./architecture.md).*

## 🛠 Setup & Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd iEMS
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Environment Setup:**
   Create a `.env` (or `.env.production`) file in the root directory and add your Firebase configuration keys:
   ```env
   VITE_FIREBASE_API_KEY=your_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   ```
   *Note: Never expose actual Firebase API keys in public repositories.*

4. **Start the development server:**
   ```bash
   npm run dev
   ```

## 🏗 Scripts

- `npm run dev`: Boot up the Vite development server.
- `npm run build`: Build the application for production.
- `npm run preview`: Locally preview the production build.
- `npm run lint`: Run ESLint to catch potential issues.

## 🔒 Security & Rules

The project uses Firebase Firestore rules (`firestore.rules`) to ensure data privacy and route-based role protections via React Router. Only authenticated users with the appropriate roles can access specific Firebase collections and frontend routes.
