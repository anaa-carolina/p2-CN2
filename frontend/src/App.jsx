import { useState } from "react";

export default function App() {
  const [saJson, setSaJson] = useState("");
  const [folderId, setFolderId] = useState("");
  const [connStr, setConnStr] = useState("");
  const [container, setContainer] = useState("");
  const [driveFiles, setDriveFiles] = useState([]);
  const [blobFiles, setBlobFiles] = useState([]);
  const [selected, setSelected] = useState([]);
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({ total: 0, ok: 0, err: 0 });

  const addLog = (msg, color = "#888") => {
    const ts = new Date().toLocaleTimeString("pt-BR");
    setLogs((l) => [...l, { ts, msg, color }]);
  };

  const listDrive = async () => {
    let creds;
    try {
      creds = JSON.parse(saJson);
    } catch {
      alert("JSON inválido");
      return;
    }
    addLog("Listando arquivos no Google Drive...", "#60a5fa");
    try {
      const res = await fetch("/api/list-drive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          credentials: creds,
          folder_id: folderId || "root",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDriveFiles(data.files);
      setSelected(data.files.map((f) => f.id));
      addLog(`✅ ${data.files.length} arquivo(s) encontrado(s)`, "#34d469");
    } catch (e) {
      addLog(`❌ ${e.message}`, "#f87171");
    }
  };

  const listBlob = async () => {
    addLog(`Listando blobs em "${container}"...`, "#60a5fa");
    try {
      const res = await fetch("/api/list-blob", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connection_string: connStr,
          container_name: container,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setBlobFiles(data.files);
      addLog(`✅ ${data.files.length} blob(s) encontrado(s)`, "#34d469");
    } catch (e) {
      addLog(`❌ ${e.message}`, "#f87171");
    }
  };

  const migrate = async () => {
    let creds;
    try {
      creds = JSON.parse(saJson);
    } catch {
      alert("JSON inválido");
      return;
    }
    addLog(`Iniciando migração de ${selected.length} arquivo(s)...`, "#60a5fa");
    try {
      const res = await fetch("/api/migrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          credentials: creds,
          folder_id: folderId || "root",
          connection_string: connStr,
          container_name: container,
          file_ids: selected,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setStats({ total: data.total, ok: data.transferred, err: data.errors });
      data.results.forEach((r) => {
        if (r.status === "success") addLog(`✅ ${r.file}`, "#34d469");
        else if (r.status === "error")
          addLog(`❌ ${r.file} — ${r.reason}`, "#f87171");
        else addLog(`⚠️ ${r.file} — ${r.reason}`, "#fbbf24");
      });
      await listBlob();
    } catch (e) {
      addLog(`❌ Falha: ${e.message}`, "#f87171");
    }
  };

  return (
    <div
      style={{
        background: "#0a0a0f",
        minHeight: "100vh",
        color: "#e0e0f0",
        fontFamily: "sans-serif",
        padding: "24px",
      }}
    >
      <h1 style={{ marginBottom: "24px" }}>⇄ DriveSync</h1>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "320px 1fr",
          gap: "24px",
        }}
      >
        {/* Coluna esquerda */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div
            style={{
              background: "#111118",
              border: "1px solid #2a2a3a",
              borderRadius: "8px",
              padding: "16px",
            }}
          >
            <h3 style={{ color: "#34a853", marginBottom: "12px" }}>
              🟢 Google Drive
            </h3>
            <label style={{ fontSize: "11px", color: "#888" }}>
              SERVICE ACCOUNT JSON
            </label>
            <textarea
              value={saJson}
              onChange={(e) => setSaJson(e.target.value)}
              placeholder='{"type":"service_account",...}'
              style={{
                width: "100%",
                minHeight: "80px",
                background: "#1a1a24",
                border: "1px solid #2a2a3a",
                color: "#e0e0f0",
                borderRadius: "6px",
                padding: "8px",
                marginTop: "4px",
                boxSizing: "border-box",
              }}
            />
            <label
              style={{
                fontSize: "11px",
                color: "#888",
                display: "block",
                marginTop: "8px",
              }}
            >
              FOLDER ID
            </label>
            <input
              value={folderId}
              onChange={(e) => setFolderId(e.target.value)}
              placeholder="root ou ID da pasta"
              style={{
                width: "100%",
                background: "#1a1a24",
                border: "1px solid #2a2a3a",
                color: "#e0e0f0",
                borderRadius: "6px",
                padding: "8px",
                marginTop: "4px",
                boxSizing: "border-box",
              }}
            />
            <button
              onClick={listDrive}
              style={{
                marginTop: "12px",
                width: "100%",
                background: "#34a853",
                color: "#000",
                border: "none",
                borderRadius: "6px",
                padding: "8px",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              ▶ Listar Arquivos
            </button>
          </div>

          <div
            style={{
              background: "#111118",
              border: "1px solid #2a2a3a",
              borderRadius: "8px",
              padding: "16px",
            }}
          >
            <h3 style={{ color: "#0089d6", marginBottom: "12px" }}>
              🔵 Azure Blob
            </h3>
            <label style={{ fontSize: "11px", color: "#888" }}>
              CONNECTION STRING
            </label>
            <textarea
              value={connStr}
              onChange={(e) => setConnStr(e.target.value)}
              placeholder="BlobEndpoint=https://..."
              style={{
                width: "100%",
                minHeight: "70px",
                background: "#1a1a24",
                border: "1px solid #2a2a3a",
                color: "#e0e0f0",
                borderRadius: "6px",
                padding: "8px",
                marginTop: "4px",
                boxSizing: "border-box",
              }}
            />
            <label
              style={{
                fontSize: "11px",
                color: "#888",
                display: "block",
                marginTop: "8px",
              }}
            >
              CONTAINER
            </label>
            <input
              value={container}
              onChange={(e) => setContainer(e.target.value)}
              placeholder="Aluno_SeuNome"
              style={{
                width: "100%",
                background: "#1a1a24",
                border: "1px solid #2a2a3a",
                color: "#e0e0f0",
                borderRadius: "6px",
                padding: "8px",
                marginTop: "4px",
                boxSizing: "border-box",
              }}
            />
            <button
              onClick={listBlob}
              style={{
                marginTop: "12px",
                width: "100%",
                background: "#0089d6",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                padding: "8px",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              ▶ Listar Container
            </button>
          </div>

          <button
            onClick={migrate}
            disabled={selected.length === 0}
            style={{
              width: "100%",
              background:
                selected.length > 0
                  ? "linear-gradient(135deg, #34a853, #0089d6)"
                  : "#1a1a24",
              color: selected.length > 0 ? "#fff" : "#444",
              border: "none",
              borderRadius: "8px",
              padding: "14px",
              cursor: selected.length > 0 ? "pointer" : "not-allowed",
              fontWeight: "bold",
              fontSize: "14px",
            }}
          >
            ⇄ INICIAR MIGRAÇÃO
          </button>
        </div>

        {/* Coluna direita */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div
            style={{
              background: "#111118",
              border: "1px solid #2a2a3a",
              borderRadius: "8px",
              padding: "16px",
            }}
          >
            <h3 style={{ color: "#34a853", marginBottom: "12px" }}>
              Arquivos no Google Drive ({driveFiles.length})
            </h3>
            {driveFiles.length === 0 ? (
              <p style={{ color: "#555", fontSize: "12px" }}>
                Nenhum arquivo listado.
              </p>
            ) : (
              driveFiles.map((f) => (
                <div
                  key={f.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "6px 0",
                    borderBottom: "1px solid #1a1a24",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(f.id)}
                    onChange={() =>
                      setSelected((s) =>
                        s.includes(f.id)
                          ? s.filter((x) => x !== f.id)
                          : [...s, f.id],
                      )
                    }
                  />
                  <span style={{ fontSize: "13px" }}>{f.name}</span>
                  <span
                    style={{
                      fontSize: "11px",
                      color: "#555",
                      marginLeft: "auto",
                    }}
                  >
                    {f.mimeType?.split("/").pop()}
                  </span>
                </div>
              ))
            )}
          </div>

          <div
            style={{
              background: "#111118",
              border: "1px solid #2a2a3a",
              borderRadius: "8px",
              padding: "16px",
            }}
          >
            <h3 style={{ color: "#0089d6", marginBottom: "12px" }}>
              Arquivos no Azure Blob ({blobFiles.length})
            </h3>
            {blobFiles.length === 0 ? (
              <p style={{ color: "#555", fontSize: "12px" }}>
                Nenhum blob listado.
              </p>
            ) : (
              blobFiles.map((f) => (
                <div
                  key={f.name}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "6px 0",
                    borderBottom: "1px solid #1a1a24",
                  }}
                >
                  <span style={{ fontSize: "13px" }}>{f.name}</span>
                  <span
                    style={{
                      fontSize: "11px",
                      color: "#555",
                      marginLeft: "auto",
                    }}
                  >
                    {f.size} bytes
                  </span>
                </div>
              ))
            )}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3,1fr)",
              gap: "12px",
            }}
          >
            {[
              ["Total", stats.total, "#e0e0f0"],
              ["Sucesso", stats.ok, "#34d469"],
              ["Erros", stats.err, "#f87171"],
            ].map(([label, val, color]) => (
              <div
                key={label}
                style={{
                  background: "#111118",
                  border: "1px solid #2a2a3a",
                  borderRadius: "8px",
                  padding: "12px",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: "28px", fontWeight: "bold", color }}>
                  {val}
                </div>
                <div style={{ fontSize: "11px", color: "#888" }}>{label}</div>
              </div>
            ))}
          </div>

          <div
            style={{
              background: "#07070d",
              border: "1px solid #1a1a2e",
              borderRadius: "8px",
              padding: "12px",
              height: "200px",
              overflowY: "auto",
              fontFamily: "monospace",
              fontSize: "12px",
            }}
          >
            {logs.length === 0 && (
              <span style={{ color: "#333" }}># Aguardando início...</span>
            )}
            {logs.map((l, i) => (
              <div key={i}>
                <span style={{ color: "#333" }}>[{l.ts}]</span>{" "}
                <span style={{ color: l.color }}>{l.msg}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
