# Pagina Inventario ERP

Ruta `/inventory/erp`, disponible en el menu de todos los usuarios autenticados
activos. Es independiente de Productos locales y de Almacenes ERP (administracion).
Consulta existencias sin editar productos ni cambiar permisos de cotizacion.

Usa solamente el core autenticado: `/api/inventory/erp` y
`/api/inventory/erp/warehouses`. Nunca llama directamente a Proscai ni incluye
claves internas en el bundle.

Tabla MUI paginada: EAN, codigo ERP, descripcion, unidad, almacen y existencia.
Busqueda de 400 ms, filtros por almacen y existencia, orden por encabezado,
25 filas iniciales y opciones 10/25/50/100. No se mantienen filas de otro filtro;
las solicitudes obsoletas son cancelables. Los ceros, negativos y null se
distinguen; null se presenta como raya, sin inventar existencia cero.
El input conserva lo escrito. La peticion y la clave de consulta usan busqueda
normalizada (NFC, trim, mayusculas), con el mismo debounce de 400 ms.

Actualizar consulta inventario y almacenes. Los errores muestran toast con
reintento y feedback dentro de la pagina; un fallo no se muestra como resultado
vacio exitoso. La hora de ultima consulta corresponde a `fetchedAt` del core.
Si falla actualizar almacenes y existe una lista previa con opciones, el
selector sigue utilizable y el aviso indica que se conserva la ultima lista.
Sin datos disponibles se mantiene el error con reintento. Todos los codigos
reales, incluidos ANOID y |, se presentan sin inventar nombres de sucursal.
En movil los filtros se apilan y la tabla permite scroll horizontal y vertical.

En Configuracion del sistema > Inventario ERP, el administrador puede mostrar
todos los almacenes (predeterminado) o elegir una lista global. Una seleccion
vacia oculta todo el inventario. Al guardar se renuevan los datos y opciones
de la consulta, sin afectar Almacenes ERP ni los permisos para cotizar.

Pruebas: `node --test scripts/*.test.mjs`, lint de los archivos modificados y
`npm run build:staging`. No hay migraciones, paquetes ni variables nuevas.
Actualizar primero backend ERP y core, y validar en staging antes de produccion.
Ningun commit, push, integracion o despliegue es implicito al implementar.
