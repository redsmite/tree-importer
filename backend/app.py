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

DB_CONFIG = {
    "host": "localhost",
    "user": "root",
    "password": "",
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
        cur.execute("""
            CREATE TABLE IF NOT EXISTS tcp_narrative_report_attachment (
                id                      INT(20) AUTO_INCREMENT PRIMARY KEY,
                tcp_narrative_report_id VARCHAR(200),
                file_name               VARCHAR(200),
                file_location           VARCHAR(200),
                date_uploaded           VARCHAR(200),
                type                    VARCHAR(200)
            )
        """)
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"success": True, "message": f"Database '{DB_NAME}' and tables are ready."})
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

        # ── Allowed values ────────────────────────────────────────────────────
        VALID_NOG                   = ['Planted', 'Natural']
        VALID_RECOMMENDATION_ACTION = ['CUT', 'PRUNE', 'BALL', 'DEAD', 'RETAIN']
        VALID_RECOMMENDATION_TYPE   = ['TREE', 'PALM', 'DEAD', 'BAMBOO', 'BUSH']
        VALID_HAZARD_RATING         = ['Low', 'Moderate', 'High', 'Extreme']

        # ── PASS 1: validate ALL rows first ───────────────────────────────────
        validation_errors = []

        def cell_from(row, col_idx):
            try:
                val = row.iloc[col_idx]
                if pd.isna(val):
                    return None
                s = str(val).strip()
                if s.endswith(".0") and s[:-2].lstrip("-").isdigit():
                    s = s[:-2]
                return s if s else None
            except Exception:
                return None

        for idx, row in df.iterrows():
            excel_row = idx + 2
            nog_val      = cell_from(row, col_map["nog"])
            rec_act      = cell_from(row, col_map["recommendation_action"])
            rec_type     = cell_from(row, col_map["recommendation_type"])
            hazard_val   = cell_from(row, col_map["hazard_rating"])
            tree_no      = cell_from(row, col_map["tree_no"]) or f"(row {excel_row})"

            if nog_val is not None and nog_val not in VALID_NOG:
                validation_errors.append(
                    f"Row {excel_row} [Tree: {tree_no}] — NOG: invalid value '{nog_val}'. "
                    f"Allowed: {', '.join(VALID_NOG)}"
                )
            if rec_act is not None and rec_act.upper() not in VALID_RECOMMENDATION_ACTION:
                validation_errors.append(
                    f"Row {excel_row} [Tree: {tree_no}] — Recommendation Action: invalid value '{rec_act}'. "
                    f"Allowed: {', '.join(VALID_RECOMMENDATION_ACTION)}"
                )
            if rec_type is not None and rec_type.upper() not in VALID_RECOMMENDATION_TYPE:
                validation_errors.append(
                    f"Row {excel_row} [Tree: {tree_no}] — Recommendation Type: invalid value '{rec_type}'. "
                    f"Allowed: {', '.join(VALID_RECOMMENDATION_TYPE)}"
                )
            if hazard_val is not None and hazard_val not in VALID_HAZARD_RATING:
                validation_errors.append(
                    f"Row {excel_row} [Tree: {tree_no}] — Hazard Rating: invalid value '{hazard_val}'. "
                    f"Allowed: {', '.join(VALID_HAZARD_RATING)}"
                )

        # ── Abort if any validation error ─────────────────────────────────────
        if validation_errors:
            conn.close()
            return jsonify({
                "success": False,
                "aborted": True,
                "inserted": 0,
                "total": len(df),
                "skipped": 0,
                "errors": validation_errors,
                "sql_statements": [],
                "message": f"Import aborted — {len(validation_errors)} validation error(s) found. No rows were inserted. Fix the errors and re-import."
            })

        # ── PASS 2: insert everything ─────────────────────────────────────────
        cur = conn.cursor()
        inserted = 0
        errors   = []

        for idx, row in df.iterrows():
            excel_row = idx + 2

            def cell(col_idx, r=row):
                return cell_from(r, col_idx)

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
                errors.append(f"Row {excel_row}: {str(e)}")

        conn.commit()
        cur.close()
        conn.close()

        # ── Build INSERT SQL preview ──────────────────────────────────────────
        sql_statements = []
        conn2 = get_connection()
        cur2  = conn2.cursor(dictionary=True)
        cur2.execute(
            "SELECT * FROM tcp_narrative_report ORDER BY id DESC LIMIT %s",
            (inserted,)
        )
        rows2 = list(reversed(cur2.fetchall()))

        # Also return tree_no list for the attachment UI
        tree_rows = [{"id": r["id"], "tree_no": r["tree_no"]} for r in rows2]

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

        for r in rows2:
            vals = ', '.join(sql_val(r.get(f)) for f in fields)
            cols = ', '.join(fields)
            sql_statements.append(
                f"INSERT INTO tcp_narrative_report ({cols}) VALUES ({vals});"
            )

        return jsonify({
            "success": True,
            "inserted": inserted,
            "total": len(df),
            "skipped": 0,
            "errors": errors,
            "sql_statements": sql_statements,
            "tree_rows": tree_rows,
        })

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
