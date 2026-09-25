import type { AIModelCapability } from './capabilities.js';

export interface ModelCard {
  key: string;
  provider: 'openai' | 'ollama';
  model: string;
  version: string;
  developer: string;
  license: string;
  description: string;
  intendedUse: string;
  limitations: string;
  risks: string[];
  capabilities: AIModelCapability[];
  evaluationReport: string;
}

const DEFAULT_MODEL_CARDS: ModelCard[] = [
  {
    key: 'openai/gpt-4o-mini',
    provider: 'openai',
    model: 'gpt-4o-mini',
    version: 'gpt-4o-mini-2024-07-18',
    developer: 'OpenAI',
    license: 'Propietaria (API OpenAI)',
    description: 'Modelo ligero multimodal optimizado para latencia y costo.',
    intendedUse: 'Asistencia general de chat y salida estructurada JSON para dashboards.',
    limitations: 'No certificado para razonamiento nutricional avanzado ni contexto clinico complejo.',
    risks: ['Alucinaciones en datos ausentes', 'Consejos genericos sin personalizacion', 'Dependencia del proveedor'],
    capabilities: ['chat_general', 'structured_json'],
    evaluationReport: 'gpt-4o-mini-chat-general-v1.json',
  },
  {
    key: 'openai/gpt-4o',
    provider: 'openai',
    model: 'gpt-4o',
    version: 'gpt-4o-2024-08-06',
    developer: 'OpenAI',
    license: 'Propietaria (API OpenAI)',
    description: 'Modelo multimodal de alta capacidad de OpenAI.',
    intendedUse: 'Asistencia general y tareas que requieren mayor razonamiento.',
    limitations: 'Mayor costo y latencia; requiere evaluacion por capacidad antes de uso clinico.',
    risks: ['Alucinaciones en datos ausentes', 'Costo elevado en uso continuo'],
    capabilities: ['chat_general', 'structured_json'],
    evaluationReport: 'gpt-4o-chat-general-v1.json',
  },
  {
    key: 'ollama/llama3.2',
    provider: 'ollama',
    model: 'llama3.2',
    version: '3.2',
    developer: 'Meta',
    license: 'Llama 3.2 Community License',
    description: 'Modelo local de Meta (3B) para despliegue on-premise.',
    intendedUse: 'Asistencia general de chat con datos locales; sin salida JSON estructurada.',
    limitations: 'Sin soporte de JSON mode; menor capacidad de razonamiento; requiere hardware local.',
    risks: ['Alucinaciones en datos ausentes', 'Salida no estructurada', 'Rendimiento variable segun hardware'],
    capabilities: ['chat_general'],
    evaluationReport: 'ollama-llama3.2-chat_general.json',
  },
];

export class ModelCardRegistry {
  private readonly cards = new Map<string, ModelCard>();

  constructor(seed: ModelCard[] = DEFAULT_MODEL_CARDS) {
    for (const card of seed) this.register(card);
  }

  register(card: ModelCard): void {
    this.cards.set(card.key, card);
  }

  get(key: string): ModelCard | undefined {
    return this.cards.get(key);
  }

  list(): ModelCard[] {
    return Array.from(this.cards.values());
  }
}

export const modelCardRegistry = new ModelCardRegistry();