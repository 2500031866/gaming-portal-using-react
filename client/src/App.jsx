import React, { useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:5000/api`;
export default function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('klu_user_v4');
    return saved ? JSON.parse(saved) : null;
  });

  const [activeTab, setActiveTab] = useState('home');
  const [adminSubTab, setAdminSubTab] = useState('tournaments');

  // Portal Data
  const [games, setGames] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [activeUsers, setActiveUsers] = useState([]);

  // Filters & Modals
  const [selectedGameFilter, setSelectedGameFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [inspectTourney, setInspectTourney] = useState(null);
  const [joinModalTourney, setJoinModalTourney] = useState(null);
  const [squadNameInput, setSquadNameInput] = useState('');
  const [toast, setToast] = useState('');

  // Auth Form
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '', ign: '' });

  // Admin Forms
  const [newTourney, setNewTourney] = useState({
    title: '',
    game: 'Valorant',
    mode: '5v5 Squad',
    status: 'Open',
    date: '',
    time: '05:00 PM IST',
    slotInterval: 30,
    prizePool: '₹10,000',
    rules: 'Auto-assigns match slots with timings as soon as 8 squads register.',
    maxPlayers: 8
  });

  const [newGame, setNewGame] = useState({
    name: '',
    genre: '',
    platform: 'PC / Mobile',
    icon: '🎮',
    accent: '#00f0ff',
    description: ''
  });

  const [newAccount, setNewAccount] = useState({
    name: '',
    email: '',
    password: '',
    ign: '',
    role: 'admin'
  });

  const [newAnnouncement, setNewAnnouncement] = useState({
    title: '',
    tag: 'OFFICIAL',
    content: ''
  });

  const notify = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 5000);
  };

  const loadPortalData = async () => {
    try {
      const res = await fetch(`${API_BASE}/bootstrap`);
      const data = await res.json();
      setGames(data.games || []);
      setTournaments(data.tournaments || []);
      setAnnouncements(data.announcements || []);
      setLeaderboard(data.leaderboard || []);

      if (inspectTourney) {
        const updated = (data.tournaments || []).find((x) => x.id === inspectTourney.id);
        if (updated) setInspectTourney(updated);
      }
    } catch (err) {
      console.error('Failed to connect to backend:', err);
    }
  };

  const loadAllUsers = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/users`);
      const data = await res.json();
      setAllUsers(data.users || []);
      setActiveUsers(data.activeUsers || []);
    } catch (err) {
      console.error(err);
    }
  };

  // Send heartbeat while logged in & refresh Admin active user tracker every 10s
  useEffect(() => {
    loadPortalData();

    if (!user) return;

    const sendHeartbeat = () => {
      fetch(`${API_BASE}/heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      }).catch(() => {});
    };

    sendHeartbeat();
    if (user.role === 'admin') {
      loadAllUsers();
    }

    const interval = setInterval(() => {
      sendHeartbeat();
      if (user.role === 'admin') {
        loadAllUsers();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [user]);

  // --- AUTH ACTIONS ---
  const handleLogin = async (e) => {
    e.preventDefault();
    const res = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: authForm.email, password: authForm.password })
    });
    const data = await res.json();
    if (res.ok) {
      setUser(data.user);
      localStorage.setItem('klu_user_v4', JSON.stringify(data.user));
      setActiveTab(data.user.role === 'admin' ? 'admin' : 'home');
      notify(`Welcome back, ${data.user.ign}!`);
    } else {
      notify(data.message);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    const res = await fetch(`${API_BASE}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...authForm, role: 'player' })
    });
    const data = await res.json();
    if (res.ok) {
      setUser(data.user);
      localStorage.setItem('klu_user_v4', JSON.stringify(data.user));
      setActiveTab('home');
      notify('Player profile created & saved!');
    } else {
      notify(data.message);
    }
  };

  const handleLogout = async () => {
    if (user?.id) {
      await fetch(`${API_BASE}/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      }).catch(() => {});
    }
    setUser(null);
    localStorage.removeItem('klu_user_v4');
    setActiveTab('home');
    notify('Logged out successfully.');
  };

  // --- SQUAD REGISTRATION & AUTO-SCHEDULING ---
  const openJoinModal = (t) => {
    if (!user) {
      setActiveTab('login');
      notify('Please login first to register your squad.');
      return;
    }
    setSquadNameInput(`${user.ign}'s Squad`);
    setJoinModalTourney(t);
  };

  const confirmJoinSquad = async (e) => {
    e.preventDefault();
    if (!joinModalTourney) return;

    const res = await fetch(`${API_BASE}/tournaments/${joinModalTourney.id}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.id,
        name: user.name,
        ign: user.ign,
        email: user.email,
        squadName: squadNameInput
      })
    });
    const data = await res.json();
    notify(data.message);
    setJoinModalTourney(null);
    await loadPortalData();

    if (data.autoScheduled) {
      setActiveTab('slots');
    }
  };

  const handleLeaveTournament = async (tId) => {
    await fetch(`${API_BASE}/tournaments/${tId}/leave`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id })
    });
    notify('Squad withdrew from tournament.');
    loadPortalData();
  };

  // --- ADMIN ACTIONS ---
  const handleCreateTournament = async (e) => {
    e.preventDefault();
    const res = await fetch(`${API_BASE}/admin/tournaments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTourney)
    });
    if (res.ok) {
      setNewTourney({ ...newTourney, title: '', date: '' });
      loadPortalData();
      notify('Tournament created! Auto-slots trigger when 8 squads join.');
    }
  };

  const handleManualGenerateSlots = async (tId) => {
    const res = await fetch(`${API_BASE}/admin/tournaments/${tId}/generate-slots`, {
      method: 'POST'
    });
    const data = await res.json();
    notify(data.message);
    loadPortalData();
  };

  const handleFillDemoSquads = async (tId) => {
    const res = await fetch(`${API_BASE}/admin/tournaments/${tId}/fill-demo-squads`, {
      method: 'POST'
    });
    const data = await res.json();
    notify(data.message);
    loadPortalData();
  };

  const handleSetSlotWinner = async (tId, slotId, winner) => {
    await fetch(`${API_BASE}/admin/tournaments/${tId}/slots/${slotId}/winner`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ winner })
    });
    notify(`Winner recorded: ${winner}`);
    loadPortalData();
  };

  const handleDeleteTournament = async (tId) => {
    await fetch(`${API_BASE}/admin/tournaments/${tId}`, { method: 'DELETE' });
    loadPortalData();
    notify('Tournament deleted.');
  };

  const handleKickPlayer = async (tId, userId) => {
    await fetch(`${API_BASE}/admin/tournaments/${tId}/players/${userId}`, { method: 'DELETE' });
    loadPortalData();
    notify('Squad removed from roster.');
  };

  const handleAddGame = async (e) => {
    e.preventDefault();
    const res = await fetch(`${API_BASE}/admin/games`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newGame)
    });
    if (res.ok) {
      setNewGame({ name: '', genre: '', platform: 'PC / Mobile', icon: '🎮', accent: '#00f0ff', description: '' });
      loadPortalData();
      notify('Game added to library!');
    }
  };

  const handleDeleteGame = async (gId) => {
    await fetch(`${API_BASE}/admin/games/${gId}`, { method: 'DELETE' });
    loadPortalData();
    notify('Game removed.');
  };

  const handleCreateAccount = async (e) => {
    e.preventDefault();
    const res = await fetch(`${API_BASE}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newAccount, isAdminCreation: true })
    });
    const data = await res.json();
    if (res.ok) {
      setNewAccount({ name: '', email: '', password: '', ign: '', role: 'admin' });
      loadAllUsers();
      loadPortalData();
      notify(`Created ${newAccount.role} account!`);
    } else {
      notify(data.message);
    }
  };

  const handleUpdateStats = async (userId, points, wins) => {
    await fetch(`${API_BASE}/admin/users/${userId}/stats`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ points, wins })
    });
    loadAllUsers();
    loadPortalData();
    notify('Leaderboard stats updated!');
  };

  const handleDeleteUser = async (userId) => {
    if (userId === user.id) {
      notify('Cannot delete your currently logged-in admin account.');
      return;
    }
    await fetch(`${API_BASE}/admin/users/${userId}`, { method: 'DELETE' });
    loadAllUsers();
    loadPortalData();
    notify('User removed.');
  };

  const handlePostAnnouncement = async (e) => {
    e.preventDefault();
    await fetch(`${API_BASE}/admin/announcements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newAnnouncement)
    });
    setNewAnnouncement({ title: '', tag: 'OFFICIAL', content: '' });
    loadPortalData();
    notify('News bulletin posted!');
  };

  const handleDeleteAnnouncement = async (id) => {
    await fetch(`${API_BASE}/admin/announcements/${id}`, { method: 'DELETE' });
    loadPortalData();
  };

  const filteredTournaments = tournaments.filter((t) => {
    const matchesGame = selectedGameFilter === 'ALL' || t.game === selectedGameFilter;
    const matchesSearch =
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.game.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesGame && matchesSearch;
  });

  const scheduledTournaments = tournaments.filter((t) => t.slots && t.slots.length > 0);

  return (
    <div>
      {/* LIVE ANNOUNCEMENT TICKER */}
      <div className="ticker-bar">
        <span className="live-dot"></span>
        <strong>ARENA LIVE:</strong>
        <span>
          {announcements[0]?.title || 'Auto-Slot Scheduler Active'} —{' '}
          {announcements[0]?.content || 'Register 8 squads to unlock automatic match slots & timings!'}
        </span>
      </div>

      {/* MAIN NAVBAR */}
      <nav className="navbar">
        <div className="brand" onClick={() => setActiveTab('home')}>
          ⚡ KLU GAMEZONE
        </div>

        <div className="nav-tabs">
          <button
            className={`nav-tab ${activeTab === 'home' ? 'active' : ''}`}
            onClick={() => setActiveTab('home')}
          >
            Arena Home
          </button>
          <button
            className={`nav-tab ${activeTab === 'games' ? 'active' : ''}`}
            onClick={() => setActiveTab('games')}
          >
            Games ({games.length})
          </button>
          <button
            className={`nav-tab ${activeTab === 'tournaments' ? 'active' : ''}`}
            onClick={() => setActiveTab('tournaments')}
          >
            Tournaments ({tournaments.length})
          </button>
          <button
            className={`nav-tab ${activeTab === 'slots' ? 'active' : ''}`}
            onClick={() => setActiveTab('slots')}
          >
            🗓️ Match Slots & Timings ({scheduledTournaments.length})
          </button>
          <button
            className={`nav-tab ${activeTab === 'leaderboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('leaderboard')}
          >
            Leaderboard
          </button>
          {user && (
            <button
              className={`nav-tab ${activeTab === 'profile' ? 'active' : ''}`}
              onClick={() => setActiveTab('profile')}
            >
              My Squad & Slots
            </button>
          )}
        </div>

        <div className="nav-actions">
          {user?.role === 'admin' && (
            <button
              className="btn btn-admin"
              onClick={() => {
                setActiveTab('admin');
                loadAllUsers();
              }}
            >
              🛡️ Admin Panel ({activeUsers.length} Online)
            </button>
          )}

          {user ? (
            <>
              <span style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
                <strong>{user.ign}</strong>
              </span>
              <button className="btn btn-danger" onClick={handleLogout}>
                Logout
              </button>
            </>
          ) : (
            <>
              <button className="btn btn-outline" onClick={() => setActiveTab('login')}>
                Login
              </button>
              <button className="btn btn-primary" onClick={() => setActiveTab('register')}>
                Join Arena
              </button>
            </>
          )}
        </div>
      </nav>

      <div className="container">
        {/* ==================== 1. ARENA HOME ==================== */}
        {activeTab === 'home' && (
          <>
            <div className="hero-banner">
              <div>
                <span className="hero-tag">8-SQUAD AUTO-SLOT ENGINE • SEASON 2026</span>
                <h1>DOMINATE THE KLU GAMING ARENA</h1>
                <p>
                  Register your squad in any 8-squad tournament—the moment all 8 squads lock in,
                  our system automatically assigns Quarterfinals, Semifinals, and Grand Final slots
                  with exact match timings!
                </p>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  <button className="btn btn-primary" onClick={() => setActiveTab('tournaments')}>
                    Register Squad Now →
                  </button>
                  <button className="btn btn-outline" onClick={() => setActiveTab('slots')}>
                    View Scheduled Slots ({scheduledTournaments.length})
                  </button>
                </div>
              </div>

              <div className="hero-stats">
                <div className="stat-box">
                  <h3>8 Squads</h3>
                  <span>Auto-Trigger Threshold</span>
                </div>
                <div className="stat-box">
                  <h3>{games.length}</h3>
                  <span>Supported Games</span>
                </div>
                <div className="stat-box">
                  <h3>{tournaments.length}</h3>
                  <span>Active Tournaments</span>
                </div>
                <div className="stat-box">
                  <h3>LAN</h3>
                  <span>Multi-Laptop Ready</span>
                </div>
              </div>
            </div>

            <div className="section-header">
              <h2>8-Squad Auto-Scheduled Tournaments</h2>
              <button className="btn btn-primary" onClick={() => setActiveTab('tournaments')}>
                View All Tournaments
              </button>
            </div>
            <div className="grid-3" style={{ marginBottom: '3rem' }}>
              {tournaments.slice(0, 3).map((t) => {
                const joined = user && t.players.some((p) => p.userId === user.id);
                const pct = Math.min(100, Math.round((t.players.length / t.maxPlayers) * 100));
                const hasSlots = t.slots && t.slots.length > 0;
                return (
                  <div key={t.id} className="glass-card">
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                        <span className="badge badge-purple">{t.game}</span>
                        <span className={`badge ${hasSlots ? 'badge-live' : 'badge-gold'}`}>
                          {hasSlots ? 'SLOTS ASSIGNED ✓' : `${t.players.length}/${t.maxPlayers} SQUADS`}
                        </span>
                      </div>
                      <h3 style={{ marginBottom: '0.5rem' }}>{t.title}</h3>
                      <p style={{ color: '#94a3b8', fontSize: '0.86rem' }}>
                        📅 {t.date} • ⏰ Starts {t.time}
                      </p>
                      <p style={{ color: '#94a3b8', fontSize: '0.86rem', marginTop: '0.25rem' }}>
                        🏆 Prize: <strong style={{ color: '#f59e0b' }}>{t.prizePool}</strong> • {t.mode}
                      </p>

                      <div style={{ marginTop: '0.9rem', fontSize: '0.8rem', color: '#cbd5e1' }}>
                        Squads Registered: {t.players.length} / {t.maxPlayers}
                      </div>
                      <div className="progress-track">
                        <div className="progress-fill" style={{ width: `${pct}%` }}></div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {hasSlots ? (
                        <button
                          className="btn btn-success"
                          style={{ flex: 1 }}
                          onClick={() => setInspectTourney(t)}
                        >
                          🗓️ View Match Slots & Timings
                        </button>
                      ) : (
                        <button
                          className="btn btn-primary"
                          style={{ flex: 1 }}
                          disabled={joined || t.players.length >= t.maxPlayers}
                          onClick={() => openJoinModal(t)}
                        >
                          {joined ? 'Squad Registered ✓' : 'Register Squad'}
                        </button>
                      )}
                      <button className="btn btn-outline" onClick={() => setInspectTourney(t)}>
                        Details
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="section-header">
              <h2>Featured Esports Titles</h2>
              <button className="btn btn-outline" onClick={() => setActiveTab('games')}>
                View All {games.length} Games
              </button>
            </div>
            <div className="grid-4" style={{ marginBottom: '3rem' }}>
              {games.slice(0, 4).map((g) => (
                <div key={g.id} className="glass-card">
                  <div>
                    <div className="game-icon" style={{ border: `1px solid ${g.accent}` }}>
                      {g.icon}
                    </div>
                    <span className="badge badge-cyan">{g.platform}</span>
                    <h3 style={{ margin: '0.6rem 0 0.35rem' }}>{g.name}</h3>
                    <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                      {g.description}
                    </p>
                  </div>
                  <button
                    className="btn btn-outline"
                    style={{ width: '100%' }}
                    onClick={() => {
                      setSelectedGameFilter(g.name);
                      setActiveTab('tournaments');
                    }}
                  >
                    Find {g.name} Events
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ==================== 2. ALL GAMES LIBRARY ==================== */}
        {activeTab === 'games' && (
          <>
            <div className="section-header">
              <div>
                <h2>KLU Official Game Library</h2>
                <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                  Select any title to filter active tournaments or register your squad.
                </p>
              </div>
            </div>

            <div className="grid-4">
              {games.map((g) => {
                const eventCount = tournaments.filter((t) => t.game === g.name).length;
                return (
                  <div key={g.id} className="glass-card">
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div className="game-icon" style={{ border: `1px solid ${g.accent}` }}>
                          {g.icon}
                        </div>
                        <span className="badge badge-cyan">{g.platform}</span>
                      </div>
                      <h3 style={{ marginBottom: '0.25rem' }}>{g.name}</h3>
                      <div style={{ fontSize: '0.8rem', color: '#00f0ff', marginBottom: '0.6rem' }}>
                        {g.genre}
                      </div>
                      <p style={{ color: '#94a3b8', fontSize: '0.86rem', lineHeight: '1.5', marginBottom: '1rem' }}>
                        {g.description}
                      </p>
                    </div>
                    <div>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: '0.8rem',
                          color: '#cbd5e1',
                          marginBottom: '0.75rem'
                        }}
                      >
                        <span>👥 {g.activePlayers} Campus Players</span>
                        <span>🏆 {eventCount} Events</span>
                      </div>
                      <button
                        className="btn btn-primary"
                        style={{ width: '100%' }}
                        onClick={() => {
                          setSelectedGameFilter(g.name);
                          setActiveTab('tournaments');
                        }}
                      >
                        View {g.name} Tournaments
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ==================== 3. TOURNAMENTS ARENA ==================== */}
        {activeTab === 'tournaments' && (
          <>
            <div className="section-header">
              <h2>Esports Tournaments (Auto-Slots at 8 Squads)</h2>
              <input
                type="text"
                placeholder="Search tournament or game..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  padding: '0.55rem 1rem',
                  borderRadius: '8px',
                  border: '1px solid rgba(0,240,255,0.3)',
                  background: '#0d1324',
                  color: '#fff',
                  minWidth: '250px'
                }}
              />
            </div>

            <div className="filter-pills" style={{ marginBottom: '1.75rem' }}>
              <button
                className={`pill ${selectedGameFilter === 'ALL' ? 'active' : ''}`}
                onClick={() => setSelectedGameFilter('ALL')}
              >
                All Games ({tournaments.length})
              </button>
              {games.map((g) => (
                <button
                  key={g.id}
                  className={`pill ${selectedGameFilter === g.name ? 'active' : ''}`}
                  onClick={() => setSelectedGameFilter(g.name)}
                >
                  {g.icon} {g.name}
                </button>
              ))}
            </div>

            <div className="grid-3">
              {filteredTournaments.map((t) => {
                const joined = user && t.players.some((p) => p.userId === user.id);
                const pct = Math.min(100, Math.round((t.players.length / t.maxPlayers) * 100));
                const hasSlots = t.slots && t.slots.length > 0;
                return (
                  <div key={t.id} className="glass-card">
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                        <span className="badge badge-purple">{t.game}</span>
                        <span className={`badge ${hasSlots ? 'badge-live' : 'badge-gold'}`}>
                          {hasSlots ? 'SLOTS LIVE ✓' : t.status}
                        </span>
                      </div>
                      <h3 style={{ marginBottom: '0.5rem' }}>{t.title}</h3>
                      <p style={{ color: '#94a3b8', fontSize: '0.86rem' }}>
                        📅 {t.date} • ⏰ Starts {t.time} ({t.slotInterval || 30}m/slot)
                      </p>
                      <p style={{ color: '#94a3b8', fontSize: '0.86rem', marginTop: '0.25rem' }}>
                        🏆 Prize: <strong style={{ color: '#f59e0b' }}>{t.prizePool}</strong> • {t.mode}
                      </p>
                      <p style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '0.4rem' }}>
                        📜 {t.rules}
                      </p>

                      <div style={{ marginTop: '0.9rem', fontSize: '0.8rem', color: '#cbd5e1' }}>
                        Squads: {t.players.length} / {t.maxPlayers}{' '}
                        {!hasSlots && `(Auto-schedules at ${t.autoScheduleAt || 8})`}
                      </div>
                      <div className="progress-track">
                        <div className="progress-fill" style={{ width: `${pct}%` }}></div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {joined ? (
                        <button
                          className="btn btn-danger"
                          style={{ flex: 1 }}
                          onClick={() => handleLeaveTournament(t.id)}
                        >
                          Leave Roster
                        </button>
                      ) : (
                        <button
                          className="btn btn-primary"
                          style={{ flex: 1 }}
                          disabled={t.players.length >= t.maxPlayers}
                          onClick={() => openJoinModal(t)}
                        >
                          {t.players.length >= t.maxPlayers ? '8/8 Full' : 'Register Squad'}
                        </button>
                      )}
                      <button
                        className={`btn ${hasSlots ? 'btn-success' : 'btn-outline'}`}
                        onClick={() => setInspectTourney(t)}
                      >
                        {hasSlots ? '🗓️ Slots & Timings' : `Roster (${t.players.length})`}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ==================== 4. LIVE MATCH SLOTS & TIMINGS PAGE ==================== */}
        {activeTab === 'slots' && (
          <div>
            <div className="section-header">
              <div>
                <h2>🗓️ Official Match Slots & Timings</h2>
                <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                  Automatically generated schedules when 8 squads complete registration.
                </p>
              </div>
            </div>

            {scheduledTournaments.length === 0 ? (
              <div className="admin-panel-box" style={{ textAlign: 'center', padding: '3rem' }}>
                <h3 style={{ marginBottom: '0.75rem' }}>No Tournaments Have Reached 8 Squads Yet</h3>
                <p style={{ color: '#94a3b8', marginBottom: '1.5rem' }}>
                  Look at <strong>KLU Valorant 8-Squad Knockout</strong> (currently 7/8 squads) — register
                  1 more squad to watch the automatic slot & timing scheduler trigger live!
                </p>
                <button className="btn btn-primary" onClick={() => setActiveTab('tournaments')}>
                  Go to Tournaments & Register 8th Squad
                </button>
              </div>
            ) : (
              scheduledTournaments.map((t) => (
                <div key={t.id} className="admin-panel-box">
                  <div className="section-header">
                    <div>
                      <span className="badge badge-purple">{t.game}</span>
                      <h3 style={{ marginTop: '0.4rem', fontSize: '1.3rem' }}>{t.title}</h3>
                      <p style={{ color: '#94a3b8', fontSize: '0.86rem' }}>
                        📅 {t.date} • Base Start: {t.time} • {t.slotInterval || 30} mins per match slot
                      </p>
                    </div>
                    <span className="badge badge-live">AUTO-SCHEDULED ({t.players.length} SQUADS)</span>
                  </div>

                  <div className="grid-3">
                    {t.slots.map((slot) => (
                      <div key={slot.slotId} className="slot-card">
                        <div className="slot-header">
                          <span className="badge badge-cyan">{slot.matchLabel}</span>
                          <strong style={{ color: '#00f0ff', fontSize: '0.88rem' }}>
                            ⏰ {slot.time}
                          </strong>
                        </div>

                        <div className="slot-vs-row">
                          <div className="squad-pill">
                            {slot.squad1}
                            {slot.captain1 !== '-' && (
                              <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 400 }}>
                                Capt: {slot.captain1}
                              </div>
                            )}
                          </div>
                          <div className="vs-tag">VS</div>
                          <div className="squad-pill">
                            {slot.squad2}
                            {slot.captain2 !== '-' && (
                              <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 400 }}>
                                Capt: {slot.captain2}
                              </div>
                            )}
                          </div>
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: '0.78rem',
                            color: '#94a3b8',
                            borderTop: '1px solid rgba(255,255,255,0.06)',
                            paddingTop: '0.5rem'
                          }}
                        >
                          <span>📍 {slot.lobbyRoom}</span>
                          <span>
                            Winner: <strong style={{ color: '#10b981' }}>{slot.winner}</strong>
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ==================== 5. LEADERBOARD ==================== */}
        {activeTab === 'leaderboard' && (
          <div className="admin-panel-box">
            <div className="section-header">
              <div>
                <h2>🏆 KLU Hall of Fame & Arena Rankings</h2>
                <p style={{ color: '#94a3b8', fontSize: '0.88rem' }}>
                  Earn +50 Arena XP when registering your squad, plus bonus XP from Admins for match victories.
                </p>
              </div>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>In-Game Name (IGN)</th>
                    <th>Player Name</th>
                    <th>Wins</th>
                    <th>Arena XP</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((p, idx) => (
                    <tr key={p.id}>
                      <td>
                        <strong style={{ color: idx === 0 ? '#f59e0b' : idx === 1 ? '#cbd5e1' : '#00f0ff' }}>
                          #{idx + 1} {idx === 0 ? '👑' : ''}
                        </strong>
                      </td>
                      <td>
                        <strong>{p.ign}</strong>
                      </td>
                      <td>{p.name}</td>
                      <td>{p.wins || 0} Wins</td>
                      <td>
                        <span className="badge badge-cyan">{p.points || 500} XP</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ==================== 6. PLAYER PROFILE & ASSIGNED SLOTS ==================== */}
        {activeTab === 'profile' && user && (
          <div className="admin-panel-box">
            <h2>🎮 Player Passport: {user.ign}</h2>
            <p style={{ color: '#94a3b8', marginBottom: '1.5rem' }}>
              Name: <strong>{user.name}</strong> • Email: <strong>{user.email}</strong> • Role:{' '}
              <span className="badge badge-purple">{user.role}</span>
            </p>

            <h3 style={{ marginBottom: '1rem' }}>My Registered Squads & Match Timings</h3>
            <div className="grid-3">
              {tournaments
                .filter((t) => t.players.some((p) => p.userId === user.id))
                .map((t) => {
                  const myEntry = t.players.find((p) => p.userId === user.id);
                  const mySlot = (t.slots || []).find(
                    (s) => s.squad1 === myEntry?.squadName || s.squad2 === myEntry?.squadName
                  );
                  return (
                    <div key={t.id} className="glass-card">
                      <div>
                        <span className="badge badge-cyan">{t.game}</span>
                        <h3 style={{ margin: '0.5rem 0' }}>{t.title}</h3>
                        <p style={{ color: '#cbd5e1', fontSize: '0.88rem' }}>
                          Squad: <strong>{myEntry?.squadName}</strong>
                        </p>
                        {mySlot ? (
                          <div
                            style={{
                              marginTop: '0.75rem',
                              padding: '0.75rem',
                              borderRadius: '10px',
                              background: 'rgba(16, 185, 129, 0.14)',
                              border: '1px solid rgba(16, 185, 129, 0.4)'
                            }}
                          >
                            <div style={{ color: '#10b981', fontWeight: 700, fontSize: '0.85rem' }}>
                              ✅ SLOT ASSIGNED: {mySlot.matchLabel}
                            </div>
                            <div style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>
                              ⏰ <strong>{mySlot.time}</strong> ({mySlot.date})
                            </div>
                            <div style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>
                              Matchup: {mySlot.squad1} vs {mySlot.squad2}
                            </div>
                          </div>
                        ) : (
                          <p style={{ color: '#f59e0b', fontSize: '0.82rem', marginTop: '0.5rem' }}>
                            ⏳ Waiting for {t.maxPlayers - t.players.length} more squad(s) to auto-assign slot timings.
                          </p>
                        )}
                      </div>
                      <button
                        className="btn btn-danger"
                        style={{ marginTop: '1rem' }}
                        onClick={() => handleLeaveTournament(t.id)}
                      >
                        Withdraw Squad
                      </button>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* ==================== 7. LOGIN & REGISTER ==================== */}
        {activeTab === 'login' && (
          <div className="auth-card">
            <h2 style={{ marginBottom: '0.5rem' }}>Arena Sign In</h2>
            <p style={{ color: '#94a3b8', fontSize: '0.88rem', marginBottom: '1.5rem' }}>
              Access your KLU GameZone player or admin dashboard.
            </p>
            <form onSubmit={handleLogin}>
              <div className="form-group">
                <label>Email Address</label>
                <input
                  type="email"
                  required
                  value={authForm.email}
                  onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Password</label>
                <input
                  type="password"
                  required
                  value={authForm.password}
                  onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                Enter Arena
              </button>
            </form>
            <p style={{ marginTop: '1.25rem', fontSize: '0.8rem', color: '#94a3b8' }}>
              Default Admin: <code>admin@klu.edu.in</code> / <code>admin123</code>
            </p>
          </div>
        )}

        {activeTab === 'register' && (
          <div className="auth-card">
            <h2 style={{ marginBottom: '0.5rem' }}>Create Player Passport</h2>
            <p style={{ color: '#94a3b8', fontSize: '0.88rem', marginBottom: '1.5rem' }}>
              Your account is saved permanently in the server database.
            </p>
            <form onSubmit={handleRegister}>
              <div className="form-group">
                <label>Full Name</label>
                <input
                  type="text"
                  required
                  value={authForm.name}
                  onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>In-Game Name (IGN)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., KLU_Phantom"
                  value={authForm.ign}
                  onChange={(e) => setAuthForm({ ...authForm, ign: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>College / Personal Email</label>
                <input
                  type="email"
                  required
                  value={authForm.email}
                  onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Password</label>
                <input
                  type="password"
                  required
                  value={authForm.password}
                  onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                Create Account & Save
              </button>
            </form>
          </div>
        )}

        {/* ==================== 8. SUPER ADMIN CONTROL CENTER ==================== */}
        {activeTab === 'admin' && user?.role === 'admin' && (
          <div>
            <div className="section-header">
              <h2>🛡️ Super Admin Control Center</h2>
              <div className="filter-pills">
                <button
                  className={`pill ${adminSubTab === 'tournaments' ? 'active' : ''}`}
                  onClick={() => setAdminSubTab('tournaments')}
                >
                  🏆 Tournaments & Auto-Slots
                </button>
                <button
                  className={`pill ${adminSubTab === 'games' ? 'active' : ''}`}
                  onClick={() => setAdminSubTab('games')}
                >
                  🎮 Manage Games ({games.length})
                </button>
                <button
                  className={`pill ${adminSubTab === 'users' ? 'active' : ''}`}
                  onClick={() => {
                    setAdminSubTab('users');
                    loadAllUsers();
                  }}
                >
                  👥 Users & Live Logins ({activeUsers.length} Online / {allUsers.length} Total)
                </button>
                <button
                  className={`pill ${adminSubTab === 'news' ? 'active' : ''}`}
                  onClick={() => setAdminSubTab('news')}
                >
                  📢 Announcements
                </button>
              </div>
            </div>

            {/* ADMIN TAB 1: TOURNAMENTS & AUTO-SLOT MANAGEMENT */}
            {adminSubTab === 'tournaments' && (
              <>
                <div className="admin-panel-box">
                  <h3>+ Host New 8-Squad Auto-Scheduled Tournament</h3>
                  <form onSubmit={handleCreateTournament} className="form-grid">
                    <div className="form-group">
                      <label>Tournament Title</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g., KLU Tekken 8 Clash"
                        value={newTourney.title}
                        onChange={(e) => setNewTourney({ ...newTourney, title: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Select Game</label>
                      <select
                        value={newTourney.game}
                        onChange={(e) => setNewTourney({ ...newTourney, game: e.target.value })}
                      >
                        {games.map((g) => (
                          <option key={g.id} value={g.name}>
                            {g.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Format / Mode</label>
                      <input
                        type="text"
                        value={newTourney.mode}
                        onChange={(e) => setNewTourney({ ...newTourney, mode: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Tournament Date</label>
                      <input
                        type="date"
                        required
                        value={newTourney.date}
                        onChange={(e) => setNewTourney({ ...newTourney, date: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>First Match Start Time</label>
                      <input
                        type="text"
                        placeholder="e.g., 05:00 PM IST"
                        value={newTourney.time}
                        onChange={(e) => setNewTourney({ ...newTourney, time: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Minutes Per Slot</label>
                      <input
                        type="number"
                        value={newTourney.slotInterval}
                        onChange={(e) => setNewTourney({ ...newTourney, slotInterval: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Prize Pool</label>
                      <input
                        type="text"
                        required
                        value={newTourney.prizePool}
                        onChange={(e) => setNewTourney({ ...newTourney, prizePool: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Auto-Trigger Squad Count</label>
                      <input
                        type="number"
                        required
                        value={newTourney.maxPlayers}
                        onChange={(e) => setNewTourney({ ...newTourney, maxPlayers: e.target.value })}
                      />
                    </div>
                    <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
                      <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                        Publish Tournament
                      </button>
                    </div>
                  </form>
                </div>

                <div className="admin-panel-box">
                  <h3>Manage Tournaments, Squads & Auto-Generated Slots</h3>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Tournament</th>
                          <th>Squads</th>
                          <th>Registered Squads (Click × to kick)</th>
                          <th>Slot Controls</th>
                          <th>Delete</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tournaments.map((t) => (
                          <tr key={t.id}>
                            <td>
                              <strong>{t.title}</strong>
                              <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                                {t.game} • {t.date} ({t.time})
                              </div>
                            </td>
                            <td>
                              <span className="badge badge-cyan">
                                {t.players.length} / {t.maxPlayers}
                              </span>
                            </td>
                            <td>
                              {t.players.length === 0 ? (
                                <span style={{ color: '#64748b' }}>No squads yet</span>
                              ) : (
                                t.players.map((p) => (
                                  <span key={p.userId} className="player-chip">
                                    <strong>{p.squadName || p.ign}</strong> ({p.name})
                                    <button
                                      style={{
                                        background: 'none',
                                        border: 'none',
                                        color: '#f43f5e',
                                        cursor: 'pointer',
                                        fontWeight: 'bold'
                                      }}
                                      onClick={() => handleKickPlayer(t.id, p.userId)}
                                    >
                                      ×
                                    </button>
                                  </span>
                                ))
                              )}
                            </td>
                            <td>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                <button
                                  className="btn btn-success"
                                  style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem' }}
                                  onClick={() => handleManualGenerateSlots(t.id)}
                                >
                                  ⚡ Generate Slots Now
                                </button>
                                {t.players.length < t.maxPlayers && (
                                  <button
                                    className="btn btn-outline"
                                    style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem' }}
                                    onClick={() => handleFillDemoSquads(t.id)}
                                  >
                                    🤖 Auto-Fill to 8 Squads
                                  </button>
                                )}
                                {t.slots?.length > 0 && (
                                  <button
                                    className="btn btn-admin"
                                    style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem' }}
                                    onClick={() => setInspectTourney(t)}
                                  >
                                    🗓️ View / Edit Winners ({t.slots.length})
                                  </button>
                                )}
                              </div>
                            </td>
                            <td>
                              <button
                                className="btn btn-danger"
                                onClick={() => handleDeleteTournament(t.id)}
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {/* ADMIN TAB 2: MANAGE GAMES */}
            {adminSubTab === 'games' && (
              <>
                <div className="admin-panel-box">
                  <h3>+ Add New Game to Portal</h3>
                  <form onSubmit={handleAddGame} className="form-grid">
                    <div className="form-group">
                      <label>Game Title</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g., Rocket League"
                        value={newGame.name}
                        onChange={(e) => setNewGame({ ...newGame, name: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Genre</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g., Vehicular Soccer"
                        value={newGame.genre}
                        onChange={(e) => setNewGame({ ...newGame, genre: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Platform</label>
                      <input
                        type="text"
                        value={newGame.platform}
                        onChange={(e) => setNewGame({ ...newGame, platform: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Emoji Icon</label>
                      <input
                        type="text"
                        value={newGame.icon}
                        onChange={(e) => setNewGame({ ...newGame, icon: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Short Description</label>
                      <input
                        type="text"
                        required
                        value={newGame.description}
                        onChange={(e) => setNewGame({ ...newGame, description: e.target.value })}
                      />
                    </div>
                    <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
                      <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                        Add Game
                      </button>
                    </div>
                  </form>
                </div>

                <div className="admin-panel-box">
                  <h3>All Supported Games</h3>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Icon</th>
                          <th>Game</th>
                          <th>Genre</th>
                          <th>Platform</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {games.map((g) => (
                          <tr key={g.id}>
                            <td style={{ fontSize: '1.4rem' }}>{g.icon}</td>
                            <td>
                              <strong>{g.name}</strong>
                            </td>
                            <td>{g.genre}</td>
                            <td>{g.platform}</td>
                            <td>
                              <button className="btn btn-danger" onClick={() => handleDeleteGame(g.id)}>
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {/* ADMIN TAB 3: LIVE LOGGED-IN USERS + CREATE ADMINS / USERS & EDIT XP */}
            {adminSubTab === 'users' && (
              <>
                {/* LIVE ACTIVE LOGINS CARD */}
                <div className="online-banner">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <span className="live-dot"></span>
                      <h3 style={{ color: '#10b981', fontSize: '1.08rem' }}>
                        Currently Logged-In Users: {activeUsers.length}
                      </h3>
                    </div>
                    <button
                      className="btn btn-outline"
                      style={{ padding: '0.35rem 0.8rem', fontSize: '0.78rem' }}
                      onClick={loadAllUsers}
                    >
                      🔄 Refresh Active List
                    </button>
                  </div>

                  {activeUsers.length === 0 ? (
                    <p style={{ color: '#94a3b8', fontSize: '0.86rem' }}>
                      No active user sessions detected right now.
                    </p>
                  ) : (
                    <div>
                      {activeUsers.map((au) => (
                        <span key={au.id} className="online-user-pill">
                          <span className="live-dot"></span>
                          <strong>{au.name}</strong>
                          <span style={{ color: '#00f0ff' }}>({au.ign})</span>
                          <span className={`badge ${au.role === 'admin' ? 'badge-purple' : 'badge-cyan'}`}>
                            {au.role}
                          </span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="admin-panel-box">
                  <h3>+ Create New Admin or Player Account</h3>
                  <form onSubmit={handleCreateAccount} className="form-grid">
                    <div className="form-group">
                      <label>Full Name</label>
                      <input
                        type="text"
                        required
                        value={newAccount.name}
                        onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>In-Game Name (IGN)</label>
                      <input
                        type="text"
                        required
                        value={newAccount.ign}
                        onChange={(e) => setNewAccount({ ...newAccount, ign: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Email</label>
                      <input
                        type="email"
                        required
                        value={newAccount.email}
                        onChange={(e) => setNewAccount({ ...newAccount, email: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Password</label>
                      <input
                        type="password"
                        required
                        value={newAccount.password}
                        onChange={(e) => setNewAccount({ ...newAccount, password: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Account Role</label>
                      <select
                        value={newAccount.role}
                        onChange={(e) => setNewAccount({ ...newAccount, role: e.target.value })}
                      >
                        <option value="admin">Admin (Full Control)</option>
                        <option value="player">Player</option>
                      </select>
                    </div>
                    <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
                      <button type="submit" className="btn btn-admin" style={{ width: '100%' }}>
                        Create Account
                      </button>
                    </div>
                  </form>
                </div>

                <div className="admin-panel-box">
                  <h3>All Registered Accounts ({allUsers.length}) & Leaderboard XP Control</h3>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Status</th>
                          <th>Name / IGN</th>
                          <th>Email</th>
                          <th>Role</th>
                          <th>Arena XP</th>
                          <th>Wins</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allUsers.map((u) => (
                          <tr key={u.id}>
                            <td>
                              {u.isOnline ? (
                                <span className="badge badge-live">
                                  <span className="live-dot"></span> Online
                                </span>
                              ) : (
                                <span className="badge badge-offline">Offline</span>
                              )}
                            </td>
                            <td>
                              <strong>{u.ign}</strong>
                              <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{u.name}</div>
                            </td>
                            <td>{u.email}</td>
                            <td>
                              <span className={`badge ${u.role === 'admin' ? 'badge-purple' : 'badge-cyan'}`}>
                                {u.role}
                              </span>
                            </td>
                            <td>
                              <button
                                className="btn btn-outline"
                                style={{ padding: '0.25rem 0.55rem' }}
                                onClick={() => handleUpdateStats(u.id, (u.points || 500) + 100, u.wins || 0)}
                              >
                                {u.points || 500} XP (+100)
                              </button>
                            </td>
                            <td>
                              <button
                                className="btn btn-outline"
                                style={{ padding: '0.25rem 0.55rem' }}
                                onClick={() => handleUpdateStats(u.id, u.points || 500, (u.wins || 0) + 1)}
                              >
                                {u.wins || 0} (+1 Win)
                              </button>
                            </td>
                            <td>
                              <button className="btn btn-danger" onClick={() => handleDeleteUser(u.id)}>
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {/* ADMIN TAB 4: ANNOUNCEMENTS */}
            {adminSubTab === 'news' && (
              <div className="admin-panel-box">
                <h3>📢 Publish Live Arena Announcement</h3>
                <form onSubmit={handlePostAnnouncement} className="form-grid" style={{ marginBottom: '1.5rem' }}>
                  <div className="form-group">
                    <label>Headline</label>
                    <input
                      type="text"
                      required
                      value={newAnnouncement.title}
                      onChange={(e) => setNewAnnouncement({ ...newAnnouncement, title: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Tag</label>
                    <select
                      value={newAnnouncement.tag}
                      onChange={(e) => setNewAnnouncement({ ...newAnnouncement, tag: e.target.value })}
                    >
                      <option value="OFFICIAL">OFFICIAL</option>
                      <option value="LIVE MATCH">LIVE MATCH</option>
                      <option value="UPDATE">UPDATE</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Message</label>
                    <input
                      type="text"
                      required
                      value={newAnnouncement.content}
                      onChange={(e) => setNewAnnouncement({ ...newAnnouncement, content: e.target.value })}
                    />
                  </div>
                  <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                      Post Bulletin
                    </button>
                  </div>
                </form>

                {announcements.map((a) => (
                  <div
                    key={a.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.85rem',
                      borderBottom: '1px solid rgba(255,255,255,0.08)'
                    }}
                  >
                    <div>
                      <strong>[{a.tag}] {a.title}:</strong>{' '}
                      <span style={{ color: '#94a3b8' }}>{a.content}</span>
                    </div>
                    <button className="btn btn-danger" onClick={() => handleDeleteAnnouncement(a.id)}>
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* SQUAD REGISTRATION MODAL */}
      {joinModalTourney && (
        <div className="modal-backdrop" onClick={() => setJoinModalTourney(null)}>
          <div className="modal-box" style={{ maxWidth: '460px' }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginBottom: '0.5rem' }}>Register Your Squad</h2>
            <p style={{ color: '#94a3b8', fontSize: '0.88rem', marginBottom: '1.25rem' }}>
              Tournament: <strong>{joinModalTourney.title}</strong> ({joinModalTourney.players.length}/
              {joinModalTourney.maxPlayers} squads registered)
            </p>
            <form onSubmit={confirmJoinSquad}>
              <div className="form-group">
                <label>Official Squad / Team Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., KLU Strikers"
                  value={squadNameInput}
                  onChange={(e) => setSquadNameInput(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  Confirm Squad Slot
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => setJoinModalTourney(null)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TOURNAMENT ROSTER & AUTO-SLOTS DETAILS MODAL */}
      {inspectTourney && (
        <div className="modal-backdrop" onClick={() => setInspectTourney(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <span className="badge badge-purple">{inspectTourney.game}</span>
              <button className="btn btn-danger" onClick={() => setInspectTourney(null)}>
                Close ×
              </button>
            </div>
            <h2 style={{ marginBottom: '0.4rem' }}>{inspectTourney.title}</h2>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1rem' }}>
              📅 {inspectTourney.date} • ⏰ Starts {inspectTourney.time} • 🏆 {inspectTourney.prizePool}
            </p>

            {inspectTourney.slots && inspectTourney.slots.length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem', color: '#10b981' }}>
                  🗓️ Auto-Assigned Match Slots & Timings
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {inspectTourney.slots.map((s) => (
                    <div key={s.slotId} className="slot-card">
                      <div className="slot-header">
                        <span className="badge badge-cyan">{s.matchLabel}</span>
                        <strong style={{ color: '#00f0ff', fontSize: '0.85rem' }}>⏰ {s.time}</strong>
                      </div>
                      <div className="slot-vs-row">
                        <div className="squad-pill">{s.squad1}</div>
                        <div className="vs-tag">VS</div>
                        <div className="squad-pill">{s.squad2}</div>
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: '0.8rem',
                          color: '#94a3b8'
                        }}
                      >
                        <span>📍 {s.lobbyRoom}</span>
                        {user?.role === 'admin' ? (
                          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                            <span>Winner:</span>
                            <button
                              className="btn btn-outline"
                              style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                              onClick={() => handleSetSlotWinner(inspectTourney.id, s.slotId, s.squad1)}
                            >
                              {s.squad1}
                            </button>
                            <button
                              className="btn btn-outline"
                              style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                              onClick={() => handleSetSlotWinner(inspectTourney.id, s.slotId, s.squad2)}
                            >
                              {s.squad2}
                            </button>
                          </div>
                        ) : (
                          <span>
                            Winner: <strong style={{ color: '#10b981' }}>{s.winner}</strong>
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem', color: '#00f0ff' }}>
              Registered Squads ({inspectTourney.players.length} / {inspectTourney.maxPlayers})
            </h3>
            {inspectTourney.players.length === 0 ? (
              <p style={{ color: '#64748b', fontSize: '0.9rem' }}>No squads have joined yet.</p>
            ) : (
              <div>
                {inspectTourney.players.map((p, i) => (
                  <div key={p.userId} className="player-chip">
                    #{i + 1} <strong>{p.squadName || p.ign}</strong> (Capt: {p.name})
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {toast && <div className="toast">⚡ {toast}</div>}

      <footer className="footer">
        <div className="brand-font" style={{ color: '#00f0ff', marginBottom: '0.4rem' }}>
          KLU GAMEZONE ESPORTS ARENA
        </div>
        <p>Live Active Session Tracker • 8-Squad Auto-Slot Scheduler • Multi-Laptop LAN Ready</p>
      </footer>
    </div>
  );
}
