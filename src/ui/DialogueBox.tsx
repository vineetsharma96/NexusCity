import React, { useState, useEffect } from 'react';
import { DialogueSystem, DialogueNode, DialogueChoice } from '../npc/DialogueSystem';

export const DialogueBox: React.FC = () => {
  const [node, setNode] = useState<DialogueNode | null>(null);

  useEffect(() => {
    return DialogueSystem.getInstance().subscribe(setNode);
  }, []);

  if (!node) return null;

  const handleChoice = (choice: DialogueChoice) => {
    DialogueSystem.getInstance().selectChoice(choice);
  };

  const handleClose = () => {
    DialogueSystem.getInstance().closeDialogue();
  };

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 40,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'min(92vw, 680px)',
        zIndex: 50,
        pointerEvents: 'auto',
      }}
    >
      <div
        className="glass-panel"
        style={{
          padding: '20px 24px',
          border: '1px solid rgba(0, 240, 255, 0.4)',
          boxShadow: '0 12px 48px rgba(0, 0, 0, 0.8), 0 0 24px rgba(0, 240, 255, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        {/* Header: Speaker Name, Role, and Close Button */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                border: '2px solid var(--neon-cyan)',
                backgroundColor: 'rgba(0, 240, 255, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 900,
                fontFamily: 'var(--font-display)',
                fontSize: '1rem',
                color: 'var(--neon-cyan)',
                boxShadow: '0 0 10px rgba(0, 240, 255, 0.4)',
              }}
            >
              {node.speaker[0]}
            </div>

            <div>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.05rem',
                  fontWeight: 700,
                  letterSpacing: '1.5px',
                  color: 'var(--text-primary)',
                }}
              >
                {node.speaker}
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.8rem',
                  color: 'var(--neon-amber)',
                  letterSpacing: '1px',
                }}
              >
                {node.role}
              </div>
            </div>
          </div>

          <button
            onClick={handleClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '1.2rem',
              cursor: 'pointer',
              padding: '2px 8px',
            }}
          >
            ✕
          </button>
        </div>

        {/* Dialogue Text Body */}
        <div
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '0.98rem',
            lineHeight: '1.6',
            color: '#cbd5e1',
            padding: '10px 14px',
            backgroundColor: 'rgba(5, 10, 20, 0.6)',
            borderRadius: 6,
            borderLeft: '3px solid var(--neon-cyan)',
          }}
        >
          {node.text}
        </div>

        {/* Player Response Choices */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
          {node.choices.map((choice, idx) => (
            <button
              key={`choice-${idx}`}
              onClick={() => handleChoice(choice)}
              className="cyber-btn"
              style={{
                textAlign: 'left',
                padding: '8px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                fontSize: '0.85rem',
                backgroundColor: 'rgba(0, 240, 255, 0.06)',
              }}
            >
              <span style={{ color: 'var(--neon-amber)', fontWeight: 900 }}>▶</span>
              <span>{choice.text}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
