# 🌳 Tree Inventory Importer — Docker Installation Guide

## Prerequisites

Make sure the following are installed on your machine before proceeding:

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (includes Docker Compose)
- [XAMPP](https://www.apachefriends.org/) — optional, only if you want phpMyAdmin access

> ⚠️ If XAMPP is installed and MySQL is running, it occupies port **3306**.
> This is fine — the Docker MySQL container runs internally and does **not** conflict with it.

---

## Project Structure

```
tree-importer/
├── docker-compose.yml
├── backend/
│   ├── Dockerfile
│   ├── app.py
│   └── requirements.txt
└── frontend/
    ├── Dockerfile
    ├── package.json
    └── src/
```

---

## First-Time Setup

### 1. Clone or extract the project

Place the project folder somewhere on your machine, e.g.:

```
C:\Projects\tree-importer
```

### 2. Open a terminal in the project root

```bash
cd C:\Projects\tree-importer
```

### 3. Build and start all containers

```bash
docker-compose up --build
```

This will:
- Pull the **MySQL 8.0**, **Python 3.12**, and **Node 20** images
- Install all Python and Node dependencies
- Start 3 containers: `tree_mysql`, `tree_backend`, `tree_frontend`
- Auto-create the `tree_management` database and tables on first run

> ⏱️ First build takes **2–5 minutes** depending on your internet speed.
> Subsequent starts are much faster.

### 4. Open the app

Once you see this in the terminal:

```
tree_frontend  | webpack compiled successfully
tree_backend   | [startup] Database and tables ready.
tree_backend   |  * Running on http://0.0.0.0:5000
```

Open your browser and go to:

```
http://localhost:3001
```

---

## Running After First Build

Once the images are already built, just run:

```bash
docker-compose up
```

No `--build` flag needed unless you changed source files.

### Run in the background (detached mode)

```bash
docker-compose up -d
```

To view logs while running detached:

```bash
docker-compose logs -f
```

---

## Stopping the App

```bash
docker-compose down
```

This stops and removes the containers but **keeps your database data**.

To also wipe the database volume:

```bash
docker-compose down -v
```

---

## Rebuilding After Code Changes

| What changed | Command |
|---|---|
| Just starting the app | `docker-compose up` |
| Changed `app.py` | `docker-compose up --build` |
| Changed `App.js` or any frontend file | `docker-compose up --build` |
| Changed `requirements.txt` | `docker-compose up --build` |
| Changed `package.json` | `docker-compose up --build` |

---

## Container Overview

| Container | Image | Port | Role |
|---|---|---|---|
| `tree_mysql` | mysql:8.0 | internal only | Database |
| `tree_backend` | python:3.12-slim | `5000` | Flask API |
| `tree_frontend` | node:20-alpine | `3001` | React UI |

---

## Useful Commands

```bash
# Check running containers
docker-compose ps

# View logs for all containers
docker-compose logs -f

# View logs for one container
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f db

# Restart a single container
docker-compose restart backend

# Stop everything
docker-compose down
```

---

## Troubleshooting

### Port 3001 already in use
Another app is using port 3001. Change the frontend port in `docker-compose.yml`:
```yaml
ports:
  - "3002:3001"   # change left side only
```
Then access the app at `http://localhost:3002`.

### Port 5000 already in use
Change the backend port in `docker-compose.yml`:
```yaml
ports:
  - "5001:5000"   # change left side only
```

### Proxy error / backend not reachable
Make sure `frontend/package.json` has:
```json
"proxy": "http://backend:5000"
```
Not `127.0.0.1` — that only works when running locally without Docker.

### Database table doesn't exist
The backend auto-creates tables on startup. If it fails, click **Init / Reset DB** in the UI header. This is safe — it never deletes existing data.

### Cannot connect to MySQL
Wait 10–15 seconds after starting — MySQL needs time to initialize on first run. The backend retries automatically up to 10 times.

---

## Database Access via phpMyAdmin (Optional)

If you have XAMPP installed, you can connect phpMyAdmin to the Docker MySQL container:

1. Open phpMyAdmin: `http://localhost/phpmyadmin`
2. Click **New Server** or edit `config.inc.php`
3. Add a server with host `127.0.0.1`, port `3307` *(or whichever port you expose)*

> By default the Docker MySQL port is **not exposed** to the host to avoid conflicts with XAMPP. To expose it, add a port in `docker-compose.yml` under the `db` service — but only if XAMPP MySQL is stopped first.
