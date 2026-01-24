import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

function App() {
  const [status, setStatus] = useState("");

  useEffect(() => {
    invoke("check_system_status").then((msg) => {
      setStatus(msg as string);
    });
  }, []);

  return (
    <div className="h-screen w-screen bg-black flex flex-col items-center justify-center text-white font-mono">
      <div className="text-xl">AEGIS V3 - SYSTEM INITIALIZED</div>
      <div className="text-green-600 font-bold mt-2">{status}</div>
    </div>
  );
}

export default App;
