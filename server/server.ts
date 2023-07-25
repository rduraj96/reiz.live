import http from "http";
import express from "express";
import { Server, Socket } from "socket.io";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

type Playlist = {
  title: string;
  url: string;
};

let connectedUsers: string[] = [];

io.on("connection", (socket: Socket) => {
  console.log(`Socket connected: ${socket.id}`);
  connectedUsers.push(socket.id);
  io.emit("connected-users", connectedUsers);

  socket.on("listener-ready", () => {
    socket.broadcast.emit("get-audio-state");
  });

  socket.on("audio-state", (state) => {
    console.log("Received state: ", state);
    socket.broadcast.emit("audio-state-from-server", state);
  });

  socket.on("play", () => {
    io.emit("play");
  });

  socket.on("pause", () => {
    io.emit("pause");
  });

  socket.on("track-change", (nextTrackIndex) => {
    io.emit("track-change", nextTrackIndex);
  });

  socket.on("seek", (time: number) => {
    socket.broadcast.emit("seek", time);
  });

  socket.on("disconnect", () => {
    console.log("A user disconnected:", socket.id);
    connectedUsers = connectedUsers.filter((user) => user !== socket.id);
    io.emit("connected-users", connectedUsers);
  });
});

server.listen(3001, () => {
  console.log(`🍆 Server listening on port 3001`);
});
