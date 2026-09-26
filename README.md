# Motory

**Tu taller, bajo control.**

MVP web interno para inventario y ventas de un taller de motos (una sede, un usuario). Sin autenticacion.

## Arquitectura

```
packages/
  shared/   Tipos y constantes compartidos
  api/      AWS SAM — API Gateway HTTP API + Lambda + DynamoDB
  web/      Vite + React + TypeScript (Amplify Hosting)
```

- Frontend: React + TypeScript, identidad Motory (azul `#1264F5`, navy `#081D35`, Inter, Lucide).
- Backend: Node.js 20 Lambda (ARM64), HTTP API, DynamoDB on-demand.
- IaC: AWS SAM (`packages/api/template.yaml`) + Amplify (`amplify.yml`).
- Sin Cognito, SQS, SNS ni S3 de negocio.

**Perfil AWS:** usar `jdquintero` (cuenta personal). No usar perfiles Fika.

## Modelo de datos (DynamoDB)

Tres tablas claras (no single-table):

| Tabla | PK | GSIs |
|-------|----|------|
| `*-products` | `productId` | GSI1 `gsi1pk`/`gsi1sk` (STATUS#ACTIVE\|INACTIVE + NAME#) |
| `*-movements` | `movementId` | GSI1 fecha global; GSI2 por producto |
| `*-sales` | `saleId` | GSI1 fecha |

### Access patterns principales

1. Listar productos activos / inactivos
2. CRUD + soft-delete / restore
3. Busqueda unificada (nombre, SKU, categoria, marca/modelo/ano) — filtro en memoria sobre catalogo pequeno
4. Ingreso (PURCHASE) y ajuste (ADJUSTMENT) con actualizacion atomica de stock
5. Venta multi-item con `TransactWriteItems` (todo-o-nada)
6. Historial de movimientos y ventas por rango
7. Reportes / dashboard agregados en Lambda

### Decisiones tecnicas

- **Stock:** se mantiene en `Product.stock` para lecturas rapidas; toda modificacion genera movimiento.
- **Soft delete:** `isActive = false`; no borra historial.
- **COGS aproximado:** se guarda `lastPurchaseCost` en el producto (ultimo ingreso) y `unitCostEstimate` en movimientos SALE. No es FIFO ni contabilidad formal.
- **Valor inventario:** `suma(stock * lastPurchaseCost)` (sin costo -> 0).
- **Categorias:** constante en codigo (`Aceites`, `Filtros`, ...). Evolucionable a tabla despues.
- **API sin auth:** aceptable para MVP interno 1 usuario; la URL es el secreto. CORS restringido a localhost + dominio Amplify.

## Endpoints

Base: `{ApiUrl}/api/v1`

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/products` | Listar / buscar (`q`, `category`, `lowStock`, `inactiveOnly`) |
| POST | `/products` | Crear |
| GET | `/products/:id` | Detalle |
| PUT | `/products/:id` | Actualizar |
| DELETE | `/products/:id` | Soft delete |
| POST | `/products/:id/restore` | Restaurar |
| POST | `/inventory/entries` | Ingreso (PURCHASE) |
| POST | `/inventory/adjustments` | Ajuste |
| GET | `/inventory/movements` | Historial (`preset`, `from`, `to`, `type`, `productId`) |
| POST | `/sales` | Nueva venta |
| GET | `/sales` | Listar ventas |
| GET | `/sales/:id` | Detalle venta |
| GET | `/reports/summary` | Reporte (`preset=today\|week\|month` o `from`/`to`) |
| GET | `/dashboard` | Resumen home |

## Variables de entorno

### API (Lambda / local)

| Variable | Descripcion |
|----------|-------------|
| `PRODUCTS_TABLE` | Tabla productos |
| `MOVEMENTS_TABLE` | Tabla movimientos |
| `SALES_TABLE` | Tabla ventas |
| `CORS_ORIGINS` | Origenes permitidos, separados por coma |

### Web

| Variable | Descripcion |
|----------|-------------|
| `VITE_API_URL` | URL base de la API (incluye `/Prod` del stage SAM) |

Copia `packages/web/.env.example` a `packages/web/.env`.

## Ejecucion local

Requisitos: Node 20+, AWS SAM CLI (para API local), Docker (para `sam local`).

```bash
npm install
npm run build:shared
npm test
npm run typecheck

# Frontend (necesita VITE_API_URL apuntando a API desplegada o local)
cp packages/web/.env.example packages/web/.env
npm run dev:web
```

API local (opcional):

```bash
cd packages/api
AWS_PROFILE=jdquintero sam build
AWS_PROFILE=jdquintero sam local start-api --env-vars env.json
```

## Deployment

### Backend (SAM)

```bash
cd packages/api
npm run build -w @motory/shared
AWS_PROFILE=jdquintero sam build
AWS_PROFILE=jdquintero sam deploy --guided
# o con samconfig.toml:
AWS_PROFILE=jdquintero sam deploy
```

Tras el deploy, copia el output `ApiUrl` a:

1. `packages/web/.env` -> `VITE_API_URL=...`
2. Parametro `CorsOrigins` del stack (incluye la URL de Amplify cuando exista)

### Frontend (Amplify Hosting)

1. Conecta el repo en Amplify (usa `amplify.yml` en la raiz).
2. Define variable de entorno `VITE_API_URL` en Amplify.
3. Build segun `amplify.yml` (instala workspaces, build shared + web).

## Pantallas

| Ruta | Uso |
|------|-----|
| `/` | Dashboard |
| `/inventory` | Inventario + busqueda unificada |
| `/inventory/new` | Crear producto |
| `/inventory/:id` | Editar / desactivar |
| `/inventory/:id/entry` | Ingreso de stock |
| `/inventory/inactive` | Restaurar inactivos |
| `/sales/new` | POS |
| `/sales/:id` | Confirmacion de venta |
| `/movements` | Historial |
| `/reports` | Reportes |

## Tests

```bash
npm test
```

Cubre reglas de negocio: crear producto, ingreso, stock, impedir negativo, venta multi-item, rollback si falta stock, totales, soft delete, producto inactivo no vendible, movimientos, busqueda por moto.

## Costos MVP

DynamoDB PAY_PER_REQUEST, Lambda ARM64 256 MB, HTTP API, Amplify Hosting free tier. Sin servicios adicionales.

## Marca

- Primario: `#1264F5` / Secundario: `#081D35`
- Tipografia: Inter
- Tagline: *Tu taller, bajo control.*

## Entorno desplegado (us-east-1)

Stack: `motory-inventory` (perfil AWS default / jdquintero)

| Recurso | URL / nombre |
|---------|----------------|
| Web | https://main.dwxu5smcu1m2v.amplifyapp.com |
| API | https://ze0xqvodd2.execute-api.us-east-1.amazonaws.com/Prod |
| Logo (S3) | https://motory-inventory-assets.s3.us-east-1.amazonaws.com/brand/logo.jpg |
| Assets bucket | `motory-inventory-assets` |
| Web bucket | `motory-inventory-web` |

Para redeploy web tras cambios:

```bash
npm run build:web
aws s3 sync packages/web/dist s3://motory-inventory-web/ --delete
```

Para actualizar el logo:

```bash
aws s3 cp assets/logo.jpg s3://motory-inventory-assets/brand/logo.jpg --content-type image/jpeg
```