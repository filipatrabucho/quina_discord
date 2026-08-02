# Quina — descobre a palavra

Um jogo multiplayer estilo Wordle/Termo para jogar dentro de uma chamada de
grupo do Discord (Discord Activity). Em vez de uma palavra aleatória, **cada
jogador escolhe, à vez, a palavra secreta de 5 letras** que os restantes
participantes da call têm de adivinhar. Os pontos acumulam-se ronda a ronda:
quem adivinha com menos tentativas ganha mais pontos, e quem escolheu a
palavra ganha um bónus se conseguir "dificultar a vida" aos adversários.

## Estrutura do projeto

```
quina_discord/
├── client/   # Frontend React (Vite) + Discord Embedded App SDK
└── server/   # Backend Node/Express + Socket.IO (estado do jogo em tempo real)
```

Um único processo Node (`server`) serve a API, o WebSocket (Socket.IO) e os
ficheiros estáticos do build do `client` — só precisas de hospedar isto num
sítio para teres a Activity completa.

## Como o jogo funciona

1. Os jogadores da call abrem a Activity e entram na sala de espera (lobby).
2. O anfitrião (primeiro a entrar) escolhe o idioma (PT/EN) e começa o jogo.
3. Em cada ronda, um jogador diferente (à vez) escolhe uma palavra secreta de
   5 letras válida no dicionário. Os restantes jogadores tentam adivinhá-la
   simultaneamente, com até 6 tentativas cada, com feedback letra-a-letra
   (verde = letra certa no sítio certo, amarelo = letra existe noutro sítio,
   cinzento = letra não existe), tal como no Wordle/Termo.
4. Pontuação por ronda: quem acerta ganha mais pontos quanto menos tentativas
   usar (60/50/40/30/20/10 pts), e quem acerta primeiro tem um bónus de +20.
   Quem escolheu a palavra ganha +15 pontos por cada adversário que não
   conseguiu adivinhar.
5. Ao fim de todos os jogadores terem escolhido uma vez, o jogo termina e
   mostra a classificação final.

## Pré-requisitos

- Node.js 18+
- Uma aplicação criada no [Discord Developer Portal](https://discord.com/developers/applications)
  com a funcionalidade **Activities** ativada (só é necessária para correr
  dentro do Discord — dá para testar a lógica do jogo num browser normal sem
  isto, ver secção "Testar sem o Discord").

## Instalação

```bash
npm install   # instala as dependências do client e do server (npm workspaces)
```

## Testar sem o Discord (modo de desenvolvimento local)

Para testar a lógica do jogo rapidamente, sem precisar de configurar nada no
Discord:

```bash
npm run dev:server   # arranca o backend em http://localhost:3001
npm run dev:client   # noutro terminal: arranca o Vite em http://localhost:5173
```

Abre `http://localhost:5173` em duas abas (ou dois browsers) diferentes,
entra com o mesmo "código da sala" em ambas para simular dois jogadores, e
joga normalmente. Fora do Discord a app entra automaticamente neste modo
(deteta que não está dentro do iframe da Activity).

Também há testes automáticos à lógica do jogo (validação de palavras, cálculo
do feedback estilo Wordle, rotação de rondas, pontuação):

```bash
npm test
```

## Configurar a Activity no Discord Developer Portal

1. Cria uma aplicação em https://discord.com/developers/applications (ou usa
   uma existente).
2. No menu lateral, vai a **Activities → Settings** e ativa "Enable Activities".
3. Em **OAuth2 → General**, copia o **Client ID** e gera/copia o **Client
   Secret**. Vais precisar destes valores nas variáveis de ambiente.
4. Em **Activities → URL Mappings**, define o mapeamento raiz (`/`) para o
   domínio onde vais hospedar este projeto (ver secção seguinte). É este
   mapeamento que faz o proxy `https://<app_id>.discordsays.com/...` para o
   teu servidor — o pedido `/api/token`, os assets do client e o WebSocket do
   Socket.IO passam todos por aqui, por isso um único mapeamento na raiz
   chega.
5. Em **OAuth2 → Redirects**, não é necessário adicionar um redirect URI
   normal — o fluxo de autorização das Activities faz-se via
   `discordSdk.commands.authorize()` dentro do SDK, tratado em
   `client/src/discordSdk.js`.
6. Para testar dentro do próprio Discord durante o desenvolvimento local,
   usa um túnel HTTPS (por exemplo `cloudflared tunnel --url http://localhost:3001`
   ou `ngrok http 3001`) e aponta o URL Mapping para esse túnel enquanto
   testas. Nota: corre o client já com `npm run build` (ou o server já a
   servir o build) para testar dentro do Discord, porque o proxy da Activity
   só mapeia um domínio de cada vez.

## Variáveis de ambiente

Copia os ficheiros de exemplo e preenche com os teus valores:

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

`server/.env`:
```
PORT=3001
DISCORD_CLIENT_ID=...       # Client ID da tua app no Discord Developer Portal
DISCORD_CLIENT_SECRET=...   # Client Secret da tua app (nunca expor no frontend)
```

`client/.env`:
```
VITE_DISCORD_CLIENT_ID=...  # o mesmo Client ID (este é público, vai para o browser)
```

## Build e deployment em produção

```bash
npm run build   # gera client/dist
npm start       # arranca o server, que serve a API + Socket.IO + client/dist
```

Podes hospedar isto em qualquer plataforma que corra um processo Node
persistente com WebSockets (por exemplo Fly.io, Render, Railway, ou uma VM
normal). Depois de teres um domínio HTTPS estável, atualiza o **URL Mapping**
no Discord Developer Portal para apontar para esse domínio — a partir daí a
Activity está pronta a usar-se em qualquer chamada de grupo do Discord.

## Notas técnicas

- As listas de palavras (`server/src/data/words_pt.json` e `words_en.json`)
  contêm ~9 mil palavras portuguesas e ~15 mil inglesas de 5 letras, usadas
  tanto para validar a palavra escolhida pelo "chooser" como as tentativas
  dos adivinhadores.
- A comparação de letras ignora acentuação (`normalize()` em
  `server/src/game/wordUtils.js`), para não obrigar os jogadores a escrever
  acentos em teclados/mobile — a palavra revelada no fim da ronda mantém a
  ortografia correta.
- O estado do jogo vive em memória no processo do servidor (`GameRoom` /
  `RoomManager`), por sala (`roomId` = `instanceId` da Activity do Discord).
  Reiniciar o servidor perde as partidas em curso — não há persistência em
  base de dados, o que é adequado para partidas casuais de uma sessão de
  chamada.
