import React, { useEffect, useRef, useState } from 'react';

const CHATBOT_TOKEN = process.env.REACT_APP_CHATBOT_TOKEN || '200';

function ChatbotWidget() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const send = async () => {
    const trimmed = message.trim();
    if (!trimmed || streaming) return;

    setMessages((prev) => [...prev, { role: 'user', text: trimmed }]);
    setMessage('');
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const resp = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Token': CHATBOT_TOKEN,
        },
        body: JSON.stringify({ message: trimmed }),
        signal: controller.signal,
      });

      if (!resp.ok || !resp.body) {
        setMessages((prev) => [...prev, { role: 'assistant', text: `Error: ${resp.status}` }]);
        setStreaming(false);
        return;
      }

      let assistantText = '';
      setMessages((prev) => [...prev, { role: 'assistant', text: '' }]);

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let eventType = null;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';

        for (const part of parts) {
          const lines = part.split('\n');
          eventType = null;
          for (const line of lines) {
            if (!line || line.startsWith(':')) {
              continue;
            }

            if (line.startsWith('event: ')) {
              eventType = line.slice(7).trim();
              continue;
            }

            if (line.startsWith('data: ')) {
              const data = line.slice(6);

              if (eventType === 'done') {
                reader.cancel();
                abortRef.current = null;
                setStreaming(false);
                return;
              }

              if (eventType === 'error') {
                setMessages((prev) => [...prev, { role: 'assistant', text: data }]);
                reader.cancel();
                abortRef.current = null;
                setStreaming(false);
                return;
              }

              assistantText += data;
              setMessages((prev) => {
                const copy = [...prev];
                const last = copy[copy.length - 1];
                if (last && last.role === 'assistant') {
                  copy[copy.length - 1] = { ...last, text: assistantText };
                }
                return copy;
              });
            }
          }
        }
      }
    } catch (e) {
      setMessages((prev) => [...prev, { role: 'assistant', text: 'Request failed' }]);
    }

    setStreaming(false);
  };

  const stop = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
      setStreaming(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {!open && (
        <button
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-full shadow-lg"
          onClick={() => setOpen(true)}
        >
          Chat
        </button>
      )}

      {open && (
        <div className="w-80 bg-white rounded-lg shadow-xl border border-gray-200 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <div className="font-semibold text-gray-900">Croc Shop Chat</div>
            <button className="text-gray-500 hover:text-gray-700" onClick={() => setOpen(false)}>
              ✕
            </button>
          </div>

          <div ref={scrollRef} className="p-3 space-y-2 overflow-auto" style={{ maxHeight: '320px' }}>
            {messages.length === 0 && (
              <div className="text-sm text-gray-500">Ask anything about the shop.</div>
            )}
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={
                  m.role === 'user'
                    ? 'text-sm bg-indigo-50 border border-indigo-100 rounded p-2'
                    : 'text-sm bg-gray-50 border border-gray-100 rounded p-2'
                }
              >
                {m.text}
              </div>
            ))}
          </div>

          <div className="p-3 border-t flex gap-2">
            <input
              className="flex-1 border rounded px-2 py-1 text-sm"
              placeholder="Type a message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') send();
              }}
              disabled={streaming}
            />
            {!streaming ? (
              <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded text-sm" onClick={send}>
                Send
              </button>
            ) : (
              <button className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm" onClick={stop}>
                Stop
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ChatbotWidget;
