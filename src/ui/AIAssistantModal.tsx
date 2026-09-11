import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { AIAssistant, AIMessage } from '../ai/AIAssistant';

interface AIAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerPosRef: React.MutableRefObject<THREE.Vector3>;
}

export const AIAssistantModal: React.FC<AIAssistantModalProps> = ({
  isOpen,
  onClose,
  playerPosRef,
}) => {
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [inputText, setInputText] = useState('');
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [apiKey, setApiKey] = useState(AIAssistant.getInstance().getApiKey());

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return AIAssistant.getInstance().subscribe((msgs, processing) => {
      setMessages([...msgs]);
      setIsProcessing(processing);
    });
  }, []);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 50);
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isProcessing]);

  if (!isOpen) return null;

  const handleSend = (textToSend?: string) => {
    const text = textToSend || inputText;
    if (!text.trim() || isProcessing) return;
    AIAssistant.getInstance().sendMessage(text, playerPosRef.current);
    setInputText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSend();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const handleSaveApiKey = () => {
    AIAssistant.getInstance().setApiKey(apiKey);
    setShowApiKeyInput(false);
  };

  const quickPrompts = [
    '📍 Take me to Nexus Labs',
    '☕ Find Neon Velocity Lounge',
    '⚡ Trigger Electric Storm',
    '🌇 Set time to Sunset',
    '🌫️ Deploy Dense Fog',
    '🏙️ Tell me about this district',
  ];

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(3, 6, 14, 0.75)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      {/* Modal Terminal Window */}
      <div
        className="glass-panel"
        style={{
          width: '92%',
          maxWidth: '680px',
          height: '80vh',
          maxHeight: '620px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid var(--neon-cyan)',
          boxShadow: '0 0 32px rgba(0, 240, 255, 0.25), inset 0 0 20px rgba(0, 240, 255, 0.05)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Terminal Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 18px',
            borderBottom: '1px solid rgba(0, 240, 255, 0.25)',
            backgroundColor: 'rgba(8, 14, 28, 0.95)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Animated Neural Core Indicator */}
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                backgroundColor: 'var(--neon-cyan)',
                boxShadow: '0 0 10px var(--neon-cyan)',
                animation: 'pulse 1.8s infinite',
              }}
            />
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '0.95rem',
                fontWeight: 700,
                letterSpacing: '2px',
                color: 'var(--neon-cyan)',
              }}
            >
              NEXUS-AI // URBAN NEURAL CORE
            </span>
            <span
              className="cyber-badge"
              style={{
                fontSize: '0.62rem',
                color: apiKey ? '#00ffaa' : '#ffaa00',
                borderColor: apiKey ? 'rgba(0, 255, 170, 0.3)' : 'rgba(255, 170, 0, 0.3)',
              }}
            >
              {apiKey ? 'GEMINI ONLINE' : 'OFFLINE NLP'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => setShowApiKeyInput(!showApiKeyInput)}
              className="cyber-btn"
              style={{ padding: '2px 8px', fontSize: '0.65rem' }}
              title="Configure Gemini API Key"
            >
              ⚙ KEY
            </button>
            <button
              onClick={() => AIAssistant.getInstance().clearHistory()}
              className="cyber-btn"
              style={{ padding: '2px 8px', fontSize: '0.65rem' }}
              title="Clear Terminal Session"
            >
              CLEAR
            </button>
            <button
              onClick={onClose}
              className="cyber-btn"
              style={{ padding: '2px 8px', fontSize: '0.65rem', borderColor: '#ff0055', color: '#ff0055' }}
              title="Close [ESC]"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Optional API Key Configuration Drawer */}
        {showApiKeyInput && (
          <div
            style={{
              padding: '10px 18px',
              backgroundColor: 'rgba(10, 20, 36, 0.95)',
              borderBottom: '1px solid rgba(0, 240, 255, 0.2)',
              display: 'flex',
              gap: 8,
              alignItems: 'center',
            }}
          >
            <input
              type="password"
              placeholder="Enter Google Gemini API Key..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              style={{
                flex: 1,
                background: '#060a14',
                border: '1px solid var(--border-glass)',
                color: '#fff',
                padding: '6px 10px',
                borderRadius: 4,
                fontFamily: 'var(--font-mono)',
                fontSize: '0.8rem',
                outline: 'none',
              }}
            />
            <button
              onClick={handleSaveApiKey}
              className="cyber-btn"
              style={{ padding: '6px 14px', fontSize: '0.75rem' }}
            >
              SAVE
            </button>
          </div>
        )}

        {/* Message Log Container */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          {messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: msg.sender === 'user' ? 'flex-end' : 'flex-start',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  marginBottom: 3,
                  fontSize: '0.65rem',
                  fontFamily: 'var(--font-mono)',
                  color: msg.sender === 'user' ? '#8ba2c4' : 'var(--neon-cyan)',
                }}
              >
                <span>{msg.sender === 'user' ? 'OPERATOR' : 'NEXUS-AI'}</span>
                <span>•</span>
                <span>{msg.timestamp}</span>
              </div>

              <div
                style={{
                  maxWidth: '82%',
                  padding: '10px 14px',
                  borderRadius: msg.sender === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                  backgroundColor:
                    msg.sender === 'user' ? 'rgba(0, 240, 255, 0.14)' : 'rgba(8, 16, 32, 0.9)',
                  border:
                    msg.sender === 'user'
                      ? '1px solid rgba(0, 240, 255, 0.35)'
                      : '1px solid rgba(0, 240, 255, 0.2)',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                  lineHeight: '1.45',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {msg.text}

                {/* Command Execution Pill */}
                {msg.actionExecuted && (
                  <div
                    style={{
                      marginTop: 8,
                      padding: '4px 8px',
                      borderRadius: 4,
                      backgroundColor: 'rgba(0, 255, 170, 0.12)',
                      border: '1px solid var(--neon-emerald)',
                      color: 'var(--neon-emerald)',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      letterSpacing: '1px',
                    }}
                  >
                    ✓ {msg.actionExecuted}
                  </div>
                )}
              </div>
            </div>
          ))}

          {isProcessing && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--neon-cyan)' }}>
              <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
                NEXUS-AI IS COMPUTING NEURAL VECTOR...
              </span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Chips */}
        <div
          style={{
            padding: '8px 16px',
            backgroundColor: 'rgba(6, 10, 20, 0.9)',
            borderTop: '1px solid rgba(0, 240, 255, 0.15)',
            display: 'flex',
            gap: 6,
            overflowX: 'auto',
            whiteSpace: 'nowrap',
          }}
        >
          {quickPrompts.map((prompt, idx) => (
            <button
              key={`chip-${idx}`}
              onClick={() => handleSend(prompt)}
              className="cyber-btn"
              style={{
                padding: '3px 9px',
                fontSize: '0.68rem',
                borderRadius: 14,
                backgroundColor: 'rgba(0, 240, 255, 0.06)',
                borderColor: 'rgba(0, 240, 255, 0.25)',
              }}
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div
          style={{
            padding: '12px 18px',
            backgroundColor: 'rgba(8, 14, 28, 0.98)',
            borderTop: '1px solid rgba(0, 240, 255, 0.25)',
            display: 'flex',
            gap: 10,
          }}
        >
          <input
            ref={inputRef}
            type="text"
            placeholder="Ask NEXUS-AI (e.g. 'Navigate to lab', 'Make it storm', 'Where am I?')..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{
              flex: 1,
              background: 'rgba(5, 8, 16, 0.85)',
              border: '1px solid var(--border-glass)',
              color: '#ffffff',
              padding: '8px 14px',
              borderRadius: 4,
              fontFamily: 'var(--font-mono)',
              fontSize: '0.85rem',
              outline: 'none',
              letterSpacing: '0.5px',
            }}
          />
          <button
            onClick={() => handleSend()}
            disabled={isProcessing || !inputText.trim()}
            className="cyber-btn"
            style={{
              padding: '8px 18px',
              fontSize: '0.8rem',
              opacity: isProcessing || !inputText.trim() ? 0.45 : 1,
            }}
          >
            TRANSMIT
          </button>
        </div>
      </div>
    </div>
  );
};
