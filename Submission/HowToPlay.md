# How to Play & Access the Advanced Tic Tac Toe Game

## Features Overview
- **Aesthetic UI**: Responsive glass panel visuals using native CSS gradients.
- **AI Gameplay**: Instantly play challenging matches locally against the backend-AI logic.
- **Live Multiplayer**: Matchmake into competitive environments powered natively by WebSockets.
- **Rewind/Replay Engine**: View exhaustive frame-by-frame histories of old matches instantly.
- **Persistent Leaderboard**: Accounts are saved automatically via internal `tictactoe.sqlite`.

---

## 1. How to run it Independently (Local System - EASY MODE)
The fastest way to test the game locally is to simply double click on the **`RunGame.bat`** file located in the project's root folder (`c:\Tic Tac\RunGame.bat`). It will automatically install all dependencies, start the backend, and open up the React UI in your browser!

### Manual Execution (Alternatively):
If you just want to run the core server and evaluate the code natively without relying on tunnels:


1. Open a terminal and run the background Express Server:
   - `cd "backend"`
   - `npm install`
   - `npm run start`

2. Open a second terminal and build/launch the React Interface:
   - `cd "client"`
   - `npm install`
   - `npm run dev`
   - Open your browser to `http://localhost:5173/` ! 

---

## 2. How to run multiplayer over the internet
The application is pre-configured to be internet ready through the Vite Build pipeline natively bound into Express `app.use(express.static())`.

1. Rebuild the frontend logic into static `/dist`:
   - `cd "client"`
   - `npm run build`

2. Run the Express Backend Server on Port 3001:
   - `cd "backend"`
   - `npm run start` (Wait till you see "Backend is running on http://localhost:3001")

3. Run an SSH Reverse Tunnel (Zero config required on Mac/Windows/Linux):
   - `ssh -o StrictHostKeyChecking=no -R 80:localhost:3001 nokey@localhost.run`
   - Simply wait 5 seconds and look inside the terminal window for the printed `.lhr.life` URL link! You can share this instantly with anyone over the internet to securely join your backend server.

---

## 3. Demo Video Access
We have captured an interactive recorded `Webp` video demonstration validating user logins, automated AI interactions, leaderboard parsing, and the Replay engine.

- **Check out `DemoVideo.webp`** tightly packed inside this Submission Folder! Double click it to open it in Chrome/Edge.
