import express from 'express';
import { store } from '../data.js';
import { Server as SocketIOServer } from 'socket.io';
import http from 'http';
import { setEngines } from '../main.js';

const app = express();
export const httpServer = http.createServer(app);
const io = new SocketIOServer(httpServer, { serveClient: false });

app.get('/gps', (req, res) => {
  res.json({
    gps: store.position.latest(),
  });
});

app.get('/', (req, res) => {
  res.sendFile('/home/pi/rover/static/index.html');
});

io.on('connection', (socket) => {
  console.log('Connnected with socket: ', socket.id);

  store.position.subscribe(() => {
    socket.emit('position', store.position.latest());
  });

  store.heading.subscribe(() => {
    socket.emit('heading', store.heading.latest());
  });

  socket.on('control', ({ left, right }: { left: number; right: number }) => {
    setEngines(left, right);
  });

  socket.on('disconnect', () => {
    setEngines(0, 0);
  });
});
