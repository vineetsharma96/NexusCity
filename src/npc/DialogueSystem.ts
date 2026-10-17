import { SaveSystem } from '../core/SaveSystem';

export interface DialogueChoice {
  text: string;
  nextNodeId: string | null;
  action?: () => void;
}

export interface DialogueNode {
  id: string;
  speaker: string;
  role: string;
  text: string;
  choices: DialogueChoice[];
}

export interface DialogueConversation {
  npcId: string;
  startNodeId: string;
  nodes: Record<string, DialogueNode>;
}

type DialogueListener = (activeNode: DialogueNode | null) => void;

export class DialogueSystem {
  private static instance: DialogueSystem;
  private conversations = new Map<string, DialogueConversation>();
  private activeConversationId: string | null = null;
  private activeNode: DialogueNode | null = null;
  private listeners = new Set<DialogueListener>();

  private constructor() {}

  public static getInstance(): DialogueSystem {
    if (!DialogueSystem.instance) {
      DialogueSystem.instance = new DialogueSystem();
    }
    return DialogueSystem.instance;
  }

  public registerConversation(conv: DialogueConversation): void {
    this.conversations.set(conv.npcId, conv);
  }

  public startDialogue(npcId: string): boolean {
    const conv = this.conversations.get(npcId);
    if (!conv) return false;
    this.activeConversationId = npcId;
    this.activeNode = conv.nodes[conv.startNodeId] || null;
    SaveSystem.getInstance().recordNodeInteraction(`npc_${npcId}`);
    this.notify();
    return Boolean(this.activeNode);
  }

  public selectChoice(choice: DialogueChoice): void {
    if (choice.action) choice.action();
    if (!choice.nextNodeId) {
      this.endDialogue();
      return;
    }
    const activeConv = this.activeConversationId ? this.conversations.get(this.activeConversationId) : null;
    if (activeConv?.nodes[choice.nextNodeId]) {
      this.activeNode = activeConv.nodes[choice.nextNodeId];
      this.notify();
      return;
    }
    for (const conv of this.conversations.values()) {
      if (conv.nodes[choice.nextNodeId]) {
        this.activeNode = conv.nodes[choice.nextNodeId];
        this.notify();
        return;
      }
    }
    this.endDialogue();
  }

  public endDialogue(): void {
    this.activeConversationId = null;
    this.activeNode = null;
    this.notify();
  }

  public closeDialogue(): void {
    this.endDialogue();
  }

  public getActiveNode(): DialogueNode | null {
    return this.activeNode;
  }

  public subscribe(listener: DialogueListener): () => void {
    this.listeners.add(listener);
    listener(this.activeNode);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach((l) => l(this.activeNode));
  }
}
