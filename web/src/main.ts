import { startRoom } from "./room";
import "./styles.css";

const app = document.querySelector<HTMLElement>("#app");
if (!app) throw new Error("Missing #app");

startRoom({ root: app });
