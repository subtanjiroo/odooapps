# -*- coding: utf-8 -*-
#
# Copyright (c) 2025 CanhCamsSolutions
# All rights reserved.
# Licensed under the CanhCamsSolutions Proprietary License.
#
# You may modify the source code for internal use only,
# but you may NOT remove or alter the author or company name.
# Commercial use, resale, or redistribution is strictly prohibited.
#
# See LICENSE file for full license terms.


import urllib.error
from odoo import models, fields,api
from odoo import http
from odoo.http import request
import re
import os
import html
import json
import logging
import time
import urllib.request
_logger = logging.getLogger(__name__)
#localhost_server: http://leandix_ai-ai_engine-back_end-1:5000
enviroment_api = "http://leandix_ai-ai_engine-back_end-1:5000"
class chat_model(models.Model):
    _name = 'leandix.ai.chat.model'
    _description = 'chat function in here'

    name = fields.Char(string='Name')

    @api.model
    def check_api_type(self):
        try:
            API_key = self.env["ir.config_parameter"].sudo().get_param("API_key")
            if not API_key or len(API_key) < 2:
                return "unknown"

            prefix = API_key[:2].lower()
            if prefix == "pl":
                return "public"
            elif prefix == "ld":
                return "leandix"
            else:
                return "unknown"

        except Exception as e:
            _logger.error(f"Error in check_api_type: {e}")
            return "error"
    
    @api.model
    def send_message_to_engine_api(self, message, history, chat_model, user_id,error = None):
        try:
            # Get User API_key for Server
            API_key = self.env["ir.config_parameter"].sudo().get_param("API_key")
            api_url = f"{enviroment_api}/chat"
            payload = {
                "message": message,
                "history": history or 'Tạm Thời Chưa Có History',
                "chat_model": chat_model,
                "user_id": user_id,
                "API_key": API_key,
                "error": error or 'None',
            }
            data_bytes = json.dumps(payload).encode('utf-8')
            req = urllib.request.Request(api_url, data=data_bytes, headers={
                "Content-Type": "application/json",
                "User-Agent": "Mozilla/5.0", 
            }, method="POST")

            with urllib.request.urlopen(req, timeout=120) as response:
                response_data = json.loads(response.read().decode())
            logging.info(f"response_data: {response_data}")
            if "message" in response_data and "sql_generator_query" in response_data["message"]:
                import re
                query = response_data["message"]["sql_generator_query"]
                match = re.search(r"<rawData>([\s\S]*?)</rawData>", query)
                if match:
                    response_data["message"]["rawData"] = match.group(1).strip()

            status_code = response_data.get("message", {}).get("status")

            logging.info(f"status_code: {status_code}")
            if status_code == 200:
                return response_data
            elif status_code == 402:
                return "DEMO_REACHED"
            elif status_code == 401:
                return 'API_KEY_INVALID'
            else:
                return response_data

        except urllib.error.HTTPError as e:
            if e.code == 401:
                return 'API_KEY_INVALID'
            if e.code == 402:
                return 'DEMO_REACHED'
            _logger.error(f"HTTPError in send_message_to_engine_api: {e}")
            return {"error": f"HTTPError: {e.code} - {e.reason}"}

        except Exception as e:
            _logger.error(f"Error in send_message_to_engine_api: {e}")
            return {"error": str(e)}

    # This funtion will make the data look Pretier for the user when they dont agree to use the analytics function
    @api.model
    def answer_pretier(self, sql_query, sql_result, raw_data):
        bot_reply = ""

        def is_valid_sql_result_array(data):
            if not isinstance(data, list) or len(data) == 0:
                return False
            for row in data:
                if not isinstance(row, dict):
                    return False
                if any('error' in key.lower() for key in row.keys()):
                    return False
            return True

        try:
            if raw_data and sql_result:
                if is_valid_sql_result_array(sql_result):
                    # Format từng row như "- key: value"
                    result_lines = "\n\n".join([
                        "\n".join([f"- {key}: {value}" for key, value in row.items()])
                        for row in sql_result
                    ])
                    parts = raw_data.split("<data>")
                    before = parts[0].strip()
                    after = ""
                    if len(parts) > 1:
                        after = parts[1].replace("</data>", "").strip()
                    # Dùng <br> như frontend
                        escaped_lines = html.escape(result_lines).replace('\n', '<br>')
                        bot_reply = f"{before}<br>{escaped_lines}<br>{after}"
                else:
                    bot_reply = "Xin Lỗi Vì Sự Bất Tiện Nhưng Tôi Không Thể Tìm Thấy Dữ Liệu Bạn Đang Yêu Cầu Lúc Này, Bạn Hãy Thử Cụ Thể Hóa Câu Hỏi Hoặc Gửi Phản Hồi Cho Quản Trị Viên :( .(error:isValidSqlResultArray)"
            else:
                match = re.search(r"<chat>([\s\S]*?)</chat>", sql_query or "")
                if match:
                    bot_reply = match.group(1).strip()
                else:
                    bot_reply = "Xin Lỗi Vì Sự Bất Tiện Nhưng Tôi Không Thể Tìm Thấy Dữ Liệu Bạn Đang Yêu Cầu Lúc Này, Bạn Hãy Thử Cụ Thể Hóa Câu Hỏi Hoặc Gửi Phản Hồi Cho Quản Trị Viên :( .(error: raw_data and sql_result)"
        except Exception as e:
            bot_reply = f"Đã xảy ra lỗi khi xử lý dữ liệu: {str(e)}"

        return {"bot_reply": bot_reply}
    # this function will give user language
    @api.model
    def get_current_user_lang(self):
        try:
            user = self.env.user
            # Lấy ngôn ngữ người dùng hiện tại, ví dụ: 'vi_VN', 'en_US'
            user_lang = user.lang or 'en_US'
            return {"lang": user_lang}
        except Exception as e:
            return {"error": str(e)}


    # This function will send User DATA to Engine to analytics if the User agree to do that :3
    @api.model
    def send_message_to_answer_api(self, message, sql_query, sql_result, chat_model, uid, history):
        def markdown_to_html(markdown: str) -> str:
            lines = markdown.strip().split('\n')
            html_lines = []
            table_block = []

            def render_table(block):
                if not block:
                    return ""
                headers = [h.strip() for h in block[0].strip('|').split('|')]
                rows = [r.strip('|').split('|') for r in block[2:]]

                html = ["<table border='1'>", "  <thead>", "    <tr>"]
                html += [f"<th>{col.strip()}</th>" for col in headers]
                html += ["    </tr>", "  </thead>", "  <tbody>"]
                for row in rows:
                    html.append("    <tr>" + ''.join(f"<td>{cell.strip()}</td>" for cell in row) + "</tr>")
                html += ["  </tbody>", "</table>"]
                return "\n".join(html)

            def parse_inline_formatting(text):
                text = re.sub(r'\*\*(.*?)\*\*', r'<strong>\1</strong>', text)
                return text

            in_list = False
            i = 0
            while i < len(lines):
                line = lines[i].strip()

                # LaTeX block
                if line.startswith('\\[') and line.endswith('\\]'):
                    latex_content = line[2:-2].strip()
                    html_lines.append(f"<div class='math-block'>\\[{latex_content}\\]</div>")
                    i += 1
                    continue

                # Markdown table
                if line.startswith('|') and i + 1 < len(lines) and set(lines[i + 1].strip()) <= {'|', '-', ' '}:
                    table_block = [lines[i], lines[i + 1]]
                    i += 2
                    while i < len(lines) and lines[i].strip().startswith('|'):
                        table_block.append(lines[i])
                        i += 1
                    html_lines.append(render_table(table_block))
                    continue

                # List item
                if line.startswith('- '):
                    if not in_list:
                        html_lines.append("<ul>")
                        in_list = True
                    html_lines.append(f"<li>{parse_inline_formatting(line[2:].strip())}</li>")
                    i += 1
                    continue
                else:
                    if in_list:
                        html_lines.append("</ul>")
                        in_list = False

                # Paragraph
                if line:
                    html_lines.append(f"<p>{parse_inline_formatting(line)}</p>")

                i += 1

            if in_list:
                html_lines.append("</ul>")

            return '\n'.join(html_lines)

        try:
            API_key = self.env["ir.config_parameter"].sudo().get_param("API_key")
            api_url = f"{enviroment_api}/answer"
            payload = {
                "message": message,
                "sql_query": sql_query,
                "sql_result": sql_result,
                "chat_model": chat_model,
                "user_id": uid,
                "history": history or "Tạm Thời Chưa Có history vì đây là tin nhắn đầu tiên",
                "API_key": API_key,
            }
            data_bytes = json.dumps(payload).encode('utf-8')

            req = urllib.request.Request(api_url, data=data_bytes, headers={
                "Content-Type": "application/json",
                "User-Agent": "Mozilla/5.0"
            }, method="POST")

            with urllib.request.urlopen(req, timeout=3000) as response:
                response_data = json.loads(response.read().decode())
                logging.info(f"response_data: {response_data}")
            answer_markdown = response_data.get("answer", {}).get("sql_generator_ans", "")
            answer_html = markdown_to_html(answer_markdown)
            return {
                "answer": answer_html
            }

        except urllib.error.HTTPError as e:
            return {"error": f"HTTP error! Status: {e.code}"}
        except Exception as e:
            _logger.error(f"Error in send_message_to_answer_api: {e}")
            return {"error": str(e)}


    # This function will naming the conversation and create conversation in the Odoo DB
    @api.model
    def naming_and_create_conversation(self, prompt, chat_model, userid):
        try:
            API_key = self.env["ir.config_parameter"].sudo().get_param("API_key")
            logging.info(f"API_key: {API_key}")
            api_url = f"{enviroment_api}/naming-service"
            payload = {
                "promt": prompt,  # Giữ nguyên "promt" nếu đó là key chính xác từ server
                "chat_model": chat_model,
                "API_key": API_key,
            }
            data_bytes = json.dumps(payload).encode('utf-8')

            req = urllib.request.Request(api_url, data=data_bytes, headers={
                "Content-Type": "application/json",
                "User-Agent": "Mozilla/5.0"
            }, method="POST")

            with urllib.request.urlopen(req, timeout=30) as response:
                data = json.loads(response.read().decode())
                logging.info(f"datadatadata: {data}")

            name_data = data.get("name")
            named = self.env['leandix.ai.chat.history'].create_new_conversation(userid, name_data)
            return named

        except urllib.error.HTTPError as e:
            return {"error": f"HTTP error! Status: {e.code}", "name": "New Conversation"}
        except Exception as e:
            _logger.exception("Error in create_conversation:")
            return {"error": str(e), "name": "New Conversation"}





    def get_data_from_DB(self, query, **kwargs):
        # Lọc thẻ tag cho sql
        def extract_tag_content(text, tag):
            try:
                return text.split(f"<{tag}>")[1].split(f"</{tag}>")[0].strip()
            except IndexError:
                return ""
        # Kiểm tra access right
        def check_user_access_rights(table_names, action, user_id):
            self.env.cr.execute("""
                SELECT gid FROM res_groups_users_rel WHERE uid = %s
            """, (user_id,))
            group_ids = [r[0] for r in self.env.cr.fetchall()]
            if not group_ids:
                return False, f"User {user_id} không thuộc group nào."

            if not table_names:
                return False, "Không có bảng nào để kiểm tra quyền."

            first_table = table_names[0]
            if first_table.strip().lower().endswith("rel") or first_table.strip().lower().endswith(".uom"):
                return True, ""  # Bỏ qua bảng trung gian

            model_name = first_table.replace('_', '.')
            self.env.cr.execute("""
                SELECT id FROM ir_model WHERE model = %s
            """, (model_name,))
            model = self.env.cr.fetchone()
            if not model:
                return True, f"Bỏ qua kiểm tra vì không tìm thấy model tương ứng bảng đầu tiên '{first_table}'"

            model_id = model[0]

            self.env.cr.execute("""
                SELECT perm_read, perm_write, perm_create, perm_unlink
                FROM ir_model_access
                WHERE model_id = %s AND (group_id IS NULL OR group_id = ANY(%s))
            """, (model_id, group_ids))
            access_list = self.env.cr.fetchall()
            if not access_list:
                return False, f"User {user_id} không có quyền truy cập bảng '{first_table}'"

            permission_mapping = {
                "SELECT": "perm_read",
                "UPDATE": "perm_write",
                "INSERT": "perm_create",
                "DELETE": "perm_unlink"
            }

            has_permission = False
            for access in access_list:
                if (
                    (action == "SELECT" and access[0]) or
                    (action == "UPDATE" and access[1]) or
                    (action == "INSERT" and access[2]) or
                    (action == "DELETE" and access[3])
                ):
                    has_permission = True
                    break

            if not has_permission:
                action_name = permission_mapping.get(action, "quyền không xác định")
                return False, f"User {user_id} không có quyền {action_name} trên bảng '{first_table}'"

            return True, ""
        # Đảm bảo có các keywork trong sql
        def ensure_keyword(text, keyword):
            if not text:
                return ""
            text_strip = text.lstrip()
            lowered = text_strip.lower()
            if lowered.startswith(keyword.lower()) or lowered.startswith("with"):
                return text
            return f"{keyword} {text_strip}"


        current_user_id = kwargs.get('current_user_id', None)

        try:
            if not query or not isinstance(query, str):
                return {"message": "Không cần lấy dữ liệu từ Odoo"}

            lowered_query = query.lower()
            if ("select" not in lowered_query and "update" not in lowered_query
                and "insert" not in lowered_query and "delete" not in lowered_query):
                return {"message": "Không cần lấy dữ liệu từ Odoo"}

            if any(tag in query for tag in ["<select>", "<update>", "<insert>", "<delete>"]):
                select_part = extract_tag_content(query, "select")
                update_part = insert_part = delete_part = ""
                if not select_part:
                    update_part = extract_tag_content(query, "update")
                if not update_part:
                    insert_part = extract_tag_content(query, "insert")
                if not insert_part:
                    delete_part = extract_tag_content(query, "delete")

                from_part = extract_tag_content(query, "from")
                where_part = extract_tag_content(query, "where")
                other_part = extract_tag_content(query, "other")
                table_list_part = extract_tag_content(query, "table_list")

                # Đảm bảo thêm từ khóa đúng cho từng phần
                select_part = ensure_keyword(select_part, "SELECT")
                update_part = ensure_keyword(update_part, "UPDATE")
                insert_part = ensure_keyword(insert_part, "INSERT")
                delete_part = ensure_keyword(delete_part, "DELETE")
                from_part = ensure_keyword(from_part, "FROM")
                where_part = ensure_keyword(where_part, "WHERE")

                tables = []
                if table_list_part:
                    for tbl in table_list_part.split(","):
                        tbl = tbl.strip()
                        if " AS " in tbl.upper():
                            tbl = tbl.upper().split(" AS ")[0].strip()
                        tables.append(tbl)

                if current_user_id is not None and tables:
                    if "<select>" in query:
                        sql_command = "SELECT"
                    elif "<update>" in query:
                        sql_command = "UPDATE"
                    elif "<insert>" in query:
                        sql_command = "INSERT"
                    elif "<delete>" in query:
                        sql_command = "DELETE"
                    else:
                        sql_command = "UNKNOWN"

                    has_access, message = check_user_access_rights(tables, sql_command, current_user_id)
                    if not has_access:
                        return {"error": message}

                    if sql_command == "SELECT":
                        self.env.cr.execute("""
                            SELECT gid FROM res_groups_users_rel WHERE uid = %s
                        """, (current_user_id,))
                        group_ids = [r[0] for r in self.env.cr.fetchall()]

                        for i, table in enumerate(tables):
                            model_name = table.replace('_', '.')
                            self.env.cr.execute("""
                                SELECT id FROM ir_model WHERE model = %s
                            """, (model_name,))
                            model = self.env.cr.fetchone()
                            if not model:
                                continue
                            model_id = model[0]

                            self.env.cr.execute("""
                                SELECT r.domain_force
                                FROM ir_rule r
                                JOIN rule_group_rel rel ON r.id = rel.rule_group_id
                                WHERE r.model_id = %s
                                AND r.perm_read = TRUE
                                AND r.active = TRUE
                                AND rel.group_id = ANY(%s)
                            """, (model_id, group_ids))
                            rules = self.env.cr.fetchall()

                            domain_list = [rule[0].replace(" ", "").replace('"', "'") for rule in rules if rule[0]]
                            has_full_access = any(domain == "[(1,'=',1)]" for domain in domain_list)

                            if not has_full_access and i == 0:
                                self.env.cr.execute("""
                                    SELECT column_name
                                    FROM information_schema.columns
                                    WHERE table_name = %s AND column_name = 'user_id'
                                """, (table,))
                                has_user_id = self.env.cr.fetchone()
                                if has_user_id:
                                    if where_part and where_part.lower().startswith("where"):
                                        where_content = where_part[5:].strip()
                                        where_content += f" AND {table}.user_id = {current_user_id}"
                                        where_part = "WHERE " + where_content
                                    elif where_part:
                                        where_part += f" AND {table}.user_id = {current_user_id}"
                                    else:
                                        where_part = f"WHERE {table}.user_id = {current_user_id}"

                # Ghép query cuối
                parts = []
                if select_part:
                    parts.append(select_part)
                if update_part:
                    parts.append(update_part)
                if insert_part:
                    parts.append(insert_part)
                if delete_part:
                    parts.append(delete_part)
                if from_part:
                    parts.append(from_part)
                if where_part:
                    parts.append(where_part.strip())
                if other_part:
                    parts.append(other_part)

                query = " ".join(parts)

            # Thực thi câu truy vấn
            try:
                cursor = self.env.cr
                if select_part:
                    cursor.execute(query)
                    data = cursor.dictfetchall()
                    logging.info(f"Query: {query}")
                    logging.info(f"Data: {data}")
                    return {"status": "success", "query": query, "data": data}
                else:
                    cursor.execute(query)
                    self.env.cr.commit()
                    return {"status": "success", "query": query, "data": ""}

            except Exception as e:
                logging.error(f"Unexpected error: {str(e)}")
                return {"status": "error", "message": f"error: {str(e)}"}

        except Exception as e:
            return {"message": str(e)}







