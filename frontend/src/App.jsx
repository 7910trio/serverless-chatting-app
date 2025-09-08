import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Send, PlugZap, Plug, Loader2, Hash, User, WifiOff } from "lucide-react";

/**
 * Serverless Chat – React SPA
 * ------------------------------------------------------
 * Drop-in front-end for an AWS serverless chat stack.
 *
 * ✅ Works on S3 + CloudFront (pure static assets)
 * ✅ REST for history
 * ✅ WebSocket for realtime
 * ✅ Anonymous nickname (localStorage) – easy to swap with Cognito later
 * ✅ Simple, pretty UI with Tailwind
 *
 * Replace CONFIG below before deploying.
 */

// ------------------ CONFIG ------------------
const CONFIG = {
  // REST API base URL (API Gateway REST stage URL)
  REST_BASE_URL: import.meta.env.VITE_REST_URL,
  // WebSocket URL (API Gateway WebSocket URL)
  WS_URL: import.meta.env.VITE_WS_URL + "$default",
  // Default room
  DEFAULT_ROOM_ID: "general",
  // History page size
  HISTORY_LIMIT: 50,
  // Optional: attach JWT (e.g., Cognito) to requests
  getAuthToken: async () => {
    // If you use Cognito Hosted UI + localStorage/sessionStorage, read the token here.
    // return window.localStorage.getItem("access_token") ?? null;
    return null; // Anonymous by default
  },
};

// Rest API 요청 헤더를 만드는 함수
// JWT 토큰이 있다면 Authorization 헤더에 Bearer 토큰을 추가
async function buildAuthHeaders() {
  const token = await CONFIG.getAuthToken();
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

// 상태 useSatate 와 localStorage를 연결하는 커스텀 훅
// 초기값이 없으면 localStorage에서 읽고, 변경 시 localStorage에 저장
function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    const cached = localStorage.getItem(key);
    return cached ? JSON.parse(cached) : initialValue;
  });
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);
  return [value, setValue];
}

// Tailwind class 문자열을 조건부로 합치는 함수
function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

export default function App() {
  const query = new URLSearchParams(window.location.search);
  const urlRoomId = query.get("roomId");

  const [roomId, setRoomId] = useLocalStorage(
    "roomId", 
    urlRoomId || CONFIG.DEFAULT_ROOM_ID
  );
  
  const [nickname, setNickname] = useLocalStorage("nickname", "guest" + Math.floor(Math.random() * 1000));
  const [messages, setMessages] = useState([]); // 채팅 메시지 목록
  const [connecting, setConnecting] = useState(false); // WebSocket 연결 상태
  const [connected, setConnected] = useState(false); // WebSocket 연결 상태
  const [text, setText] = useState(""); // 입력 메시지

  const wsRef = useRef(null); // WebSocket 객체 참조
  const reconnectRef = useRef({ attempts: 0, timer: null }); // 재연결 시도 횟수 및 타이머
  const listEndRef = useRef(null); // 메시지 리스트 끝에 스크롤 이동

  const restBase = CONFIG.REST_BASE_URL.replace(/\/$/, "");
  const wsUrl = CONFIG.WS_URL;

  // Auto-scroll to newest
  // 메시지 추가될 때마다 자동으로 스크롤 이동
  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Fetch history when room changes
  // REST API로 과거 메시지 불러오기
  useEffect(() => {
    (async () => {
      try {
        const headers = await buildAuthHeaders();
        const url = `${restBase}/rooms/${encodeURIComponent(roomId)}/messages?limit=${CONFIG.HISTORY_LIMIT}`;
        const res = await fetch(url, { headers });
        if (!res.ok) throw new Error(`History fetch failed: ${res.status}`);
        const data = await res.json();
        // Expecting array sorted ASC by timestamp
        setMessages(data || []);
      } catch (e) {
        console.error(e);
      }
    })();
  }, [roomId, restBase]);

  // Open WebSocket + reconnect with backoff
  // WebSocket 연결 및 재연결 로직
  useEffect(() => {
    let ws;
    let cancelled = false; // cleanup 이후 작업 차단용

    // 방 변경 시 기존 메시지 초기화 후 새로 불러오기
    setMessages([]);

    const open = async () => {
      // 안전 체크: 이미 열려 있다면 새로 열지 않음
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;

      setConnecting(true);
      const token = await CONFIG.getAuthToken();
      const url = token ? `${wsUrl}?auth=${encodeURIComponent(token)}` : wsUrl;

      if (cancelled) return; // cleanup 이후라면 중단

      try {
        ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
          setConnecting(false);
          setConnected(true);
          reconnectRef.current.attempts = 0;
          // Join current room (server Lambda can treat this as a subscribe action)
          ws.send(JSON.stringify({ action: "join", roomId, nickname }));
        };

        ws.onmessage = (ev) => {
          try {
            const data = JSON.parse(ev.data);
            console.log("받은 메시지:", data);

            let newMessages = [];

            if (Array.isArray(data)) {
              newMessages = data;
            } else if (data.items && Array.isArray(data.items)) {
              newMessages = data.items;
            } else if (data.message) {
              // 단일 메시지만 온 경우
              newMessages = [data.message];
            } else {
              console.warn("⚠️ 알 수 없는 데이터 형식:", data);
            }

            // 기존 메시지 + 새 메시지
            setMessages((prev) => [...prev, ...newMessages]);
          } catch (e) {
            console.warn("Non-JSON frame", ev.data);
          }
        };

        ws.onclose = () => {
          setConnected(false);
          scheduleReconnect();
        };

        ws.onerror = () => {
          setConnected(false);
          ws.close();
        };
      } catch (err) {
        console.error("Failed to open websocket:", err);
        if (!cancelled) scheduleReconnect();
      }
    };

      const scheduleReconnect = () => {
        if (cancelled) return;
        if (reconnectRef.current.timer) return;
        const attempt = ++reconnectRef.current.attempts;
        const delay = Math.min(30000, 1000 * Math.pow(2, attempt)); // exp backoff up to 30s
        reconnectRef.current.timer = setTimeout(() => {
          reconnectRef.current.timer = null;
          open();
        }, delay);
      };

      open();

      return () => {
        cancelled = true;
        if (reconnectRef.current.timer) {
          clearTimeout(reconnectRef.current.timer);
          reconnectRef.current.timer = null;
        }
        try {
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            // 시도: 서버에 leave 알림 (있으면 처리)
            wsRef.current.send(JSON.stringify({ action: "leave", roomId }));
          }
      } catch (e) {
        // 무시: 이미 닫혔거나 전송 불가
      }
      wsRef.current?.close();
    };
  }, [roomId, nickname, wsUrl]);

  const connectionBadge = useMemo(() => {
    if (connected)
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-emerald-100 text-emerald-700">
          <PlugZap className="w-3 h-3" /> Connected
        </span>
      );
    if (connecting)
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-amber-100 text-amber-700">
          <Loader2 className="w-3 h-3 animate-spin" /> Connecting
        </span>
      );
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-rose-100 text-rose-700">
        <WifiOff className="w-3 h-3" /> Disconnected
      </span>
    );
  }, [connected, connecting]);

  // Send message via WebSocket
  // 메시지 전송 
  async function sendMessage() {
    const trimmed = text.trim();
    if (!trimmed || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    const payload = { action: "sendMessage", roomId, text: trimmed, nickname };
    wsRef.current.send(JSON.stringify(payload));
    setText("");
  }

  function onEnter(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 text-slate-800">
      <div className="mx-auto max-w-3xl px-4 py-6">
        <header className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Hash className="w-5 h-5" />
            <h1 className="text-xl font-semibold">Serverless Chat</h1>
          </div>
          <div className="flex items-center gap-3">
            {connectionBadge}
            <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 shadow">
              <User className="w-4 h-4" />
              <input
                className="outline-none bg-transparent text-sm"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={20}
                placeholder="nickname"
              />
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4">
          {/* Sidebar */}
          <aside className="bg-white rounded-2xl shadow p-4 h-fit">
            <div className="text-sm font-medium mb-2">Room</div>
            <div className="flex gap-2">
              <input
                className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value.replace(/\s/g, "-"))}
                placeholder="general"
              />
            </div>
            <p className="mt-2 text-xs text-slate-500">Type a room ID to join/create.</p>
            <div className="mt-4 text-xs text-slate-500">
              REST: {CONFIG.REST_BASE_URL ? "configured" : "missing"} · WS: {CONFIG.WS_URL ? "configured" : "missing"}
            </div>
          </aside>

          {/* Chat Panel */}
          <main className="bg-white rounded-2xl shadow p-0 overflow-hidden">
            <div className="h-[70vh] flex flex-col">
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {messages.length === 0 && (
                  <div className="text-center text-sm text-slate-500 mt-10">No messages yet. Say hi 👋</div>
                )}
                {messages.map((m, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={classNames(
                      "max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow",
                      m.type === "system"
                        ? "mx-auto bg-slate-100 text-slate-600"
                        : m.nickname === nickname
                        ? "ml-auto bg-indigo-600 text-white"
                        : "mr-auto bg-slate-200"
                    )}
                    title={new Date(m.timestamp || Date.now()).toLocaleString()}
                  >
                    {m.type !== "system" && (
                      <div className="text-[10px] opacity-70 mb-0.5">{m.nickname || "anon"}</div>
                    )}
                    <div className="whitespace-pre-wrap break-words">{m.text}</div>
                  </motion.div>
                ))}
                <div ref={listEndRef} />
              </div>

              {/* Composer */}
              <div className="border-t p-3 bg-white">
                <div className="flex items-end gap-2">
                  <textarea
                    className="flex-1 resize-none rounded-2xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 max-h-40"
                    rows={2}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={onEnter}
                    placeholder="Type a message…"
                  />
                  <button
                    onClick={sendMessage}
                    className={classNames(
                      "rounded-2xl px-4 py-2 text-sm font-medium shadow inline-flex items-center gap-2",
                      connected ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-500 cursor-not-allowed"
                    )}
                    disabled={!connected || !text.trim()}
                    title={connected ? "Send" : "WebSocket not connected"}
                  >
                    <Send className="w-4 h-4" /> Send
                  </button>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>

      <footer className="text-center text-xs text-slate-400 py-4">
        S3 + CloudFront · API Gateway (REST+WS) · Lambda · DynamoDB
      </footer>
    </div>
  );
}
