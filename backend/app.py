from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import mysql.connector
from mysql.connector import Error
import os
from datetime import date
import traceback

app = Flask(__name__)
CORS(app)

# ─── DB CONFIG ────────────────────────────────────────────────────────────────
DB_CONFIG = {
    "host": "localhost",
    "user": "root",
    "password": "",          # XAMPP default is empty
    "port": 3306,
}
DB_NAME = "tree_management"

# ─── COLUMN MAPPING  (Excel column index → DB field)  0-based ─────────────────
# B=1, C=2, D=3, E=4, F=5, G=6, H=7, I=8, J=9, K=10, L=11, M=12, N=13, O=14, P=15
DEFAULT_COLUMN_MAP = {
    "tree_no":               1,   # B
    "common_name":           2,   # C
    "dbh":                   3,   # D
    "mh":                    4,   # E
    "th":                    5,   # F
    "gross_volume":          6,   # G
    "trees_defect":          7,   # H
    "trees_longitude":       8,   # I
    "trees_latitude":        9,   # J
    "hazard_rating":         10,  # K
    "nog":                   11,  # L
    "evaluation":            12,  # M
    "recommendation_type":   13,  # N
    "recommendation_action": 14,  # O
    "recommendation":        15,  # P
}


def get_connection(with_db=True):
    cfg = DB_CONFIG.copy()
    if with_db:
        cfg["database"] = DB_NAME
    return mysql.connector.connect(**cfg)


# ─── INIT DATABASE ────────────────────────────────────────────────────────────
@app.route("/api/init-db", methods=["POST"])
def init_db():
    try:
        conn = get_connection(with_db=False)
        cur = conn.cursor()
        cur.execute(f"CREATE DATABASE IF NOT EXISTS `{DB_NAME}`")
        cur.execute(f"USE `{DB_NAME}`")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS trees (
                id                   INT(20) AUTO_INCREMENT PRIMARY KEY,
                app_id               INT(20),
                date_created         VARCHAR(200),
                action_officer_id    INT(20),
                tree_no              VARCHAR(200),
                common_name          TEXT,
                dbh                  VARCHAR(200),
                mh                   VARCHAR(200),
                th                   VARCHAR(200),
                gross_volume         VARCHAR(200),
                trees_defect         TEXT,
                trees_longitude      VARCHAR(200),
                trees_latitude       VARCHAR(200),
                hazard_rating        VARCHAR(200),
                evaluation           TEXT,
                nog                  VARCHAR(200),
                recommendation_action VARCHAR(200),
                recommendation       TEXT,
                status               VARCHAR(200) DEFAULT 'Active',
                recommendation_type  VARCHAR(200)
            )
        """)
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"success": True, "message": f"Database '{DB_NAME}' and table 'trees' ready."})
    except Error as e:
        return jsonify({"success": False, "message": str(e)}), 500


# ─── UPLOAD & IMPORT ──────────────────────────────────────────────────────────
@app.route("/api/upload", methods=["POST"])
def upload():
    try:
        file         = request.files.get("file")
        app_id       = request.form.get("app_id", "")
        officer_id   = request.form.get("action_officer_id", "")
        header_row   = int(request.form.get("header_row", 1))   # 1-based
        col_map_json = request.form.get("column_map", "{}")

        import json
        col_map = {**DEFAULT_COLUMN_MAP, **json.loads(col_map_json)}

        if not file:
            return jsonify({"success": False, "message": "No file provided."}), 400

        # Read Excel – skip rows before header
        df = pd.read_excel(file, header=header_row - 1)
        df = df.reset_index(drop=True)

        today = date.today().strftime("%Y-%m-%d")

        conn = get_connection()
        cur  = conn.cursor()

        inserted = 0
        errors   = []

        for idx, row in df.iterrows():
            def cell(col_idx):
                try:
                    val = row.iloc[col_idx]
                    return None if pd.isna(val) else str(val).strip()
                except Exception:
                    return None

            try:
                cur.execute("""
                    INSERT INTO trees (
                        app_id, date_created, action_officer_id,
                        tree_no, common_name, dbh, mh, th, gross_volume,
                        trees_defect, trees_longitude, trees_latitude,
                        hazard_rating, evaluation, nog,
                        recommendation_action, recommendation,
                        status, recommendation_type
                    ) VALUES (
                        %s,%s,%s, %s,%s,%s,%s,%s,%s, %s,%s,%s,
                        %s,%s,%s, %s,%s, %s,%s
                    )
                """, (
                    app_id or None,
                    today,
                    officer_id or None,
                    cell(col_map["tree_no"]),
                    cell(col_map["common_name"]),
                    cell(col_map["dbh"]),
                    cell(col_map["mh"]),
                    cell(col_map["th"]),
                    cell(col_map["gross_volume"]),
                    cell(col_map["trees_defect"]),
                    cell(col_map["trees_longitude"]),
                    cell(col_map["trees_latitude"]),
                    cell(col_map["hazard_rating"]),
                    cell(col_map["evaluation"]),
                    cell(col_map["nog"]),
                    cell(col_map["recommendation_action"]),
                    cell(col_map["recommendation"]),
                    "Active",
                    cell(col_map["recommendation_type"]),
                ))
                inserted += 1
            except Exception as e:
                errors.append(f"Row {idx + 2}: {str(e)}")

        conn.commit()
        cur.close()
        conn.close()

        return jsonify({
            "success": True,
            "inserted": inserted,
            "total": len(df),
            "errors": errors,
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({"success": False, "message": str(e)}), 500


# ─── FETCH RECORDS ────────────────────────────────────────────────────────────
@app.route("/api/trees", methods=["GET"])
def get_trees():
    try:
        conn = get_connection()
        cur  = conn.cursor(dictionary=True)
        cur.execute("SELECT * FROM trees ORDER BY id DESC LIMIT 200")
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return jsonify({"success": True, "data": rows})
    except Error as e:
        return jsonify({"success": False, "message": str(e)}), 500


# ─── TEST CONNECTION ──────────────────────────────────────────────────────────
@app.route("/api/test-connection", methods=["GET"])
def test_connection():
    try:
        conn = get_connection(with_db=False)
        conn.close()
        return jsonify({"success": True, "message": "Connected to MySQL successfully."})
    except Error as e:
        return jsonify({"success": False, "message": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True, port=5000)
