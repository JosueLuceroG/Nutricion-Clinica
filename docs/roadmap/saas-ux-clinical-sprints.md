# Roadmap SaaS, UX y Clinico

Estado: plan operativo aprobado para ejecutar antes de nuevas fases funcionales.

Fecha de creacion: 2026-06-15.

Este documento registra el plan completo para que las mejoras no dependan de la conversacion. Antes de implementar cada sprint se debe revisar este archivo, confirmar que el alcance sigue vigente y cerrar la verificacion tecnica antes de avanzar al siguiente sprint.

## Proposito

Este roadmap organiza las mejoras SaaS, UX, clinicas, portal paciente, IA, reportes y costos en sprints pequenos y verificables. El objetivo es completar funcionalidades incompletas sin duplicar modulos existentes ni romper la arquitectura hexagonal actual.

El plan parte de una auditoria read-only del estado actual del proyecto. La auditoria confirmo que muchas bases ya existen, pero varias funcionalidades estan incompletas o desconectadas entre si.

## Reglas De Ejecucion

| Regla | Aplicacion obligatoria |
| --- | --- |
| Auditar antes de tocar | Cada sprint empieza revisando rutas, servicios, stores, repositorios y docs relacionados. |
| No duplicar modulos | Si existe modulo, se completa ahi. No crear paralelos para resolver lo mismo. |
| Mantener arquitectura hexagonal | Dominio puro, casos de uso en `application`, adapters en `infrastructure`, UI en `ui` o `src/app/pages`. |
| Cambios minimos correctos | Preferir cambios pequenos y directos sobre reescrituras amplias. |
| No romper flujos actuales | Pacientes, consultas, planes, agenda, portal, auth, sync y billing deben seguir funcionando. |
| No borrar sin justificacion | No eliminar archivos o datos salvo decision explicita y documentada. |
| No marcar visual como terminado si no funciona | Cada UI nueva debe estar conectada a estado/servicio real o marcada como pendiente. |
| No avanzar con build roto | No iniciar el siguiente sprint si `typecheck` o `build` fallan. |
| Validar por sprint | Ejecutar `pnpm typecheck`, tests focalizados y `pnpm build` cuando el alcance sea frontend. |
| API tambien valida | Si toca backend, ejecutar `pnpm --filter @nutriclinica/api typecheck` y tests API focalizados. |
| Datos clinicos sensibles | No registrar payload clinico completo en auditoria, logs o errores. |
| IA opcional | IA debe requerir configuracion, preferencia profesional y consentimiento cuando aplique a paciente. |
| Precios reales | No inventar precios de alimentos. La carga debe ser manual, importable o configurable. |
| Produccion | No declarar listo para produccion sin staging, seguridad, legal, backup/restore y validacion manual. |

## Estado Actual Auditado

| Area | Estado encontrado | Notas |
| --- | --- | --- |
| Frontend | React 19 + Vite + TypeScript | Router con `createHashRouter` y code splitting en `src/app/router.tsx`. |
| Desktop | Tauri v2 | Configurado en `src-tauri/tauri.conf.json`. No hay Electron. |
| PWA | Parcial | `public/manifest.webmanifest`, `public/sw.js` y registro en `src/main.tsx`. |
| UI system | Tailwind + Radix/componentes propios | No hay Bootstrap y no conviene introducirlo. |
| Auth | Real pero admin UI incompleta | JWT, Argon2, roles, sucursales, 2FA TOTP. |
| Registro usuarios | Backend admin-only | Frontend `authApi.register()` estaba marcado como `skipAuth: true`, pendiente de corregir. |
| Preferencias | Muy basicas | `language`, `dateFormat`, `currency`, `decimalPlaces`. |
| IA | Parcial | Backend `/ai/complete` existe; toggle de settings no controla realmente `AIService`. |
| Consentimiento IA | Existe registro | `AiConsentCard` gestiona `ai_opt_in`, pero la ejecucion IA no lo exige siempre. |
| Dashboard | KPIs fijos | `DashboardPage` no consume configuracion; reportes tiene `DashboardConfig`. |
| Reportes | Parcial avanzado | Indicadores y dashboard config existen en `modules/reports`. |
| Agenda | Parcial avanzado | Dia/mes, slots, horarios y bloqueos; faltan vistas semana/lista y reagenda desde UI. |
| Portal paciente | Parcial avanzado | Token, scopes, adherencia offline, documentos, fotos, mensajes, notificaciones. |
| Chat | Asincrono por polling | Mensajes via HTTP cada 30s, no realtime. |
| Expediente clinico | Amplio pero fijo | Muchas secciones, no configurable por usuario/sede. |
| Guard cambios | Parcial | `useUnsavedChangesGuard` existe, pero solo se usa en formulario de paciente. |
| PDF | Parcial | Plan y consulta exportan PDF con marca fija `NutriClinica`. |
| Costos/precios | Parcial | Recetas tienen costo/moneda; no hay catalogo de precios por ubicacion/sucursal. |
| Multisucursal | Base fuerte | Backend/sync/local dashboard ya aislado por sucursal tras hardening previo. |

## Matriz De Funcionalidades

| Funcionalidad | Clasificacion | Sprint | Decision |
| --- | --- | --- | --- |
| Configuracion base SaaS | Incompleta | 1 | Extender `preferencesStore` y `SettingsPage`. |
| UX segura | Incompleta | 1, 5 | Corregir register admin, IA visible honesta, guards en formularios. |
| UI responsive | Parcial | 2 | Ajustar layout actual, sin Bootstrap. |
| Bootstrap | No aplica | 2 | No introducir dependencia. Mantener Tailwind/Radix. |
| Modo principiante/normal | Falta | 3 | Implementar como preferencia de UI, no cambiar dominio. |
| Expediente configurable | Incompleto | 4 | Configurar visibilidad/orden de secciones existentes. |
| Campos clinicos configurables | Falta parcial | 4 | Fase inicial via configuracion UI; persistencia profunda solo si es necesaria. |
| Guardado inteligente | Parcial | 5 | Guard extendido, drafts/autosave local si aplica. |
| Dashboard KPIs personalizables | Incompleto | 6 | Reutilizar `DashboardConfig`. |
| Agenda con vistas | Incompleta | 7 | Dia, semana, mes, lista, filtros y reagenda. |
| PDF free/premium | Falta | 8 | Branding configurable y plan free/premium. |
| Usuarios/roles/sedes | Incompleto | 9 | UI admin y endpoints faltantes segun auditoria. |
| Portal/PWA/app paciente | Parcial | 10 | Completar PWA/offline/instalacion y UX paciente. |
| Chat realtime | Falta | 11 | WebSocket con fallback HTTP. |
| Asistente IA opcional | Incompleto | 12 | Enforce config + consentimiento + revision humana. |
| Precios por ubicacion/moneda | Falta parcial | 13 | Catalogo manual/importable con calculos. |

## Quality Gates Por Sprint

Antes de cerrar cualquier sprint:

1. Revisar `git status --short --branch`.
2. Ejecutar `pnpm typecheck`.
3. Ejecutar tests focalizados del area modificada.
4. Ejecutar `pnpm build` si toca frontend o shared types.
5. Si toca API, ejecutar `pnpm --filter @nutriclinica/api typecheck` y tests API focalizados.
6. Ejecutar `git diff --check`.
7. Documentar archivos modificados, comportamiento nuevo y pendientes.
8. No avanzar al siguiente sprint si queda error de TypeScript, build o test relevante.

## Sprint 0 - Documentacion Del Roadmap

### Objetivo

Persistir el plan completo antes de implementar cambios funcionales.

### Cambios

| Item | Detalle |
| --- | --- |
| Crear roadmap | `docs/roadmap/saas-ux-clinical-sprints.md`. |
| Enlazar README | Agregar link en seccion de documentacion. |
| Enlazar spec | Agregar referencia en post-roadmap. |
| Criterio de cierre | El plan queda versionado y visible desde docs principales. |

### Validacion

- Revisar diff.
- Confirmar que no se tocaron archivos funcionales.

## Sprint 1 - Configuracion Base Y UX Segura

### Objetivo

Corregir inconsistencias rapidas y crear la base de configuracion global para los sprints siguientes.

### Estado Actual

| Tema | Estado |
| --- | --- |
| `preferencesStore` | Solo guarda idioma, fecha, moneda y decimales. |
| IA en settings | Usa `localStorage` manual `ai-enabled`. |
| IA real | `AIService` depende de `VITE_AI_ENABLED`. |
| Registro usuarios | Backend exige admin, frontend omite auth. |
| Guard cambios | Solo formulario de paciente. |

### Alcance De Implementacion

| Cambio | Detalle |
| --- | --- |
| Corregir register | Quitar `skipAuth: true` en `authApi.register()` para enviar JWT admin. |
| Extender preferencias | Agregar `usageMode`, `aiEnabled`, `subscriptionPlan`, `pdfBrandingEnabled`, `clinicDisplayName`, `dashboardWidgetIds` y base de secciones clinicas. |
| Settings real | Conectar `SettingsPage` al store persistido, quitando `localStorage` manual de IA. |
| IA honesta | UI debe distinguir IA deshabilitada por entorno vs apagada por usuario. |
| AI buttons | `AIAssistButton` o `useAI` deben respetar preferencia profesional y env. |
| Guards | Aplicar `useUnsavedChangesGuard` a consulta, plan alimenticio, laboratorio y antropometria. |

### Archivos Probables

- `src/store/preferencesStore.ts`
- `src/app/pages/SettingsPage.tsx`
- `src/services/api/authApi.ts`
- `src/services/ai/AIService.ts`
- `src/services/ai/AIClient.ts`
- `src/services/ai/useAI.ts`
- `src/components/ai/AIAssistButton.tsx`
- `src/modules/consultation/ui/ConsultationWizard.tsx`
- `src/modules/mealplan/ui/MealPlanForm.tsx`
- `src/modules/laboratory/ui/LabPanelForm.tsx`
- `src/modules/anthropometry/ui/AnthropometryForm.tsx`

### Criterios De Aceptacion

| Criterio | Resultado esperado |
| --- | --- |
| Register admin | `authApi.register()` usa auth normal y backend puede validar rol admin. |
| Preferencias | Settings persiste nuevas opciones sin romper datos previos. |
| IA | Si env o preferencia apagan IA, botones no prometen generar contenido. |
| Guards | Al salir de formularios largos con cambios sin guardar aparece confirmacion. |
| Build | `pnpm typecheck` y `pnpm build` pasan. |

### Riesgos

- Cambios de store persistido pueden requerir defaults compatibles.
- IA tiene dos capas de activacion: env y preferencia de usuario.
- Guard de formularios debe evitar bloquear despues de guardar correctamente.

## Sprint 2 - UI Responsive Sin Bootstrap

### Objetivo

Mejorar usabilidad desktop/mobile respetando el sistema actual.

### Decision Sobre Bootstrap

No se introducira Bootstrap. El proyecto ya usa Tailwind, Radix UI, componentes propios y patrones responsive existentes. Agregar Bootstrap duplicaria estilos, aumentaria bundle y podria romper consistencia visual.

### Alcance De Implementacion

| Cambio | Detalle |
| --- | --- |
| Layout base | Revisar `AppLayout`, `Sidebar`, `Header`, `PageHeader`, `PageContent`. |
| Formularios | Ajustar grids y botones en consulta, plan, laboratorio, antropometria. |
| Agenda | Evitar overflow en calendario, botones y panel diario. |
| Dashboard | Revisar KPIs y tarjetas en pantallas pequenas. |
| Portal | Revisar portal paciente en mobile, especialmente fotos, mensajes y documentos. |
| Dialogos | Usar `max-h`, scroll interno y anchuras responsivas. |

### Archivos Probables

- `src/app/layout/*`
- `src/app/pages/DashboardPage.tsx`
- `src/app/pages/agenda/AgendaPage.tsx`
- `src/app/pages/patients/PatientDetailPage.tsx`
- `src/app/pages/patient-portal/PatientPortalPage.tsx`
- formularios clinicos relevantes

### Criterios De Aceptacion

| Criterio | Resultado esperado |
| --- | --- |
| Mobile | No hay cortes horizontales evitables en paginas principales. |
| Desktop | Layout actual se conserva. |
| Dependencias | No se agrega Bootstrap ni react-bootstrap. |
| Build | `pnpm typecheck` y `pnpm build` pasan. |

### Riesgos

- Cambios visuales amplios pueden afectar snapshots/E2E si hay selectores fragiles.

## Sprint 3 - Modo Principiante / Normal

### Objetivo

Permitir una experiencia simplificada para usuarios nuevos sin eliminar funciones avanzadas.

### Estado Actual

No existe modo de uso. Todas las pantallas muestran complejidad completa.

### Alcance De Implementacion

| Cambio | Detalle |
| --- | --- |
| Preferencia | Usar `usageMode: beginner | normal`. |
| Settings | Selector claro con descripcion de cada modo. |
| Dashboard | En principiante, mostrar ayudas y accesos recomendados. |
| Paciente detalle | Colapsar secciones avanzadas por defecto. |
| Consulta | Mostrar hints de flujo SOAP y ocultar ayuda muy tecnica. |
| Plan alimenticio | Mostrar pasos guiados, mantener controles avanzados accesibles. |

### Fuera De Alcance

- No cambiar entidades clinicas.
- No borrar campos.
- No crear rutas duplicadas para principiantes.

### Criterios De Aceptacion

| Criterio | Resultado esperado |
| --- | --- |
| Persistencia | El modo elegido persiste. |
| Reversibilidad | Cambiar a normal devuelve toda la UI avanzada. |
| Seguridad | No oculta alertas clinicas criticas. |
| Build | `pnpm typecheck` y `pnpm build` pasan. |

### Riesgos

- Ocultar demasiada informacion podria afectar decisiones clinicas. Por eso se colapsa, no se elimina.

## Sprint 4 - Expediente Configurable Y Campos Clinicos Configurables

### Objetivo

Hacer configurable el expediente clinico sin redisenar el dominio.

### Estado Actual

`ClinicalRecordCards` monta secciones fijas:

- Alergias.
- Medicamentos.
- Eventos clinicos.
- Antecedentes familiares.
- Antecedentes personales.
- Habitos.
- Actividad fisica.
- Historia dietetica.
- Intolerancias.
- Cirugias.
- Hospitalizaciones.
- Suplementos.
- Frecuencia alimentaria.
- Sintomas GI.
- Consentimiento IA.

### Alcance De Implementacion

| Cambio | Detalle |
| --- | --- |
| Configuracion de secciones | Lista de secciones visibles, orden y colapsado por defecto. |
| Settings clinicos | UI para activar/desactivar secciones. |
| Render dinamico | `ClinicalRecordCards` renderiza segun configuracion. |
| Defaults seguros | Todas las secciones actuales visibles por defecto. |
| Campos configurables fase 1 | Campos auxiliares de UI o metadata no critica, si no requieren migracion. |

### Fuera De Alcance Inicial

- Constructor completo de formularios clinicos con persistencia arbitraria.
- Migraciones profundas para campos dinamicos si no hay requerimiento claro.
- Cambiar validaciones de entidades existentes.

### Archivos Probables

- `src/store/preferencesStore.ts`
- `src/app/pages/SettingsPage.tsx`
- `src/modules/clinical-record/ui/ClinicalRecordCards.tsx`
- `src/modules/clinical-record/application/clinicalRecordSchemas.ts` solo si es imprescindible

### Criterios De Aceptacion

| Criterio | Resultado esperado |
| --- | --- |
| No duplicacion | Se reutilizan tarjetas existentes. |
| Defaults | Un usuario sin configuracion ve lo mismo que antes. |
| Configuracion | Ocultar una seccion no borra datos. |
| Build | `pnpm typecheck` y `pnpm build` pasan. |

### Riesgos

- Campos dinamicos clinicos pueden complicar auditoria, sync y validacion. Mantener fase 1 limitada.

## Sprint 5 - Guardado Inteligente Y Rendimiento

### Objetivo

Reducir perdida de datos y mejorar experiencia en formularios largos.

### Estado Actual

| Tema | Estado |
| --- | --- |
| Sync queue | Existe para cambios offline/sync. |
| Doble submit | Existe en algunos flujos. |
| Guard cambios | Existe pero no generalizado. |
| Autosave | No hay autosave clinico general. |
| Drafts | No hay borradores locales estandarizados para consulta/plan. |

### Alcance De Implementacion

| Cambio | Detalle |
| --- | --- |
| Guards completos | Asegurar proteccion de salida en formularios largos. |
| Indicadores | Mostrar estado `Cambios sin guardar`, `Guardando`, `Guardado local`. |
| Draft local consulta | Evaluar persistencia local de borrador sin crear consulta definitiva. |
| Draft local plan | Evaluar persistencia local de plan en progreso. |
| Limpieza post-save | Eliminar draft al guardar correctamente. |
| Rendimiento | Optimizar calculos de meal plan si se detecta lag real. |

### Archivos Probables

- `src/hooks/useUnsavedChangesGuard.ts`
- `src/modules/consultation/ui/ConsultationWizard.tsx`
- `src/modules/mealplan/ui/MealPlanForm.tsx`
- `src/modules/laboratory/ui/LabPanelForm.tsx`
- `src/modules/anthropometry/ui/AnthropometryForm.tsx`
- nuevo helper/store de drafts si se justifica

### Criterios De Aceptacion

| Criterio | Resultado esperado |
| --- | --- |
| No perdida accidental | Navegar fuera con cambios muestra confirmacion. |
| Draft seguro | Si se implementa draft, no se sincroniza como dato clinico final. |
| Post-save | Guard no bloquea despues de guardar. |
| Build | `pnpm typecheck` y `pnpm build` pasan. |

### Riesgos

- Autosave de datos clinicos incompletos debe diferenciarse claramente de registro final.

## Sprint 6 - Dashboard KPIs Personalizables

### Objetivo

Permitir personalizar KPIs del dashboard principal reutilizando lo existente.

### Estado Actual

| Elemento | Estado |
| --- | --- |
| `DashboardPage` | KPIs fijos. |
| `useDashboardKpis` | Calcula metricas operativas. |
| `modules/reports` | Tiene `Indicator`, `IndicatorValue`, `DashboardConfig`. |
| `ReportsPage` | Consume metricas y reportes, no dashboard principal. |

### Alcance De Implementacion

| Cambio | Detalle |
| --- | --- |
| Catalogo de widgets | Definir KPIs disponibles: pacientes activos, consultas mes, planes activos, sync pendiente, pagos pendientes, ingresos mes, etc. |
| Configuracion | Visibilidad y orden por usuario. |
| Fallback | Si no hay config, mantener dashboard actual. |
| UI edicion | Panel simple en dashboard o settings para activar/reordenar. |
| Reutilizacion | Evaluar si `DashboardConfig` debe ser fuente o si preferencias bastan para fase 1. |

### Archivos Probables

- `src/app/pages/DashboardPage.tsx`
- `src/app/hooks/useDashboardKpis.ts`
- `src/modules/reports/domain/DashboardConfig.ts`
- `src/modules/reports/application/reportUseCases.ts`
- `src/services/reportService.ts`
- `src/store/preferencesStore.ts` si fase 1 es local

### Criterios De Aceptacion

| Criterio | Resultado esperado |
| --- | --- |
| Personalizacion | Usuario puede ocultar/mostrar KPIs. |
| Orden | Orden configurado se refleja en dashboard. |
| Fallback | Sin config, dashboard no cambia. |
| No duplicacion | No se crea otro modulo de reportes. |
| Build | `pnpm typecheck` y `pnpm build` pasan. |

### Riesgos

- Persistencia por usuario/sucursal puede necesitar definicion de alcance SaaS.

## Sprint 7 - Agenda Con Vistas

### Objetivo

Completar agenda profesional con varias vistas y acciones sobre citas.

### Estado Actual

Existe:

- Calendario mensual con dia seleccionado.
- Lista de citas por dia.
- Crear cita.
- Slots disponibles.
- Horarios por profesional.
- Bloqueos.
- Cancelar y marcar no-show.

Falta o esta incompleto:

- Vista semanal.
- Vista lista.
- Vista mensual con cards mas ricas.
- Reagendar desde detalle.
- Confirmar/completar desde detalle.
- Filtros avanzados.
- Revision fina de scope local por sucursal/oficina en repositorio.

### Alcance De Implementacion

| Cambio | Detalle |
| --- | --- |
| Selector de vista | `day`, `week`, `month`, `list`. |
| Vista semana | Columnas por dia y citas ordenadas por hora. |
| Vista lista | Rango configurable y filtros. |
| Acciones detalle | Confirmar, completar, cancelar, no-show, reagendar. |
| Reagendar UI | Usar `rescheduleAppointmentUC`. |
| Filtros | Estado, tipo, paciente, profesional si aplica. |
| Sucursal/oficina | Asegurar que queries locales no mezclen sedes. |

### Archivos Probables

- `src/app/pages/agenda/AgendaPage.tsx`
- `src/services/agendaService.ts`
- `src/modules/agenda/application/agendaUseCases.ts`
- `src/modules/agenda/infrastructure/DexieAgendaRepository.ts`
- `src/modules/agenda/ui/*`

### Criterios De Aceptacion

| Criterio | Resultado esperado |
| --- | --- |
| Vistas | Dia, semana, mes y lista funcionan. |
| Acciones | Reagendar/confirmar/completar actualizan estado real. |
| Slots | Crear/reagendar respeta solapamientos y bloqueos. |
| Tenancy | No se muestran citas de otra sucursal. |
| Build | `pnpm typecheck` y `pnpm build` pasan. |

### Riesgos

- Reagenda debe validar solapamientos igual que crear cita.
- Scope por sucursal puede requerir cambio de schema o filtros existentes.

## Sprint 8 - PDF Marca Gratis / Premium

### Objetivo

Permitir branding de PDFs segun plan SaaS.

### Estado Actual

Los generadores PDF tienen marca fija `NutriClinica`:

- `src/services/pdf/generators/mealPlanPdf.ts`
- `src/services/pdf/generators/consultationPdf.ts`

### Alcance De Implementacion

| Cambio | Detalle |
| --- | --- |
| Opciones PDF | Crear `PdfBrandingOptions`. |
| Plan gratis | Mostrar marca de plataforma obligatoria. |
| Plan premium | Permitir nombre de clinica y ocultar marca plataforma si config lo permite. |
| Footer | Footer configurable y consistente. |
| Settings | Configurar nombre visible y marca PDF. |
| Contrato | `pdfService` debe pasar branding a generadores. |

### Archivos Probables

- `src/services/pdf/types.ts`
- `src/services/pdf/pdfService.ts`
- `src/services/pdf/generators/mealPlanPdf.ts`
- `src/services/pdf/generators/consultationPdf.ts`
- `src/services/pdf/pdfService.test.ts`
- `src/store/preferencesStore.ts`
- `src/app/pages/SettingsPage.tsx`

### Criterios De Aceptacion

| Criterio | Resultado esperado |
| --- | --- |
| Free | PDF conserva marca plataforma. |
| Premium | PDF usa nombre clinic configurable y permite quitar marca plataforma segun config. |
| Compatibilidad | Si no se pasan opciones, PDFs mantienen salida valida. |
| Tests | Tests PDF actualizados. |
| Build | `pnpm typecheck` y `pnpm build` pasan. |

### Riesgos

- Si se agrega logo imagen, hay que resolver almacenamiento, CORS y peso. Fase inicial debe usar texto.

## Sprint 9 - Usuarios, Roles, Sedes Y Configuracion Avanzada

### Objetivo

Completar administracion SaaS basica de usuarios, roles y sedes.

### Estado Actual

Existe:

- Backend auth con login, register admin-only, me.
- Roles: `admin`, `nutriologa`, `asistente`, `soporte_tecnico`, `auditor`, `facturacion`.
- Sucursales asignadas a usuario.
- `RequireRole` para algunas rutas.

Incompleto:

- No hay UI admin completa de usuarios.
- No hay RBAC configurable dinamico.
- No hay gestion avanzada de sedes desde frontend.
- JWT se guarda en `localStorage`, riesgo conocido para hardening futuro.

### Alcance De Implementacion

| Cambio | Detalle |
| --- | --- |
| UI usuarios | Listar/crear profesionales desde settings avanzado. |
| Crear usuario | Usar `/auth/register` con JWT admin. |
| Roles | Seleccionar rol desde enum compartido. |
| Sedes | Asignar sucursales disponibles. |
| Proteccion | Rutas/acciones admin-only. |
| Auditoria | Auditar creacion/cambios relevantes sin datos sensibles. |

### Posibles Endpoints Faltantes

- Listar profesionales.
- Actualizar rol/estado.
- Listar todas las sucursales para admin.
- Crear/editar sucursal si se define dentro de alcance.

### Archivos Probables

- `src/services/api/authApi.ts`
- nuevo cliente API de usuarios/sucursales si hace falta
- `src/app/pages/SettingsPage.tsx` o nueva pagina admin
- `src/app/router.tsx`
- `src/modules/auth/RequireRole.tsx`
- `apps/api/src/modules/auth/*`
- `apps/api/src/modules/sucursales/*`

### Criterios De Aceptacion

| Criterio | Resultado esperado |
| --- | --- |
| Admin | Solo admin ve/usa administracion. |
| Crear usuario | Usuario creado puede iniciar sesion. |
| Sucursal | Usuario nuevo queda asociado a sede valida. |
| Roles | Permisos existentes no se rompen. |
| API | Typecheck/tests API pasan si se toca backend. |

### Riesgos

- Cambios de auth/RBAC son sensibles y requieren pruebas E2E.
- RBAC dinamico completo puede ser fase posterior.

## Sprint 10 - Portal / PWA / App Paciente

### Objetivo

Completar experiencia paciente instalable y robusta offline.

### Estado Actual

Portal paciente ya incluye:

- Acceso por token `/portal/:token`.
- Scopes.
- Resumen, plan activo, citas, documentos.
- Adherencia con cola offline.
- Fotos de comidas.
- Mensajes asincronos.
- Notificaciones y cache local parcial.
- Gestion profesional de enlaces, adherencia, mensajes, fotos y sustituciones.

PWA actual:

- Manifest basico.
- Service worker de app shell.
- Cache del shell, no de APIs/documentos.

### Alcance De Implementacion

| Cambio | Detalle |
| --- | --- |
| Manifest | Revisar nombre, iconos, start URL y scope. |
| Install UX | Mostrar indicacion de instalacion cuando el navegador lo permita. |
| Offline UX | Mejorar banners y estados de cola pendiente. |
| Portal cache | Mantener criterio seguro: no cachear documentos/API sensibles en SW. |
| Token UX | Mostrar expiracion, scopes y estado de acceso con claridad. |
| Profesional | Mejorar visibilidad de actividad portal en detalle paciente. |

### Archivos Probables

- `public/manifest.webmanifest`
- `public/sw.js`
- `src/main.tsx`
- `src/app/pages/patient-portal/PatientPortalPage.tsx`
- `src/services/api/patientPortalApi.ts`
- `src/app/pages/patients/PatientPortalLinksCard.tsx`

### Criterios De Aceptacion

| Criterio | Resultado esperado |
| --- | --- |
| Portal online | Carga y usa funcionalidades actuales. |
| Portal offline | Muestra cache/cola sin prometer datos frescos. |
| PWA | Manifest y SW validos. |
| Seguridad | No se cachean respuestas clinicas sensibles en SW. |
| Build | `pnpm typecheck` y `pnpm build` pasan. |

### Riesgos

- PWA real en iOS/Android requiere pruebas manuales en dispositivos/navegadores.

## Sprint 11 - Chat Tiempo Real

### Objetivo

Convertir la mensajeria paciente-profesional de polling a realtime seguro.

### Estado Actual

Mensajes existen, pero usan polling HTTP cada 30 segundos en:

- `PatientPortalPage.tsx`
- `PatientMessagingCard.tsx`

Backend tiene WebSocket para telemedicina, no chat portal general.

### Alcance De Implementacion

| Cambio | Detalle |
| --- | --- |
| Diseno canal | Decidir si se reutiliza infraestructura WebSocket o nuevo canal chat. |
| Auth profesional | JWT y sucursal activa. |
| Auth paciente | Token portal, expiracion y scope `messaging`. |
| Eventos | `message:new`, `message:read`, `presence` opcional, reconexion. |
| Persistencia | Mensaje sigue guardandose via backend/SQL. |
| Fallback | Si WebSocket falla, mantener polling HTTP. |
| Auditoria | Auditar metadatos, no contenido completo si no es necesario. |

### Archivos Probables

- `apps/api/src/modules/patientPortal/*`
- posible servidor WebSocket nuevo o extension del existente
- `src/services/api/patientPortalApi.ts`
- nuevo hook realtime para portal/mensajes
- `src/app/pages/patient-portal/PatientPortalPage.tsx`
- `src/app/pages/patients/PatientMessagingCard.tsx`

### Criterios De Aceptacion

| Criterio | Resultado esperado |
| --- | --- |
| Realtime | Mensaje aparece en la otra ventana sin esperar 30s. |
| Seguridad | Paciente solo accede a su sala/token; profesional solo a su sucursal. |
| Fallback | Si socket falla, polling conserva funcionalidad. |
| API tests | Permisos y scopes cubiertos. |
| Build | Typecheck/build pasan. |

### Riesgos

- WebSocket introduce complejidad de infraestructura, reconexion y despliegue.

## Sprint 12 - Asistente IA Opcional

### Objetivo

Hacer IA realmente opcional, segura y aprobada por humano.

### Estado Actual

Existe:

- `AIClient`, `AIService`, `useAI`, `AIAssistButton`.
- 8 capacidades IA.
- Backend `/ai/complete` autenticado/rate-limited.
- Consentimiento `ai_opt_in` registrable por paciente.
- Integracion en consulta para borrador y resumen.

Incompleto:

- Toggle local de settings no controla todo el flujo.
- No se exige consentimiento IA en todas las ejecuciones clinicas.
- Falta confirmacion explicita antes de enviar contexto clinico.

### Alcance De Implementacion

| Cambio | Detalle |
| --- | --- |
| Gating unificado | IA requiere env habilitado, preferencia profesional y permiso de UI. |
| Consentimiento paciente | Si contexto incluye `patientId`, validar `ai_opt_in` activo. |
| Confirmacion | Mostrar dialogo antes de enviar contexto clinico sensible. |
| Borrador seguro | IA propone, usuario revisa y aplica manualmente. |
| Auditoria | Registrar capability, usuario, paciente, tokens/modelo si aplica, sin prompt completo. |
| Estados UI | Mostrar deshabilitado, sin consentimiento, sin backend o error de configuracion. |

### Archivos Probables

- `src/services/ai/AIService.ts`
- `src/services/ai/useAI.ts`
- `src/components/ai/AIAssistButton.tsx`
- `src/modules/consultation/ui/ConsultationWizard.tsx`
- `src/modules/auth/PatientConsentService.ts`
- `src/modules/clinical-record/ui/ClinicalRecordCards.tsx`
- `src/app/pages/SettingsPage.tsx`

### Criterios De Aceptacion

| Criterio | Resultado esperado |
| --- | --- |
| Sin env | IA no se ejecuta y explica configuracion faltante. |
| Preferencia off | IA no se ejecuta aunque env este listo. |
| Sin consentimiento | IA clinica por paciente queda bloqueada. |
| Aplicacion manual | Nada generado por IA se guarda automaticamente. |
| Auditoria | Se audita uso sin payload clinico sensible. |

### Riesgos

- Privacidad y cumplimiento. Validacion legal/politicas requiere revision fuera del codigo.

## Sprint 13 - Precios De Menu Por Ubicacion, Moneda Y Catalogo

### Objetivo

Costear recetas, planes y listas de compra por ubicacion/sucursal y moneda.

### Estado Actual

| Elemento | Estado |
| --- | --- |
| Recetas | Tienen `costTotal`, `costPerServing`, `currency`. |
| Shopping list | Tiene `currency`. |
| Preferencias | Tienen moneda global. |
| Catalogo precios | Falta. |
| Ubicacion/sucursal | No esta vinculada a precios de alimentos. |

### Alcance De Implementacion

| Cambio | Detalle |
| --- | --- |
| Entidad precio | Alimento/ingrediente, precio, moneda, cantidad base, ubicacion/sucursal, vigencia. |
| Catalogo manual | CRUD local para precios. |
| Importacion opcional | CSV/Excel posterior si se justifica. |
| Calculo receta | Costo total y por porcion segun precios disponibles. |
| Calculo plan | Costo estimado por dia/semana. |
| Shopping list | Total por lista y advertencias de precios faltantes. |
| Moneda | Usar preferencia global y permitir override por precio. |

### Archivos Probables

- `src/modules/recipes/*`
- `src/modules/meal-planner/*`
- `src/store/preferencesStore.ts`
- `src/services/db/dexieSchema.ts` si se agrega persistencia local
- `apps/api/migrations/*` si se sincroniza backend
- `apps/api/src/modules/*` si requiere endpoints

### Criterios De Aceptacion

| Criterio | Resultado esperado |
| --- | --- |
| No precios inventados | Sistema permite cargar precios, no trae datos ficticios como reales. |
| Costeo | Receta/lista/plan calculan totales con precios existentes. |
| Faltantes | UI muestra alimentos sin precio. |
| Moneda | Totales usan moneda configurada o indican mezcla. |
| Build/tests | Tests de calculo pasan y build pasa. |

### Riesgos

- Cambios de schema/sync pueden ser pesados. Implementar primero local/manual si no se requiere multiusuario inmediato.

## Dependencias Entre Sprints

| Sprint | Depende de | Motivo |
| --- | --- | --- |
| 1 | 0 | Configuracion base documentada. |
| 2 | 1 | Preferencias base y guards iniciales. |
| 3 | 1 | Requiere `usageMode`. |
| 4 | 1, 3 | Configuracion y UX simplificada. |
| 5 | 1 | Guards y preferencias. |
| 6 | 1 | Configuracion de widgets. |
| 7 | 1, 2 | UI responsive y preferencias base. |
| 8 | 1 | Plan/free-premium y branding base. |
| 9 | 1 | Fix register y roles. |
| 10 | 2 | UX mobile/portal. |
| 11 | 10 | Portal/mensajes estabilizados. |
| 12 | 1, 4 | Preferencias y consentimiento IA visible. |
| 13 | 1 | Moneda/preferencias base. |

## Checklist Antes De Empezar Cada Sprint

1. Leer el sprint en este documento.
2. Revisar archivos probables y confirmar estado actual con `Read`/`Grep`.
3. Confirmar que no existe implementacion ya completa.
4. Hacer cambios minimos.
5. Agregar o actualizar tests si hay logica nueva.
6. Ejecutar quality gates.
7. Documentar pendientes si algo queda fuera de alcance.

## Lista De No Olvidar

| Pendiente | Sprint |
| --- | --- |
| Corregir `authApi.register()` para admin auth real. | 1 |
| Centralizar preferencias en `preferencesStore`. | 1 |
| Quitar `localStorage` manual de IA en settings. | 1 |
| Diferenciar IA apagada por usuario vs por entorno. | 1 |
| Aplicar guard a formularios largos. | 1, 5 |
| No introducir Bootstrap. | 2 |
| Crear modo principiante reversible. | 3 |
| Configurar secciones del expediente sin borrar datos. | 4 |
| Evaluar drafts locales seguros. | 5 |
| Reutilizar `DashboardConfig`. | 6 |
| Agregar vistas semana/lista en agenda. | 7 |
| Usar `rescheduleAppointmentUC` desde UI. | 7 |
| PDF free/premium con defaults compatibles. | 8 |
| UI admin de usuarios/sedes. | 9 |
| Mejorar PWA sin cachear datos sensibles en SW. | 10 |
| Reemplazar polling por WebSocket con fallback. | 11 |
| Exigir consentimiento IA por paciente. | 12 |
| No inventar precios reales. | 13 |

## Pendientes Fuera De Codigo

| Tema | Razon |
| --- | --- |
| Staging real | Requiere entorno, dominio, proxy, secrets y datos controlados. |
| Pentest/security review | Necesario antes de produccion clinica. |
| Revision legal/NOM/compliance | Debe validarse con especialista legal/regulatorio. |
| Backup/restore real | Requiere infraestructura final y pruebas de recuperacion. |
| Politica IA | Requiere consentimiento, terminos y revision de proveedores. |
| Precios reales de alimentos | Requiere fuente de datos/licencia/carga por usuario. |

## Plantilla De Cierre Por Sprint

Al terminar cada sprint, registrar en la respuesta de cierre:

```md
Sprint N completado

Cambios:
- ...

Archivos:
- ...

Validacion:
- pnpm typecheck: pasa/falla
- tests focalizados: pasa/falla
- pnpm build: pasa/falla

Pendientes:
- ...
```
