# ADR-007: Service containers manuales, no framework DI

**Estado:** Aceptada · **Contexto:** Sprint 8 · **Última revisión:** Sprint 24

## Contexto

Los frameworks de inyección de dependencias (Inversify, tsyringe, NestJS)
añaden complejidad, decoradores experimentales, y configuración mágica
que no necesitamos en una app local/desktop.

## Decisión

Cada `src/services/*Service.ts` es un objeto simple con use cases
pre-instanciados. Sin contenedor IoC, sin decoradores, sin reflect-metadata.

## Consecuencias

- **Positivas:** Cero magic, cero overhead en runtime. Código legible
  y debugeable. Tests pueden sustituir repositorios con mocks manuales
  (`const mockRepo: PatientRepository = { ... }`). Sin dependencias
  externas de DI.
- **Negativas:** La creación de objetos es manual (DRY no aplica aquí
  intencionalmente). Cambiar la implementación de un repositorio
  requiere actualizar el service container manualmente.

## Alternativas consideradas

1. **NestJS** — demasiado opinionado para una app Tauri desktop.
2. **tsyringe** — requiere decoradores y `reflect-metadata`, añade
  complejidad innecesaria.
3. **Inversify** — verboso, config-heavy.

## Referencias

- Especificación §6.3 (Service containers)
- `src/services/` — implementaciones de servicios
