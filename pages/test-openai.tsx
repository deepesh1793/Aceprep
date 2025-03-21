import { useState } from "react";

export default function TestOpenAI() {
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);

  const testAPI = async () => {
    setLoading(true);
    setResponse("");

    try {
      const res = await fetch("/api/test-openai");
      const data = await res.json();
      setResponse(data.result || "No response");
    } catch (error) {
      setResponse("Error: API request failed");
    }

    setLoading(false);
  };

  return (
    <div style={{ padding: "20px", textAlign: "center" }}>
      <h1>Test OpenAI API Key</h1>
      <button onClick={testAPI} disabled={loading} style={{ padding: "10px", cursor: "pointer" }}>
        {loading ? "Testing..." : "Test API Key"}
      </button>
      {response && <p><strong>Response:</strong> {response}</p>}
    </div>
  );
}
