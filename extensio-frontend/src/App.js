import { useState, useEffect } from "react";
import "./App.css";

function App() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [editedFrom, setEditedFrom] = useState(null);

  //  Load history from backend
  const loadHistory = async () => {
    try {
      const res = await fetch("http://localhost:3000/history");
      const data = await res.json();
      setHistory(data);
    } catch (err) {
      console.error("Error loading history:", err);
    }
  };

  //  Load once on startup
  useEffect(() => {
    loadHistory();
  }, []);
  //  Handle "Edit" button click
  const handleEdit = (oldPrompt) => {
    setPrompt(oldPrompt);   // fill input box
    window.scrollTo({ top: 0, behavior: "smooth" }); // optional UX
  };

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
        body: JSON.stringify({ 
          prompt,
          editedFrom
        })
      });

      if (!response.ok) {
        throw new Error("Server error");
      }

      const buffer = await response.arrayBuffer();
      const blob = new Blob([buffer], { type: "application/zip" });

      const url = window.URL.createObjectURL(blob);

      // Download ZIP
      const a = document.createElement("a");
      a.href = url;
      a.download = "extension.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();

      window.URL.revokeObjectURL(url);

      //  Refresh history after generation
      await loadHistory();

      setPrompt("");
      setEditedFrom(null);

    } catch (err) {
      console.error(err);
      alert("Error generating extension");
    }

    setLoading(false);
  };

  return (
    <div className="app">
      <div className="header">
        <h1>🚀 Extensio.ai</h1>

        <button
          className="history-btn"
          onClick={() => setShowHistory(!showHistory)}
        >
          {showHistory ? "Hide History" : "Show History"}
        </button>
      </div>

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

      {/*  HISTORY SECTION */}
      {showHistory && (
        <div className="history">
          <h2>Previous Extensions</h2>

          {history.length === 0 ? (
            <p>No history yet</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Prompt</th>
                  <th>Edit Request</th>
                  <th>Download</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item, index) => (
                  <tr key={index}>
                    <td>{item.prompt}</td>

                    <td>
                      <button
                        className="edit-btn"
                        onClick={() => handleEdit(item.prompt)}
                      >
                        Edit
                      </button>
                    </td>

                    <td>
                      <a
                        className="download-btn"
                        href={`http://localhost:3000${item.zipPath}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Download
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

export default App;