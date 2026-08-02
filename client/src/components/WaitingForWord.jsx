export default function WaitingForWord({ roundInfo, lobbyState }) {
  const chooser = lobbyState.players.find((p) => p.id === roundInfo.chooserId);
  return (
    <div className="panel centered">
      <h2>{chooser?.username ?? 'Alguém'} está a escolher a palavra...</h2>
      <p className="subtitle-text">Prepara-te para adivinhar assim que a palavra estiver pronta.</p>
    </div>
  );
}
