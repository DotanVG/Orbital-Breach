import { Room } from "./room";
import { startWsServer } from "./net/wsServer";

declare const process: {
  env: Record<string, string | undefined>;
};

const PORT = Number(process.env.PORT) || 3001;

const defaultRoom = new Room("default");
defaultRoom.start();

startWsServer(PORT, defaultRoom);

console.log("Orbital Breach server running on port", PORT);
