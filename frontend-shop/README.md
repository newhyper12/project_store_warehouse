# Frontend

```bash
npm install
cp .env.example .env  # set VITE_API_URL=http://your-backend:8000
npm run dev
npm run build         # output: dist/
```

Serve `dist/` with nginx, Caddy, or any static host. Example nginx:

```nginx
server {
  listen 80;
  server_name shop.example.com;
  root /var/www/frontend-shop/dist;
  index index.html;
  location / { try_files $uri /index.html; }
}
```
