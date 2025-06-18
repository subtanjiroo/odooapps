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

from odoo import _, api, fields, models
from odoo.exceptions import UserError
import json
import urllib.request

class LeandixAISetting(models.TransientModel):
    _inherit = 'res.config.settings'

    leandix_api_key = fields.Char(
        string="Leandix AI API Key",
        config_parameter='API_key',
        help="Nhập API Key của Leandix AI"
    )

    @api.model
    def get_values(self):
        res = super().get_values()
        icp = self.env['ir.config_parameter'].sudo()
        api_key = icp.get_param('API_key')
        res.update(leandix_api_key=api_key or '')
        return res

    def set_values(self):
        super().set_values()
        self.env['ir.config_parameter'].sudo().set_param(
            'API_key', self.leandix_api_key or ''
        )

    def action_reset_leandix_api_key(self):
        """Gọi API và cập nhật lại API Key từ Leandix"""
        try:
            config = self.env['ir.config_parameter'].sudo()
            api_id = config.get_param("API_id")

            if not api_id:
                raise UserError(_("Không tìm thấy API ID trong hệ thống."))

            url = "https://platform.leandix.com/api/api_key_management/public/reset"
            headers = {
            "Accept": "*/*",
            "Connection": "keep-alive",
            "Content-Type": "application/json",
            "Cache-Control": "no-cache"}
            payload_dict = {"API_id": int(api_id)}
            payload_bytes = json.dumps(payload_dict).encode("utf-8")
            req = urllib.request.Request(url, data=payload_bytes, headers=headers, method="POST")

            with urllib.request.urlopen(req, timeout=10) as response:
                if response.status != 200:
                    raise UserError(_("Lỗi kết nối đến API: mã trạng thái %s") % response.status)

                result = json.loads(response.read().decode())
                api_key = result.get("API_key")

                if not api_key:
                    raise UserError(_("API không trả về API_key"))

                config.set_param("API_key", api_key)

        except urllib.error.HTTPError as e:
            raise UserError(_("HTTP Error: %s - %s") % (e.code, e.reason))
        except urllib.error.URLError as e:
            raise UserError(_("URL Error: %s") % e.reason)
        except Exception as e:
            raise UserError(_("Lỗi không xác định: %s") % str(e))
