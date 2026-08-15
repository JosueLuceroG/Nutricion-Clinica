import type { AIToolDefinition } from './toolDefinition.js';

export class AIToolRegistry {
  private readonly tools = new Map<string, AIToolDefinition>();

  register(tool: AIToolDefinition): void {
    if (tool.readOnly !== true) {
      throw new Error(`Solo se permiten herramientas read-only: ${tool.id}`);
    }
    this.tools.set(tool.id, tool);
  }

  get(id: string): AIToolDefinition | undefined {
    return this.tools.get(id);
  }

  list(): AIToolDefinition[] {
    return Array.from(this.tools.values());
  }

  isToolsEnabled(env: NodeJS.ProcessEnv): boolean {
    return env.AI_TOOLS_ENABLED === 'true';
  }

  allowedToolIds(env: NodeJS.ProcessEnv): Set<string> {
    const raw = env.AI_TOOLS_ALLOWLIST ?? '';
    return new Set(
      raw
        .split(',')
        .map((id) => id.trim())
        .filter((id) => id.length > 0),
    );
  }
}

export const aiToolRegistry = new AIToolRegistry();