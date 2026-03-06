# Firestore Database Schema

## Collection: users
- uid (String, PK)
- email (String)
- name (String)
- role (String): "admin" | "teacher" | "student"
- createdAt (Timestamp)

## Collection: courses
- courseId (String, PK)
- title (String)
- teacherId (String, FK -> users.uid)
- studentIds (Array of Strings, FKs -> users.uid)

## Collection: attendance
- attendanceId (String)
- courseId (String)
- date (String/Timestamp)
- presentStudents (Array of Strings, FKs -> users.uid)

## Collection: grades
- gradeId (String)
- studentId (String)
- courseId (String)
- score (Number)
- feedback (String)