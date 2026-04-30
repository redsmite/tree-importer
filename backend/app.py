from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import mysql.connector
from mysql.connector import Error
import json
import io
from datetime import date
import traceback

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

# ─── DB CONFIG ────────────────────────────────────────────────────────────────
DB_CONFIG = {
    "host": "localhost",
    "user": "root",
    "password": "",          # XAMPP default is empty — change if needed
    "port": 3306,
}
DB_NAME = "tree_management"

DEFAULT_COLUMN_MAP = {
    "tree_no":               1,
    "common_name":           2,
    "dbh":                   3,
    "mh":                    4,
    "th":                    5,
    "gross_volume":          6,
    "trees_defect":          7,
    "trees_longitude":       8,
    "trees_latitude":        9,
    "hazard_rating":         10,
    "nog":                   11,
    "evaluation":            12,
    "recommendation_type":   13,
    "recommendation_action": 14,
    "recommendation":        15,
}


def get_connection(with_db=True):
    cfg = DB_CONFIG.copy()
    if with_db:
        cfg["database"] = DB_NAME
    return mysql.connector.connect(**cfg)


def read_file(file, header_row):
    filename = file.filename.lower()
    raw = file.read()
    if filename.endswith(".csv"):
        for enc in ("utf-8", "utf-8-sig", "latin-1", "cp1252"):
            try:
                df = pd.read_csv(io.BytesIO(raw), header=header_row - 1, encoding=enc, dtype=str)
                return df.reset_index(drop=True)
            except UnicodeDecodeError:
                continue
        raise ValueError("Could not decode CSV — try saving as UTF-8.")
    else:
        df = pd.read_excel(io.BytesIO(raw), header=header_row - 1, dtype=str)
        return df.reset_index(drop=True)


@app.route("/api/test-connection", methods=["GET"])
def test_connection():
    try:
        conn = get_connection(with_db=False)
        conn.close()
        return jsonify({"success": True, "message": "Connected to MySQL successfully."})
    except Error as e:
        return jsonify({"success": False, "message": str(e)})


@app.route("/api/init-db", methods=["POST"])
def init_db():
    try:
        conn = get_connection(with_db=False)
        cur = conn.cursor()
        cur.execute(f"CREATE DATABASE IF NOT EXISTS `{DB_NAME}`")
        cur.execute(f"USE `{DB_NAME}`")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS tcp_narrative_report (
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
            )
        """)
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"success": True, "message": f"Database '{DB_NAME}' and table 'tcp_narrative_report' are ready."})
    except Error as e:
        return jsonify({"success": False, "message": str(e)})


@app.route("/api/upload", methods=["POST"])
def upload():
    try:
        file         = request.files.get("file")
        app_id       = request.form.get("app_id", "") or None
        officer_id   = request.form.get("action_officer_id", "") or None
        header_row   = int(request.form.get("header_row", 1))
        col_map_json = request.form.get("column_map", "{}")
        col_map      = {**DEFAULT_COLUMN_MAP, **json.loads(col_map_json)}

        if not file:
            return jsonify({"success": False, "message": "No file provided."})

        filename = file.filename.lower()
        if not (filename.endswith(".xlsx") or filename.endswith(".xls") or filename.endswith(".csv")):
            return jsonify({"success": False, "message": "Only .xlsx, .xls, or .csv files are supported."})

        try:
            df = read_file(file, header_row)
        except Exception as e:
            return jsonify({"success": False, "message": f"Could not read file: {str(e)}"})

        today = date.today().strftime("%Y-%m-%d")

        try:
            conn = get_connection()
        except Error as e:
            return jsonify({"success": False, "message": f"DB connection failed: {str(e)}"})

        cur = conn.cursor()
        inserted = 0
        errors   = []

        for idx, row in df.iterrows():
            def cell(col_idx, r=row):
                try:
                    val = r.iloc[col_idx]
                    if pd.isna(val):
                        return None
                    s = str(val).strip()
                    if s.endswith(".0") and s[:-2].lstrip("-").isdigit():
                        s = s[:-2]
                    return s if s else None
                except Exception:
                    return None

            try:
                cur.execute("""
                    INSERT INTO tcp_narrative_report (
                        app_id, date_created, action_officer_id,
                        tree_no, common_name, dbh, mh, th, gross_volume,
                        trees_defect, trees_longitude, trees_latitude,
                        hazard_rating, evaluation, nog,
                        recommendation_action, recommendation,
                        status, recommendation_type
                    ) VALUES (
                        %s,%s,%s, %s,%s,%s,%s,%s,%s,
                        %s,%s,%s, %s,%s,%s, %s,%s, %s,%s
                    )
                """, (
                    app_id, today, officer_id,
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
        # Build INSERT SQL statements for preview (excluding id — it's AUTO_INCREMENT)
        sql_statements = []
        conn2 = get_connection()
        cur2  = conn2.cursor(dictionary=True)
        cur2.execute(
            "SELECT * FROM tcp_narrative_report ORDER BY id DESC LIMIT %s",
            (inserted,)
        )
        rows = list(reversed(cur2.fetchall()))
        cur2.close()
        conn2.close()

        fields = [
            'app_id','date_created','action_officer_id','tree_no','common_name',
            'dbh','mh','th','gross_volume','trees_defect','trees_longitude',
            'trees_latitude','hazard_rating','evaluation','nog',
            'recommendation_action','recommendation','status','recommendation_type'
        ]

        def sql_val(v):
            if v is None:
                return 'NULL'
            return "'" + str(v).replace("'", "''") + "'"

        for r in rows:
            vals = ', '.join(sql_val(r.get(f)) for f in fields)
            cols = ', '.join(fields)
            sql_statements.append(
                f"INSERT INTO tcp_narrative_report ({cols}) VALUES ({vals});"
            )

        return jsonify({"success": True, "inserted": inserted, "total": len(df), "errors": errors, "sql_statements": sql_statements})

    except Exception as e:
        traceback.print_exc()
        return jsonify({"success": False, "message": f"Unexpected error: {str(e)}"})


@app.route("/api/trees", methods=["GET"])
def get_trees():
    try:
        conn = get_connection()
        cur  = conn.cursor(dictionary=True)
        cur.execute("SELECT * FROM tcp_narrative_report ORDER BY id DESC LIMIT 200")
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return jsonify({"success": True, "data": rows})
    except Error as e:
        return jsonify({"success": False, "message": str(e)})


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
