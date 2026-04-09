import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import { get, run, query } from './database.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

const PORT = 3001;

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, '../client/dist')));
// Matchmaking State
let waitingPlayer = null; // { id, username, socketId }

// WebSockets for Real-Time Multiplayer
io.on('connection', (socket) => {
  socket.on('register_user', (userId) => {
    socket.join('user_' + userId);
  });

  socket.on('join_game', (gameId) => {
    socket.join('game_' + gameId);
  });

  socket.on('find_match', async (user) => {
    if (waitingPlayer && waitingPlayer.id !== user.id) {
      // Found a match!
      const player1 = waitingPlayer;
      const player2 = user;
      waitingPlayer = null;
      
      const initialBoard = Array(9).fill(null);
      
      try {
        const result = await run(
          'INSERT INTO games (player1_id, player2_id, board_state, history) VALUES (?, ?, ?, ?)',
          [player1.id, player2.id, JSON.stringify(initialBoard), JSON.stringify([])]
        );
        const game = await get('SELECT * FROM games WHERE id = ?', [result.lastID]);
        
        io.to('user_' + player1.id).emit('match_found', game);
        io.to('user_' + player2.id).emit('match_found', game);
      } catch (err) {
        console.error(err);
      }
    } else {
      waitingPlayer = { ...user, socketId: socket.id };
    }
  });

  socket.on('cancel_matchmaking', (userId) => {
    if (waitingPlayer && waitingPlayer.id === userId) {
      waitingPlayer = null;
    }
  });
  
  socket.on('disconnect', () => {
    if (waitingPlayer && waitingPlayer.socketId === socket.id) {
      waitingPlayer = null;
    }
  });
});

// API: Login/Create User
app.post('/api/login', async (req, res) => {
  const { username } = req.body;
  if (!username || username.trim() === '') {
    return res.status(400).json({ error: 'Username is required' });
  }

  try {
    let user = await get('SELECT * FROM users WHERE username = ?', [username]);
    if (!user) {
      const result = await run('INSERT INTO users (username) VALUES (?)', [username]);
      user = await get('SELECT * FROM users WHERE id = ?', [result.lastID]);
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Leaderboard
app.get('/api/leaderboard', async (req, res) => {
  try {
    const users = await query('SELECT username, wins, losses, draws FROM users ORDER BY wins DESC, draws DESC LIMIT 10');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AI Move Generator
const calculateWinner = (squares) => {
  const lines = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
  for (let i = 0; i < lines.length; i++) {
    const [a, b, c] = lines[i];
    if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) return squares[a];
  }
  return null;
};

const getAIMove = (board) => {
  const emptyIndices = board.map((val, idx) => val === null ? idx : null).filter(val => val !== null);
  if (emptyIndices.length === 0) return -1;
  return emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
};

// API: Create Game (vs AI)
app.post('/api/games', async (req, res) => {
  const { player1_id, isAI } = req.body;
  const player2_id = isAI ? 0 : null; // We only call this manually for AI now.
  const initialBoard = Array(9).fill(null);
  
  try {
    const result = await run(
      'INSERT INTO games (player1_id, player2_id, board_state, history) VALUES (?, ?, ?, ?)',
      [player1_id, player2_id, JSON.stringify(initialBoard), JSON.stringify([])]
    );
    const game = await get('SELECT * FROM games WHERE id = ?', [result.lastID]);
    res.json(game);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Get Game Session
app.get('/api/games/:id', async (req, res) => {
  try {
    const game = await get('SELECT * FROM games WHERE id = ?', [req.params.id]);
    if (!game) return res.status(404).json({ error: 'Game not found' });
    res.json(game);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Get User's Games (History)
app.get('/api/games/history/:userId', async (req, res) => {
  try {
    const games = await query(
      'SELECT * FROM games WHERE player1_id = ? OR player2_id = ? ORDER BY created_at DESC LIMIT 20',
      [req.params.userId, req.params.userId]
    );
    res.json(games);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Make a Move
app.post('/api/games/:id/move', async (req, res) => {
  const { player_id, index } = req.body;
  const gameId = req.params.id;

  try {
    const game = await get('SELECT * FROM games WHERE id = ?', [gameId]);
    if (!game) return res.status(404).json({ error: 'Game not found' });
    if (game.status === 'completed') return res.status(400).json({ error: 'Game completed' });

    let board = JSON.parse(game.board_state);
    let history = JSON.parse(game.history);

    const xMoves = board.filter(cell => cell === 'X').length;
    const oMoves = board.filter(cell => cell === 'O').length;
    let currentMarker = xMoves <= oMoves ? 'X' : 'O';

    // Verify turn
    const expectedPlayerId = currentMarker === 'X' ? game.player1_id : game.player2_id;
    if (expectedPlayerId !== player_id && game.player2_id !== 0) {
       return res.status(403).json({ error: 'Not your turn' });
    }

    if (board[index] !== null) return res.status(400).json({ error: 'Cell occupied' });

    board[index] = currentMarker;
    history.push({ marker: currentMarker, index, player_id });

    let winnerMarker = calculateWinner(board);
    let isDraw = !winnerMarker && board.every(cell => cell !== null);
    let status = (winnerMarker || isDraw) ? 'completed' : 'ongoing';
    let winnerId = null;

    if (winnerMarker === 'X') winnerId = game.player1_id;
    if (winnerMarker === 'O') winnerId = game.player2_id;

    // AI Move
    if (status === 'ongoing' && game.player2_id === 0) {
      const aiIndex = getAIMove(board);
      if (aiIndex !== -1) {
        board[aiIndex] = 'O';
        history.push({ marker: 'O', index: aiIndex, player_id: 0 });
        
        winnerMarker = calculateWinner(board);
        isDraw = !winnerMarker && board.every(cell => cell !== null);
        status = (winnerMarker || isDraw) ? 'completed' : 'ongoing';
        if (winnerMarker === 'O') winnerId = 0;
      }
    }

    await run(
      'UPDATE games SET board_state = ?, history = ?, status = ?, winner_id = ? WHERE id = ?',
      [JSON.stringify(board), JSON.stringify(history), status, winnerId, gameId]
    );

    // Update Stats on completion
    if (status === 'completed') {
      const players = [game.player1_id, game.player2_id].filter(id => id !== 0);
      
      for (const pId of players) {
         if (winnerId === pId) {
             await run('UPDATE users SET wins = wins + 1 WHERE id = ?', [pId]);
         } else if (winnerId !== null) {
             await run('UPDATE users SET losses = losses + 1 WHERE id = ?', [pId]);
         } else {
             await run('UPDATE users SET draws = draws + 1 WHERE id = ?', [pId]);
         }
      }
    }

    const updatedGame = await get('SELECT * FROM games WHERE id = ?', [gameId]);
    
    // Broadcast to room
    io.to('game_' + gameId).emit('game_updated', updatedGame);

    res.json(updatedGame);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

server.listen(PORT, () => {
  console.log(`Backend is running on http://localhost:${PORT}`);
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
}); 

