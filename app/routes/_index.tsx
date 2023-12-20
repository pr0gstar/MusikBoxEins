import type { MetaFunction } from "@remix-run/node";
import { useEffect } from "react";

import { useSocket } from "~/context";

export const meta: MetaFunction = () => {
  return [
    { title: "New Remix App" },
    { name: "description", content: "Welcome to Remix!" },
  ];
};

export default function Index() {
  const socket = useSocket();

  useEffect(() => {
    if (!socket) return;

    socket.on("event", (data) => {
      console.log(data);
    });

    socket.emit("event", "ping");
  }, [socket]);

  return (
    <div
      style={{
        fontFamily: "system-ui, sans-serif",
        lineHeight: "1.8",
        textAlign: "center",
      }}
    >
      <h1>Willkommen auf dem Webinterface der MusikBoxEins 💃🏻📻</h1>
      <p>
        Hier entsteht irgendwann das Webinterface aber bisher wird es nur für
        die Entwicklung genutzt!
      </p>
      <button type="button" onClick={() => socket?.emit("event", "ping")}>
        Send ping
      </button>
    </div>
  );
}
