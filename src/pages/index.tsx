import { useState } from "react";

export default function Home() {
  const [isConnected, setIsConnected] = useState(false);

  const connectToDevice = async () => {
    try {
      const response = await fetch("/api/bluetooth");
      const data = await response.json();
      console.log(data.message);
      setIsConnected(true);
    } catch (error) {
      console.error("Failed to connect to device", error);
    }
  };

  return (
    <div>
      <h1>Wearable Data Platform</h1>
      <button onClick={connectToDevice}>
        {isConnected ? "Connected" : "Connect to Wearable"}
      </button>
    </div>
  );
}
