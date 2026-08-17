# AiCare Health Assistant - Local Setup Guide

Follow these steps to run the professional AI Health Assistant on your local machine using Visual Studio Code.

## 1. Prerequisites
- **Node.js** (v18 or higher recommended)
- **Firebase Project**: A Firebase project with Firestore and Authentication (Google) enabled.
- **Gemini API Key**: Use your API key from [Google AI Studio](https://aistudio.google.com/app/apikey).

## 2. Environment Setup
1. Open the project in Visual Studio Code.
2. Create a file named **.env** (exactly like that) in the root directory.
3. Add your Gemini API key:
```env
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
```
*Note: Make sure there are no spaces around the `=` sign. The app is configured to handle this key in the frontend for you.*

## 3. Firebase Configuration
Ensure the `firebase-applet-config.json` file in the root directory contains your Firebase web app configuration. It should look like this:
```json
{
  "apiKey": "...",
  "authDomain": "...",
  "projectId": "...",
  "storageBucket": "...",
  "messagingSenderId": "...",
  "appId": "...",
  "firestoreDatabaseId": "(default)"
}
```
**Important**: Add `http://localhost:3000` to the **Authorized Domains** in your Firebase Console (Authentication > Settings > Authorized Domains).

## 4. Installation
Open the integrated terminal in VS Code (Ctrl+` or Cmd+`) and run:
```bash
npm install
```

## 5. Running the Application
To start the application:
```bash
npm run dev
```
The app will be available at `http://localhost:3000`.

## 6. Project Features
- **AI Chat**: Powered by Gemini 3 Flash. Works even without login!
- **Lab Analysis**: Upload images of blood tests for instant insights.
- **Role-Based Dashboards**:
  - **Client**: Upload labs, view trends, and chat with AI.
  - **Doctor**: Search patients, review results, and receive critical alerts.
  - **Admin**: System-wide user management and analytics.
- **Secure Auth**: Sign in with Google to save history. Roles are assigned automatically.
- **Real-time DB**: Powered by Firestore with hardened security rules.

## Roles Management
- By default, new users are assigned the **Client** role.
- To test the **Admin** role, log in with `sami478779@gmail.com`.
- **Doctor** roles can be assigned by an Admin in the Admin Dashboard.
