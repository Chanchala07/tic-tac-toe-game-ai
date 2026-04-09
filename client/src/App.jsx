import { useState, useEffect } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { User, Trophy, Play, History, LogOut, ArrowLeft, Disc, ChevronLeft, ChevronRight, Users, Loader } from 'lucide-react';
import './index.css';

axios.defaults.headers.common['Bypass-Tunnel-Reminder'] = 'true';


const API_URL = import.meta.env.PROD ? '/api' : 'http://localhost:3001/api';
const socket = io(import.meta.env.PROD ? undefined : 'http://localhost:3001', {
  extraHeaders: {
    "Bypass-Tunnel-Reminder": "true"
  }
});


function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('login'); 
  const [game, setGame] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [historyList, setHistoryList] = useState([]);
  
  const [replayMoves, setReplayMoves] = useState([]);
  const [replayStep, setReplayStep] = useState(0);

  useEffect(() => {
    socket.on('match_found', (gameData) => {
      socket.emit('join_game', gameData.id);
      setGame(gameData);
      setView('game');
    });

    socket.on('game_updated', (updatedGame) => {
      setGame(updatedGame);
      if (updatedGame.status === 'completed' && user) {
        // Fetch fresh stats
        axios.post(`${API_URL}/login`, { username: user.username }).then(res => {
          setUser(res.data);
        });
      }
    });

    return () => {
      socket.off('match_found');
      socket.off('game_updated');
    };
  }, [user]);

  const handleLogin = async (e) => {
    e.preventDefault();
    const username = e.target.username.value;
    if (!username) return;
    try {
      const res = await axios.post(`${API_URL}/login`, { username });
      setUser(res.data);
      socket.emit('register_user', res.data.id);
      setView('menu');
    } catch (err) {
      alert("Error logging in");
    }
  };

  const fetchLeaderboard = async () => {
    try {
      const res = await axios.get(`${API_URL}/leaderboard`);
      setLeaderboard(res.data);
      setView('leaderboard');
    } catch (err) { }
  };

  const fetchHistory = async () => {
    try {
      const res = await axios.get(`${API_URL}/games/history/${user.id}`);
      setHistoryList(res.data);
      setView('history');
    } catch (err) { }
  };

  // Start AI Game
  const startGame = async (isAI) => {
    try {
      const res = await axios.post(`${API_URL}/games`, { player1_id: user.id, isAI });
      socket.emit('join_game', res.data.id);
      setGame(res.data);
      setView('game');
    } catch (err) { }
  };

  // Find Multiplayer Match
  const findMatch = () => {
    socket.emit('find_match', user);
    setView('matchmaking');
  };

  const cancelMatchmaking = () => {
    socket.emit('cancel_matchmaking', user.id);
    setView('menu');
  };

  const makeMove = async (index) => {
    if (!game || game.status === 'completed') return;
    const board = JSON.parse(game.board_state);
    
    const xMoves = board.filter(cell => cell === 'X').length;
    const oMoves = board.filter(cell => cell === 'O').length;
    const currentMarker = xMoves <= oMoves ? 'X' : 'O';
    const isMyTurn = currentMarker === 'X' ? (game.player1_id === user.id) : (game.player2_id === user.id);

    if (!isMyTurn) return;
    if (board[index] !== null) return; 

    // Optimistic UI update
    const newBoard = [...board];
    newBoard[index] = currentMarker;
    setGame(prev => ({ ...prev, board_state: JSON.stringify(newBoard) }));

    try {
      const res = await axios.post(`${API_URL}/games/${game.id}/move`, {
        player_id: user.id,
        index
      });
      // the actual state will be updated via 'game_updated' socket event
    } catch (err) {
      console.error(err);
      // rollback
      setGame(game);
    }
  };

  const viewReplay = (gameData) => {
    setGame(gameData);
    setReplayMoves(JSON.parse(gameData.history));
    setReplayStep(0);
    setView('replay');
  };

  const nextReplayStep = () => { if (replayStep < replayMoves.length) setReplayStep(rs => rs + 1); };
  const prevReplayStep = () => { if (replayStep > 0) setReplayStep(rs => rs - 1); };

  // Renderers
  const renderLogin = () => (
    <div className="glass-panel">
      <h1>Tic Tac Toe</h1>
      <p style={{ textAlign: 'center', marginBottom: '2rem', color: 'var(--text-muted)' }}>
        Enter a username to start playing right away.
      </p>
      <form onSubmit={handleLogin}>
        <input type="text" name="username" placeholder="Username" maxLength="15" autoFocus />
        <button type="submit"><User size={20} /> Continue</button>
      </form>
    </div>
  );

  const renderMenu = () => (
    <div className="glass-panel">
      <h1>Welcome, {user.username}</h1>
      <div className="player-stats">
        <div className="stat-box"><span>{user.wins}</span> Wins</div>
        <div className="stat-box"><span>{user.losses}</span> Losses</div>
        <div className="stat-box"><span>{user.draws}</span> Draws</div>
      </div>
      <div className="menu-options">
        <button onClick={findMatch} style={{ background: 'var(--x-color)' }}><Users size={20} /> Play Multiplayer</button>
        <button onClick={() => startGame(true)}><Play size={20} /> Play vs AI</button>
        <button className="secondary" onClick={fetchLeaderboard}><Trophy size={20} /> Leaderboard</button>
        <button className="secondary" onClick={fetchHistory}><History size={20} /> Match History</button>
        <button className="secondary" onClick={() => {setUser(null); setView('login');}} style={{marginTop: '1rem', background: 'transparent', color: 'var(--o-color)', border: '1px solid rgba(244, 63, 94, 0.3)'}}><LogOut size={20} /> Logout</button>
      </div>
    </div>
  );

  const renderMatchmaking = () => (
    <div className="glass-panel" style={{ textAlign: 'center' }}>
      <h2>Matchmaking</h2>
      <div style={{ margin: '3rem 0' }}>
        <Loader size={48} className="spinner" style={{ animation: 'spin 2s linear infinite', color: 'var(--x-color)' }} />
      </div>
      <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Looking for an opponent...</p>
      <button className="secondary" onClick={cancelMatchmaking}>Cancel</button>
      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );

  const renderLeaderboard = () => (
    <div className="glass-panel">
      <div className="header">
        <ArrowLeft size={24} style={{cursor: 'pointer'}} onClick={() => setView('menu')} />
        <h2>Leaderboard</h2>
        <div style={{width: 24}}></div>
      </div>
      <ul className="leaderboard-list">
        {leaderboard.map((lbUser, idx) => (
          <li key={idx} className="leaderboard-item">
            <div>
              <span style={{marginRight: '1rem', color: 'var(--text-muted)'}}>#{idx + 1}</span>
              <strong>{lbUser.username}</strong>
            </div>
            <div style={{color: 'var(--accent)'}}>{lbUser.wins} W / {lbUser.draws} D</div>
          </li>
        ))}
      </ul>
      {leaderboard.length === 0 && <p style={{textAlign: 'center', opacity: 0.5}}>No players yet.</p>}
    </div>
  );

  const renderHistory = () => (
    <div className="glass-panel" style={{maxWidth: 600}}>
      <div className="header">
        <ArrowLeft size={24} style={{cursor: 'pointer'}} onClick={() => setView('menu')} />
        <h2>Match History</h2>
        <div style={{width: 24}}></div>
      </div>
      <div>
        {historyList.map(item => {
          let outcome = 'Draw';
          let color = 'var(--text-muted)';
          if (item.winner_id === user.id) { outcome = 'Victory'; color = 'var(--x-color)'; }
          else if (item.winner_id !== null) { outcome = 'Defeat'; color = 'var(--o-color)'; }

          return (
            <div key={item.id} className="history-item">
              <div>
                <strong>VS {item.player2_id === 0 ? 'AI' : 'Player'}</strong>
                <div style={{fontSize: '0.8rem', color: 'var(--text-muted)'}}>{new Date(item.created_at).toLocaleDateString()}</div>
              </div>
              <div style={{display: 'flex', alignItems: 'center', gap: '1rem'}}>
                <strong style={{color}}>{outcome}</strong>
                <button className="secondary" style={{padding: '0.5rem', width: 'auto'}} onClick={() => viewReplay(item)}>
                  <Play size={16} /> Replay
                </button>
              </div>
            </div>
          );
        })}
        {historyList.length === 0 && <p style={{textAlign: 'center', opacity: 0.5}}>No history available.</p>}
      </div>
    </div>
  );

  const renderGame = () => {
    const board = JSON.parse(game.board_state);
    const xMoves = board.filter(c => c === 'X').length;
    const oMoves = board.filter(c => c === 'O').length;
    const currentMarker = xMoves <= oMoves ? 'X' : 'O';
    const isMyTurn = currentMarker === 'X' ? (game.player1_id === user.id) : (game.player2_id === user.id);
    
    let statusText = isMyTurn ? `Your Turn (${currentMarker})` : "Opponent's Turn";
    
    if (game.status === 'completed') {
      if (game.winner_id === user.id) statusText = "You Won!";
      else if (game.winner_id === null) statusText = "It's a Draw!";
      else statusText = "You Lost!";
    }

    return (
      <div className="glass-panel">
        <div className="header">
          <ArrowLeft size={24} style={{cursor: 'pointer'}} onClick={() => setView('menu')} />
          <div className="status-badge">
            <Disc size={16} color={game.status === 'completed' ? 'gray' : (isMyTurn ? 'var(--x-color)' : 'var(--o-color)')} />
            {statusText}
          </div>
          <div style={{width: 24}}></div>
        </div>

        <div style={{textAlign: 'center', marginBottom: '1rem', color: 'var(--text-muted)'}}>
            {game.player2_id === 0 ? 'Playing against AI' : 'Multiplayer Match'}
        </div>

        <div className="board">
          {board.map((cell, idx) => (
            <div 
              key={idx} 
              className={`cell ${cell ? cell.toLowerCase() : ''} ${cell || (!isMyTurn && game.status !== 'completed') ? 'occupied' : ''}`}
              onClick={() => makeMove(idx)}
            >
              {cell}
            </div>
          ))}
        </div>

        {game.status === 'completed' && (
          <button onClick={() => game.player2_id === 0 ? startGame(true) : findMatch()}>Play Again</button>
        )}
      </div>
    );
  };

  const renderReplay = () => {
    let board = Array(9).fill(null);
    for(let i=0; i<replayStep; i++) {
       const move = replayMoves[i];
       board[move.index] = move.marker;
    }

    return (
      <div className="glass-panel">
        <div className="header">
          <ArrowLeft size={24} style={{cursor: 'pointer'}} onClick={() => setView('history')} />
          <h2>Replay <span style={{fontSize: '1rem', color: 'gray'}}>({replayStep}/{replayMoves.length})</span></h2>
          <div style={{width: 24}}></div>
        </div>

        <div className="board">
          {board.map((cell, idx) => (
            <div key={idx} className={`cell ${cell ? cell.toLowerCase() : ''} occupied`}>
              {cell}
            </div>
          ))}
        </div>

        <div style={{display: 'flex', gap: '1rem'}}>
          <button className="secondary" onClick={prevReplayStep} disabled={replayStep === 0}><ChevronLeft /> Prev</button>
          <button className="secondary" onClick={nextReplayStep} disabled={replayStep === replayMoves.length}>Next <ChevronRight /></button>
        </div>
      </div>
    );
  };

  return (
    <>
      {view === 'login' && renderLogin()}
      {view === 'menu' && renderMenu()}
      {view === 'matchmaking' && renderMatchmaking()}
      {view === 'leaderboard' && renderLeaderboard()}
      {view === 'history' && renderHistory()}
      {view === 'game' && renderGame()}
      {view === 'replay' && renderReplay()}
    </>
  );
}

export default App;
