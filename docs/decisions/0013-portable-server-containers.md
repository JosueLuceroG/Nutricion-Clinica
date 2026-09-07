# ADR-013: Usar contenedores portables para el plano servidor

**Estado:** Aceptada · **Contexto:** Release Foundation Step 02 · **Última revisión:** 2026-08-29

## Contexto

El repositorio tenía un contenedor Web estático, pero no un artefacto API ni
un modelo reproducible para jobs y migraciones. No hay proveedor, host u
orquestador autorizado. La solución debe poder ejecutarse en cloud, VPS u
on-prem sin introducir una plataforma específica.

## Decisión

- La ruta canónica del plano servidor son imágenes OCI portables:
  `nutriclinica-api` y `nutriclinica-web`.
- La imagen API también contiene comandos de una sola ejecución para
  migraciones OLTP y schema DWH, y el entrypoint del runner de jobs. El
  comando de cada workload es explícito; la API nunca migra al arrancar.
- Web sirve assets Vite desde Nginx no-root en `8080` y enruta `/api`/WSS al
  API interno. Un edge separado termina TLS y aplica la identidad pública.
- Las imágenes usan bases versionadas, lockfile congelado, usuario no-root,
  health checks, labels de release/commit y referencias ligadas a digest. El
  runtime debe poder usar filesystem read-only con `tmpfs` únicamente para
  paths transitorios.
- Linux es el host preferido para edge/API/Web por ser la ruta OCI más simple.
  SQL Server puede residir en Windows Server, Linux o servicio compatible,
  siempre fuera de la imagen de aplicación y cumpliendo el contrato SQL.
- Un servicio Node nativo sigue siendo una alternativa secundaria si replica
  exactamente process manager, identidad, TLS edge, secretos, health,
  graceful shutdown y artefacto inmutable. No es la ruta de referencia.
- No se selecciona Kubernetes, proveedor cloud, registry ni servicio manager
  en esta decisión.

## Consecuencias

- **Positiva:** el artefacto de aplicación no depende de una API de proveedor.
- **Positiva:** API, jobs y migraciones comparten código/versiones sin instalar
  toolchain de desarrollo en el host.
- **Positiva:** CI puede construir y validar los mismos Dockerfiles usados por
  un futuro target.
- **Negativa:** el target debe aportar un runtime OCI y un edge TLS confiable.
- **Negativa:** la máquina local actual no tiene engine de contenedores; la
  simulación local queda condicionada hasta ejecutarla en CI o en un host
  autorizado.

## Alternativas consideradas

1. **Node nativo como única ruta** — viable, pero aumenta drift de host y
   obliga a distribuir runtime/toolchain por separado.
2. **Kubernetes como baseline** — descartado por complejidad prematura y por
   seleccionar un modelo operativo no requerido.
3. **Imagen única API+Web+SQL** — descartada por mezclar ciclos de vida,
   persistencia y privilegios.

## Referencias

- `Dockerfile`
- `apps/api/Dockerfile`
- `deployment/compose/compose.yaml`
- `docs/operations/infrastructure-target-requirements.md`
