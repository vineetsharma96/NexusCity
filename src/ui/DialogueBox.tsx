import React, { useEffect, useState } from 'react';
import { DialogueChoice, DialogueNode, DialogueSystem } from '../npc/DialogueSystem';
import { useModalFocus } from './useModalFocus';

export const DialogueBox: React.FC = () => {
  const [node, setNode] = useState<DialogueNode | null>(null);
  const dialogueRef = useModalFocus(Boolean(node), () => DialogueSystem.getInstance().endDialogue());

  useEffect(() => {
    return DialogueSystem.getInstance().subscribe(setNode);
  }, []);

  if (!node) return null;

  const handleChoice = (choice: DialogueChoice) => {
    DialogueSystem.getInstance().selectChoice(choice);
  };

  return (
    <div
      ref={dialogueRef}
      className="dialogue-panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialogue-speaker"
      tabIndex={-1}
      style={{
        position: 'absolute',
        bottom: 'max(22px, env(safe-area-inset-bottom))',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'min(92vw, 660px)',
        zIndex: 130,
        pointerEvents: 'auto',
      }}
    >
      <div
        className="glass-panel"
        style={{
          padding: '20px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        {/* Speaker Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '4px',
                border: '1px solid var(--neon-amber)',
                backgroundColor: 'rgba(245, 158, 11, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontFamily: 'var(--font-display)',
                fontSize: '0.95rem',
                color: 'var(--neon-amber)',
              }}
            >
              {node.speaker[0]}
            </div>

            <div>
              <div
                id="dialogue-speaker"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.02rem',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  color: 'var(--text-primary)',
                }}
              >
                {node.speaker}
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.72rem',
                  color: 'var(--neon-cyan)',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                }}
              >
                {node.role}
              </div>
            </div>
          </div>

          <button
            onClick={() => DialogueSystem.getInstance().endDialogue()}
            aria-label="Close conversation"
            className="cyber-btn"
            style={{
              padding: '4px 10px',
              fontSize: '0.7rem',
            }}
          >
            ESC
          </button>
        </div>

        {/* Message Body */}
        <div
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '0.94rem',
            lineHeight: 1.6,
            color: 'var(--text-primary)',
            padding: '12px 16px',
            backgroundColor: 'rgba(7, 9, 14, 0.65)',
            borderRadius: 4,
            borderLeft: '3px solid var(--neon-cyan)',
          }}
        >
          {node.text}
        </div>

        {/* Response Options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {node.choices.map((choice, idx) => (
            <button
              key={`choice-${idx}`}
              onClick={() => handleChoice(choice)}
              className="cyber-btn"
              style={{
                textAlign: 'left',
                padding: '9px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                fontSize: '0.78rem',
              }}
            >
              <span style={{ color: 'var(--neon-amber)', fontWeight: 700 }}>→</span>
              <span>{choice.text}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
