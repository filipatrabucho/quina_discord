import { io } from 'socket.io-client';

let socketInstance = null;

// Same-origin connection: in Discord this goes through the Activity's
// `/.proxy/` URL mapping automatically because we don't hardcode a host;
// in local dev the Vite proxy forwards it to the Node server.
export function getSocket() {
  if (!socketInstance) {
    socketInstance = io({
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      autoConnect: false,
    });
  }
  return socketInstance;
}
