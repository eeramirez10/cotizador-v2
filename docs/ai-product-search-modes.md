# Búsqueda IA de productos: modos del cotizador

Este documento describe la integración compartida entre `cotizador-v2`, `New Project` y `tuvansa-backend-gpt`.
Mantenerlo actualizado cuando cambien las rutas o el contrato de resultados.

## Objetivo

El modal **Vincular partida con producto ERP** permite comparar tres estrategias de búsqueda para una
descripción de cliente. Las tres entregan la misma forma de fila al frontend: ICOD, EAN, descripción,
unidad, costos y existencias por sucursal.

| Selector en el modal | Backend del cotizador | Comportamiento |
| --- | --- | --- |
| `V2 híbrido` | `POST /api/ai/products/similar-v2` | Embedding de Voyage/Pinecone más parser y reordenamiento técnico. |
| `Embedding puro` | `POST /api/ai/products/similar-v2/semantic` | Orden directo del embedding, sin parser, bonificaciones ni penalizaciones técnicas. |
| `Catálogo anterior` | `POST /api/ai/products/similar` | Implementación previa; se conserva para comparar y regresar si fuera necesario. |

## Proyecto de vectorización

`tuvansa-backend-gpt` es el backend que consulta Voyage y Pinecone para el catálogo v2.

- Ubicación local: `/Users/erick/Documents/dev/GPT/tuvansa-backend-gpt`
- Puerto local: `5500`
- Rutas consumidas por `New Project`:
  - `POST /api/vector-catalog/search`
  - `POST /api/vector-catalog/search/semantic`

## Flujo compartido

```text
cotizador-v2 (frontend)
  -> New Project :4500
      -> tuvansa-backend-gpt :5500
          -> Voyage + Pinecone proscai-catalog-v2
      -> tuvansa-backend-ca :3500
          -> Proscai: ICOD, costos y stock
```

`New Project` adapta los resultados de v2 a la tabla del cotizador y añade disponibilidad, costos y
sucursales. El frontend no consulta Pinecone ni Proscai directamente.

## Reglas importantes

- `Embedding puro` debe conservar el orden que devuelve Pinecone. Solo se elimina un EAN duplicado
  conservando su primera aparición para mostrar productos, no variantes repetidas.
- En `Embedding puro`, `semanticSimilarity` y `finalSimilarity` son iguales y
  `rankingStrategy` debe ser `SEMANTIC_ONLY`.
- El frontend no debe ordenar `Embedding puro` nuevamente. Esto está controlado en
  `src/shared/components/modals/add-erp-products.modal.tsx`.
- `V2 híbrido` puede hacer fallback automático al catálogo anterior ante error de red, `404` o `5xx`.
  Los modos `Embedding puro` y `Catálogo anterior` son explícitos y no cambian de motor por sí solos.
- El servicio de Voyage reserva hasta 25 segundos entre embeddings. `New Project` usa un timeout de
  40 segundos para no abortar una búsqueda cuando el usuario alterna entre motores.

## Configuración

En `cotizador-v2/.env`:

```env
VITE_AI_API_URL=http://localhost:4600
VITE_AI_SIMILAR_PRODUCTS_PATH=/api/ai/products/similar-v2
VITE_AI_SIMILAR_PRODUCTS_SEMANTIC_PATH=/api/ai/products/similar-v2/semantic
VITE_AI_SIMILAR_PRODUCTS_FALLBACK_PATH=/api/ai/products/similar
```

En `New Project/.env`:

```env
AI_PLATFORM_BASE_URL=http://localhost:4700
CATALOG_V2_SEARCH_TIMEOUT_MS=40000
```

## Caso de validación

Consulta:

```text
SEAMLESS PIPE A312 TP316/316L BE 6 IN S-10S
```

El modo `Embedding puro` debe devolver primero `TSC610AI316`: tubo de acero inoxidable 316, sin
costura, 6 pulgadas, cédula 10. Si el híbrido coloca `TSC680AI316` primero, el problema está en sus
reglas de normalización o reordenamiento, no en Pinecone/Voyage.

## Archivos relevantes

- Frontend: `src/modules/ai/services/ai-similar-products.service.ts`
- Frontend: `src/queries/products/use-ai-similar-product-search.ts`
- Frontend: `src/shared/components/modals/add-erp-products.modal.tsx`
- Backend del cotizador: `web/ai-products.http`
- Índice v2: `web/vector-catalog-v2.http` en `tuvansa-backend-gpt`
