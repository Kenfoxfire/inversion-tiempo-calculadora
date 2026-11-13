# Ritmo — Calculadora de inversión de tiempo

Calcula una semana tipo por categorías y visualiza cómo se distribuye el tiempo durante un día o una semana. Puedes activar trabajo y almuerzo, agregar actividades con nombre propio y asignar horas y minutos de lunes a domingo. La categoría Estudio es fija y no se puede marcar como distracción.

Marca otras actividades como distracción para revisar su peso junto con Estudio, por semana, mes promedio y año, tanto en duración como en porcentaje del tiempo disponible. Puedes crear una alternativa a partir de la distribución base, modificarla y comparar los totales sin mantener una cronología.

La distribución base y su alternativa se guardan automáticamente en el almacenamiento local del navegador. Usa **Descargar respaldo JSON** para conservar una copia o **Cargar respaldo JSON** para restaurarla en este u otro navegador.

## Desarrollo

```bash
npm install
npm start
```

Abre `http://localhost:4200/` en el navegador.

## Estimaciones y gráfico

- **Semana:** suma del tiempo programado en las categorías activas.
- **Mes promedio:** total semanal × 52 ÷ 12.
- **Año:** total semanal × 52.
- **Gráfico diario:** muestra la distribución para el día seleccionado sobre un total de 24 horas, o solo las horas registradas.
- **Gráfico semanal:** muestra la distribución semanal sobre un total de 168 horas, o solo las horas registradas.
- **Impacto:** Estudio y cada actividad marcada como distracción muestran duración y porcentaje del tiempo disponible para semana, mes promedio y año.
- **Comparación:** permite editar una alternativa independiente y contrastar el total semanal, Estudio y las distracciones marcadas con la distribución base.
- **Respaldo:** importa y exporta un archivo JSON versionado con ambas distribuciones. Se aceptan respaldos de la versión anterior.

El tiempo no asignado aparece como una categoría del gráfico cuando se elige el periodo completo. Si las actividades superan las horas disponibles, la calculadora avisa y muestra la proporción del tiempo registrado.

## Desplegar en Netlify

El archivo `netlify.toml` define el comando de compilación y la carpeta de publicación que espera Angular:

- **Build command:** `npm run build`
- **Publish directory:** `dist/inversion-tiempo-calculadora/browser`

La carpeta `browser` es la salida estática de Angular. Si Netlify conserva una configuración anterior en la interfaz, establece ahí también esa misma carpeta de publicación. Asegúrate de que el directorio base de Netlify sea la carpeta donde está este `package.json`.

```bash
npm run build
npm test -- --watch=false
```
