# Quina — descobre a palavra

Um jogo multiplayer estilo Wordle/Termo para jogar dentro de uma chamada de
grupo do Discord (Discord Activity). Em vez de uma palavra aleatória, **todos
os jogadores escolhem, ao mesmo tempo, uma palavra secreta de 5 letras** para
o jogador seguinte na roda adivinhar — e depois todos adivinham a sua palavra
em simultâneo, vendo o progresso uns dos outros ao vivo. Os pontos acumulam-se
ronda a ronda (com rotação da atribuição de pares a cada ronda), e cada
jogador tem um perfil com XP e nível que persiste entre partidas.

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
2. O anfitrião (primeiro a entrar) escolhe o idioma (PT/EN) e o número de
   rondas, e começa o jogo.
3. Em cada ronda, cada jogador é emparelhado em "roda" com outro (A escolhe
   para B, B escolhe para C, ..., o último escolhe para o primeiro) — essa
   atribuição roda a cada ronda para variar os pares. **Todos escolhem a sua
   palavra ao mesmo tempo** (5 letras, válida no dicionário), e assim que
   todos submeterem, **todos adivinham em simultâneo** a palavra que lhes foi
   escolhida, com até 6 tentativas cada, vendo o progresso (não as letras) dos
   outros jogadores ao vivo. Feedback letra-a-letra (verde = letra certa no
   sítio certo, amarelo = letra existe noutro sítio, cinzento = letra não
   existe), tal como no Wordle/Termo.
4. Pontuação por ronda: quem acerta ganha mais pontos quanto menos tentativas
   usar (60/50/40/30/20/10 pts), e quem acerta primeiro tem um bónus de +20.
   Quem escolheu uma palavra que o adversário não conseguiu adivinhar ganha
   +15 pontos de bónus.
5. Ao fim do número de rondas configurado, o jogo termina, mostra a
   classificação final e atribui XP permanente a cada jogador (a pontuação da
   partida soma-se ao XP acumulado do seu perfil, com nível e uma
   classificação global acessível pelo avatar no topo do ecrã).

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
normal). **Netlify não serve** — é hosting de sites estáticos/funções sem
estado, e este projeto precisa de um processo Node persistente (para manter o
WebSocket do Socket.IO ligado e o endpoint `/api/token` com o client secret).
Depois de teres um domínio HTTPS estável, atualiza o **URL Mapping** no
Discord Developer Portal para apontar para esse domínio — a partir daí a
Activity está pronta a usar-se em qualquer chamada de grupo do Discord, sem
precisares de túneis nem de mudar o link outra vez.

### Deploy no Render (recomendado, gratuito para começar)

O repositório já inclui um `render.yaml` (Blueprint) que configura tudo
automaticamente:

1. Garante que o código está num repositório GitHub (o Render liga-se
   diretamente ao GitHub).
2. Cria conta em https://render.com e liga a tua conta GitHub.
3. **New +** → **Blueprint** → escolhe este repositório. O Render deteta o
   `render.yaml` e propõe criar o serviço `quina-discord` automaticamente
   (comando de build `npm install && npm run build`, comando de arranque
   `npm start`).
4. Antes de confirmares o deploy, preenche as 3 variáveis de ambiente pedidas
   (o `render.yaml` marca-as como secretas, por isso tens de as inserir
   manualmente no dashboard):
   - `DISCORD_CLIENT_ID` e `VITE_DISCORD_CLIENT_ID` — o Application ID da tua
     app no Discord Developer Portal (o mesmo valor nas duas).
   - `DISCORD_CLIENT_SECRET` — o Client Secret da aba OAuth2.
5. Cria o serviço. Ao fim do primeiro deploy tens um URL fixo tipo
   `https://quina-discord.onrender.com` — usa-o no **URL Mapping** das
   Activities no Discord Developer Portal.
6. Volta a fazer deploy sempre que fizeres `git push` para o branch ligado ao
   Render (o próprio Render faz isso automaticamente a cada push).

Duas notas importantes sobre o plano gratuito do Render:
- **"Adormece" com inatividade**: sem pedidos há uns minutos, o serviço
  hiberna e demora ~30-60s a "acordar" no pedido seguinte — o primeiro amigo a
  abrir a Activity depois de uma pausa pode ver um ecrã em branco por um
  bocado antes de carregar. Isto desaparece no plano pago (Starter).
- **Disco não persistente**: o ficheiro de XP dos jogadores
  (`server/src/data/players.json`) vive dentro do próprio serviço, e o plano
  gratuito não tem disco persistente — cada novo deploy (`git push`) reinicia
  o XP de todos a zero. Se isto for importante, considera o Fly.io (tem
  volumes persistentes gratuitos) ou o disco persistente pago do Render.

## Notas técnicas

- As listas de palavras (`server/src/data/words_pt.json` e `words_en.json`)
  contêm ~9 mil palavras portuguesas e ~15 mil inglesas de 5 letras, usadas
  tanto para validar a palavra escolhida pelo "chooser" como as tentativas
  dos adivinhadores.
- A comparação de letras ignora acentuação (`normalize()` em
  `server/src/game/wordUtils.js`), para não obrigar os jogadores a escrever
  acentos em teclados/mobile — a palavra revelada no fim da ronda mantém a
  ortografia correta.
- O estado de cada partida em curso vive em memória no processo do servidor
  (`GameRoom` / `RoomManager`), por sala (`roomId` = `instanceId` da Activity
  do Discord). Reiniciar o servidor perde as partidas em curso, mas não afeta
  o XP dos jogadores (ver ponto seguinte).
- O XP/nível de cada jogador é persistido em `server/src/data/players.json`
  (`server/src/persistence/playerStore.js`), indexado pelo id de Discord do
  jogador. Este ficheiro é criado automaticamente e está no `.gitignore` — não
  precisas de configurar nenhuma base de dados externa. Para reiniciar todo o
  histórico de XP, basta apagar esse ficheiro.
