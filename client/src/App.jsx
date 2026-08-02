import { useCallback, useEffect, useRef, useState } from 'react';
import { getSocket } from './socket.js';
import { isRunningInsideDiscord, setupDiscordSdk } from './discordSdk.js';
import LocalDevJoin from './components/LocalDevJoin.jsx';
import Lobby from './components/Lobby.jsx';
import ChooseWord from './components/ChooseWord.jsx';
import GuessScreen from './components/GuessScreen.jsx';
import RoundResult from './components/RoundResult.jsx';
import GameEnd from './components/GameEnd.jsx';
import ErrorBanner from './components/ErrorBanner.jsx';
import ProfileHeader from './components/ProfileHeader.jsx';

export default function App() {
  const [status, setStatus] = useState('connecting'); // connecting | needsLocalJoin | joined | error
  const [errorMessage, setErrorMessage] = useState(null);
  const [me, setMe] = useState(null);
  const [lobbyState, setLobbyState] = useState(null);
  const [roundInfo, setRoundInfo] = useState(null);
  const [choosingProgress, setChoosingProgress] = useState(null);
  const [wordReady, setWordReady] = useState(false);
  const [myGuessState, setMyGuessState] = useState({ attempts: [], done: false, won: false });
  const [opponents, setOpponents] = useState({});
  const [roundEnded, setRoundEnded] = useState(null);
  const [gameEnded, setGameEnded] = useState(null);
  const [transientError, setTransientError] = useState(null);

  const socketRef = useRef(null);

  const joinRoom = useCallback((user, room) => {
    setMe(user);
    const socket = getSocket();
    socketRef.current = socket;

    if (!socket.connected) socket.connect();

    const onConnect = () => {
      socket.emit('lobby:join', { roomId: room, player: user }, (ack) => {
        if (ack?.ok) {
          setLobbyState(ack.state);
          setStatus('joined');
        } else {
          setErrorMessage(ack?.error || 'Não foi possível entrar na sala.');
          setStatus('error');
        }
      });
    };

    if (socket.connected) onConnect();
    else socket.once('connect', onConnect);

    socket.on('lobby:state', (state) => setLobbyState(state));

    socket.on('round:started', (event) => {
      setRoundInfo(event);
      setChoosingProgress(null);
      setWordReady(false);
      setMyGuessState({ attempts: [], done: false, won: false });
      setOpponents({});
      setRoundEnded(null);
    });

    socket.on('round:choosingProgress', (event) => setChoosingProgress(event));
    socket.on('round:wordReady', () => setWordReady(true));

    socket.on('guess:result', (result) => {
      setMyGuessState({ attempts: result.attempts, done: result.done, won: result.won });
    });

    socket.on('opponent:progress', (progress) => {
      setOpponents((prev) => ({ ...prev, [progress.playerId]: progress }));
    });

    socket.on('round:ended', (event) => setRoundEnded(event));

    socket.on('game:ended', (event) => {
      setGameEnded(event);
      setRoundEnded(null);
    });

    socket.on('disconnect', () => {
      setTransientError('Ligação perdida. A tentar reconectar...');
    });

    socket.on('connect', () => {
      setTransientError(null);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (isRunningInsideDiscord()) {
        try {
          const { instanceId, user } = await setupDiscordSdk();
          if (cancelled) return;
          joinRoom(user, instanceId);
        } catch (err) {
          console.error(err);
          if (!cancelled) {
            setErrorMessage('Falha ao ligar ao Discord: ' + err.message);
            setStatus('error');
          }
        }
      } else {
        setStatus('needsLocalJoin');
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [joinRoom]);

  const emit = useCallback((event, payload) => {
    return new Promise((resolve) => {
      socketRef.current?.emit(event, payload ?? {}, (ack) => resolve(ack));
    });
  }, []);

  if (status === 'connecting') {
    return <CenteredMessage title="Quina" subtitle="A ligar..." />;
  }

  if (status === 'needsLocalJoin') {
    return (
      <LocalDevJoin
        onJoin={(user, room) => {
          setStatus('connecting');
          joinRoom(user, room);
        }}
      />
    );
  }

  if (status === 'error') {
    return <CenteredMessage title="Quina" subtitle={errorMessage} isError />;
  }

  if (!lobbyState) {
    return <CenteredMessage title="Quina" subtitle="A entrar na sala..." />;
  }

  const myPlayer = lobbyState.players.find((p) => p.id === me.id);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-left">
          <ProfileHeader player={myPlayer} emit={emit} />
        </div>
        <div className="app-header-title">
          <h1>Quina</h1>
          <span className="subtitle">descobre a palavra</span>
        </div>
        <div className="app-header-right">
          {lobbyState.phase !== 'lobby' && (
            <div className="round-pill">
              Ronda {lobbyState.round} / {lobbyState.totalRounds}
            </div>
          )}
        </div>
      </header>

      {transientError && <ErrorBanner message={transientError} />}

      <main className="app-main">
        {lobbyState.phase === 'lobby' && (
          <Lobby me={me} lobbyState={lobbyState} emit={emit} />
        )}

        {lobbyState.phase === 'choosing' && roundInfo && (
          <ChooseWord
            me={me}
            roundInfo={roundInfo}
            lobbyState={lobbyState}
            choosingProgress={choosingProgress}
            emit={emit}
          />
        )}

        {lobbyState.phase === 'guessing' && roundInfo && wordReady && (
          <GuessScreen
            me={me}
            roundInfo={roundInfo}
            lobbyState={lobbyState}
            myGuessState={myGuessState}
            opponents={opponents}
            emit={emit}
          />
        )}

        {lobbyState.phase === 'round_end' && roundEnded && (
          <RoundResult
            me={me}
            roundEnded={roundEnded}
            lobbyState={lobbyState}
            emit={emit}
          />
        )}

        {lobbyState.phase === 'game_end' && gameEnded && (
          <GameEnd me={me} gameEnded={gameEnded} lobbyState={lobbyState} emit={emit} />
        )}
      </main>
    </div>
  );
}

function CenteredMessage({ title, subtitle, isError }) {
  return (
    <div className="app-shell centered">
      <h1>{title}</h1>
      <p className={isError ? 'error-text' : 'subtitle-text'}>{subtitle}</p>
    </div>
  );
}
