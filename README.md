# 🌳 Tree Inventory Importer

A full-stack app that reads an Excel file and imports tree inventory records into a local XAMPP MySQL database.

---

## 📁 Project Structure

```
tree-importer/
├── backend/
│   ├── app.py              ← Flask API
│   └── requirements.txt
└── frontend/
    ├── public/index.html
    ├── src/
    │   ├── App.js
    │   ├── App.css
    │   ├── index.js
    │   └── index.css
    └── package.json
```

---

## ⚙️ Prerequisites

- **XAMPP** running with **Apache + MySQL** on port 3306
- **Python 3.9+**
- **Node.js 18+** and **npm**

---

## 🚀 Setup & Run

### 1. Start XAMPP
Open XAMPP Control Panel → Start **Apache** and **MySQL**.

---

### 2. Backend (Flask)

```bash
cd backend
pip install -r requirements.txt
python app.py
```

The API will run at `http://localhost:5000`.

> If your MySQL has a root password, edit `DB_CONFIG` in `app.py`:
> ```python
> DB_CONFIG = {
>     "host": "localhost",
>     "user": "root",
>     "password": "YOUR_PASSWORD",
>     "port": 3306,
> }
> ```

---

### 3. Frontend (React)

```bash
cd frontend
npm install
npm start
```

The UI will open at `http://localhost:3000`.

---

## 📋 Usage

1. **Open** `http://localhost:3000`
2. Click **Init / Reset DB** to create the `tree_management` database and `trees` table
3. Go to **⚙ Column Map** to verify or adjust Excel column mappings
4. Go to **↑ Import**:
   - Drop your `.xlsx` file
   - Enter **App ID** and **Action Officer ID**
   - Set **Header Row** (default: row 1)
   - Click **↑ Import to MySQL**
5. View results in **⊞ Records** tab

---

## 🗺️ Default Excel Column Mapping

| DB Field               | Excel Column | Index |
|------------------------|:------------:|:-----:|
| tree_no                | B            | 1     |
| common_name            | C            | 2     |
| dbh                    | D            | 3     |
| mh                     | E            | 4     |
| th                     | F            | 5     |
| gross_volume           | G            | 6     |
| trees_defect           | H            | 7     |
| trees_longitude        | I            | 8     |
| trees_latitude         | J            | 9     |
| hazard_rating          | K            | 10    |
| nog                    | L            | 11    |
| evaluation             | M            | 12    |
| recommendation_type    | N            | 13    |
| recommendation_action  | O            | 14    |
| recommendation         | P            | 15    |

> **app_id** and **action_officer_id** come from the UI form.  
> **date_created** is set to today's date automatically.  
> **status** defaults to `Active`.  
> **id** is auto-incremented by MySQL.

---

## 🗄️ Database Schema

```sql
CREATE DATABASE IF NOT EXISTS tree_management;

CREATE TABLE trees (
    id                    INT(20) AUTO_INCREMENT PRIMARY KEY,
    app_id                INT(20),
    date_created          VARCHAR(200),
    action_officer_id     INT(20),
    tree_no               VARCHAR(200),
    common_name           TEXT,
    dbh                   VARCHAR(200),
    mh                    VARCHAR(200),
    th                    VARCHAR(200),
    gross_volume          VARCHAR(200),
    trees_defect          TEXT,
    trees_longitude       VARCHAR(200),
    trees_latitude        VARCHAR(200),
    hazard_rating         VARCHAR(200),
    evaluation            TEXT,
    nog                   VARCHAR(200),
    recommendation_action VARCHAR(200),
    recommendation        TEXT,
    status                VARCHAR(200) DEFAULT 'Active',
    recommendation_type   VARCHAR(200)
);
```
