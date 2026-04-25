import { useState } from "react";
import "./App.css";

function App() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);

  const generateExtension = async () => {
    if (!prompt) {
      alert("Please enter something");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("http://localhost:3000/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ prompt })
      });

      if (!response.ok) {
        throw new Error("Server error");
      }

      // 🔥 IMPORTANT: use arrayBuffer (no corruption)
      const buffer = await response.arrayBuffer();

      const blob = new Blob([buffer], {
        type: "application/zip"
      });

      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "extension.zip";
      document.body.appendChild(a);
      a.click();

      // cleanup
      a.remove();
      window.URL.revokeObjectURL(url);

    } catch (err) {
      console.error(err);
      alert("Error generating extension");
    }

    setLoading(false);
  };

  return (
    <div className="app">
      <h1>🚀 Extensio.ai</h1>

      <p className="subtitle">
        Turn your ideas into Chrome Extensions instantly
      </p>

      <div className="card">
        <input
          type="text"
          placeholder="e.g. Change text color to green"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />

        <button onClick={generateExtension}>
          {loading ? "Generating..." : "Generate Extension"}
        </button>
      </div>
    </div>
  );
}

export default App;