# Redis App Template

Basic Docker Compose template with:

- React frontend
- Express backend
- Redis database

## Run

```bash
docker compose up --build
```

## URLs

- Frontend: http://localhost:5173
- Backend health endpoint: http://localhost:3000/health
- Redis: localhost:6379

## Estructura del proyecto

redis-app-template/
│
├── backend/
│ │ // Backend de la aplicación
│ │
│ ├── src/
│ │ │ // Código fuente del backend
│ │ │
│ │ ├── server.js
│ │ │ // Servidor Express y endpoints de la API
│ │ │
│ │ ├── redis.js
│ │ │ // Conexión y configuración del cliente Redis
│ │ │
│ │ └── scripts/
│ │ // Scripts para inicializar datos en Redis
│ │
│ │ └── seed.js
│ │ // Carga de los datos iniciales de Redibus
│ │
│ ├── Dockerfile
│ │ // Configuración de la imagen Docker del backend
│ │
│ └── package.json
│ // Dependencias y comandos del backend
│
├── frontend/
│ │ // Interfaz web de Redibus
│ │
│ ├── src/
│ │ │ // Código fuente del frontend
│ │ │
│ │ ├── App.jsx
│ │ │ // Componente principal de la aplicación
│ │ │
│ │ ├── main.jsx
│ │ │ // Punto de entrada de React
│ │ │
│ │ └── styles.css
│ │ // Estilos de la aplicación
│ │
│ ├── Dockerfile
│ │ // Configuración de la imagen Docker del frontend
│ │
│ ├── index.html
│ │ // Documento HTML principal
│ │
│ ├── package.json
│ │ // Dependencias y comandos del frontend
│ │
│ └── vite.config.js
│ // Configuración de Vite y proxy hacia el backend
│
├── docker-compose.yml
│ // Configuración y coordinación de los contenedores
│
└── README.md
// Documentación del proyecto
