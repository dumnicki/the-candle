import { startRoom } from "./room.js";
import "./ui/styles.css";

const app = document.querySelector<HTMLElement>("#app");
if (!app) throw new Error("Missing #app");

startRoom({ root: app });
